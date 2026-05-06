<?php

namespace Tests\Feature\WaBlast;

use App\Models\User;
use App\Models\WaBlastConfig;
use App\Services\GoWaGatewayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Tests\TestCase;

/**
 * Integration tests for WaBlastConfigController.
 *
 * Covers: save config (token encrypted in DB), show (token masked),
 * test connection (mocked GoWaGatewayService), 403 for admin_yayasan.
 *
 * Requirements: 7, 9.3
 */
class WaBlastConfigControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $adminYayasan;
    private User $operator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'email'     => 'superadmin@test.com',
            'is_active' => true,
        ]);

        $this->adminYayasan = User::factory()->create([
            'role'      => 'admin_yayasan',
            'email'     => 'yayasan@test.com',
            'is_active' => true,
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator@test.com',
            'is_active' => true,
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function validConfigPayload(array $overrides = []): array
    {
        return array_merge([
            'api_url'                    => 'https://go-wa.example.com',
            'api_token'                  => 'secret-api-token-12345',
            'sender_number'              => '6281234567890',
            'max_recipients_per_session' => 500,
            'max_daily_messages'         => 1000,
        ], $overrides);
    }

    private function createConfig(string $token = 'existing-token'): WaBlastConfig
    {
        return WaBlastConfig::create([
            'api_url'                    => 'https://go-wa.example.com',
            'api_token_encrypted'        => Crypt::encryptString($token),
            'sender_number'              => '6281234567890',
            'max_recipients_per_session' => 500,
            'max_daily_messages'         => 1000,
            'updated_by'                 => $this->superAdmin->id,
        ]);
    }

    // ── Authentication ────────────────────────────────────────────────────────

    public function test_unauthenticated_user_cannot_access_config(): void
    {
        $this->getJson('/api/wa-blast-config')->assertStatus(401);
    }

    // ── Role Guard (403) ──────────────────────────────────────────────────────

    public function test_operator_cannot_view_config(): void
    {
        $this->actingAs($this->operator)
            ->getJson('/api/wa-blast-config')
            ->assertStatus(403);
    }

    public function test_operator_cannot_save_config(): void
    {
        $this->actingAs($this->operator)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload())
            ->assertStatus(403);
    }

    public function test_operator_cannot_test_connection(): void
    {
        $this->actingAs($this->operator)
            ->postJson('/api/wa-blast-config/test')
            ->assertStatus(403);
    }

    /**
     * admin_yayasan is allowed to use WA Blast features but NOT to manage config.
     * The config endpoints are nested under role:super_admin middleware.
     *
     * Requirements: 7.1, 9.3
     */
    public function test_admin_yayasan_cannot_view_config(): void
    {
        $this->actingAs($this->adminYayasan)
            ->getJson('/api/wa-blast-config')
            ->assertStatus(403);
    }

    public function test_admin_yayasan_cannot_save_config(): void
    {
        $this->actingAs($this->adminYayasan)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload())
            ->assertStatus(403);
    }

    public function test_admin_yayasan_cannot_test_connection(): void
    {
        $this->actingAs($this->adminYayasan)
            ->postJson('/api/wa-blast-config/test')
            ->assertStatus(403);
    }

    // ── Show ──────────────────────────────────────────────────────────────────

    public function test_super_admin_can_view_config_with_masked_token(): void
    {
        $this->createConfig('my-secret-token');

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/wa-blast-config');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.api_url', 'https://go-wa.example.com')
            ->assertJsonPath('data.api_token', '***')
            ->assertJsonPath('data.sender_number', '6281234567890')
            ->assertJsonPath('data.max_recipients_per_session', 500)
            ->assertJsonPath('data.max_daily_messages', 1000);

        // Ensure the actual token is never exposed
        $responseBody = $response->getContent();
        $this->assertStringNotContainsString('my-secret-token', $responseBody);
    }

    public function test_show_returns_null_data_when_config_not_set(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/wa-blast-config');

        $response->assertOk()
            ->assertJsonPath('data', null);
    }

    public function test_show_response_does_not_expose_encrypted_token_field(): void
    {
        $this->createConfig('super-secret');

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/wa-blast-config');

        $response->assertOk();

        // The encrypted field should not appear in the response
        $data = $response->json('data');
        $this->assertArrayNotHasKey('api_token_encrypted', $data);
        $this->assertStringNotContainsString('super-secret', $response->getContent());
    }

    // ── Save Config ───────────────────────────────────────────────────────────

    public function test_super_admin_can_save_config(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload());

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.api_url', 'https://go-wa.example.com')
            ->assertJsonPath('data.api_token', '***')
            ->assertJsonPath('data.sender_number', '6281234567890');
    }

    public function test_save_config_encrypts_token_in_database(): void
    {
        $plainToken = 'my-plain-api-token';

        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload([
                'api_token' => $plainToken,
            ]));

        $config = WaBlastConfig::first();
        $this->assertNotNull($config);

        // The raw column must NOT contain the plain token
        $this->assertNotEquals($plainToken, $config->api_token_encrypted);

        // But decrypting it should yield the original token
        $decrypted = Crypt::decryptString($config->api_token_encrypted);
        $this->assertEquals($plainToken, $decrypted);
    }

    public function test_save_config_response_never_exposes_plain_token(): void
    {
        $plainToken = 'super-secret-token-xyz';

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload([
                'api_token' => $plainToken,
            ]));

        $response->assertOk();
        $this->assertStringNotContainsString($plainToken, $response->getContent());
        $this->assertEquals('***', $response->json('data.api_token'));
    }

    public function test_save_config_updates_existing_config_singleton(): void
    {
        // Create initial config
        $this->createConfig('old-token');
        $this->assertDatabaseCount('wa_blast_configs', 1);

        // Save new config — should update, not create a second row
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload([
                'api_token'   => 'new-token',
                'api_url'     => 'https://new-go-wa.example.com',
            ]));

        // Still only one row
        $this->assertDatabaseCount('wa_blast_configs', 1);

        $config = WaBlastConfig::first();
        $this->assertEquals('https://new-go-wa.example.com', $config->api_url);
        $this->assertEquals('new-token', Crypt::decryptString($config->api_token_encrypted));
    }

    // ── Save Config — Validation (422) ────────────────────────────────────────

    public function test_save_config_requires_api_url(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload(['api_url' => null]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['api_url']);
    }

    public function test_save_config_requires_valid_url_format(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload([
                'api_url' => 'not-a-valid-url',
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['api_url']);
    }

    public function test_save_config_requires_api_token(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload(['api_token' => null]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['api_token']);
    }

    public function test_save_config_requires_sender_number(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload(['sender_number' => null]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['sender_number']);
    }

    public function test_save_config_requires_sender_number_in_62_format(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload([
                'sender_number' => '081234567890', // must start with 62
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['sender_number']);
    }

    public function test_save_config_requires_max_recipients_per_session(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload([
                'max_recipients_per_session' => null,
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['max_recipients_per_session']);
    }

    public function test_save_config_rejects_max_recipients_below_1(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload([
                'max_recipients_per_session' => 0,
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['max_recipients_per_session']);
    }

    public function test_save_config_rejects_max_recipients_above_1000(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload([
                'max_recipients_per_session' => 1001,
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['max_recipients_per_session']);
    }

    public function test_save_config_requires_max_daily_messages(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload([
                'max_daily_messages' => null,
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['max_daily_messages']);
    }

    public function test_save_config_rejects_max_daily_messages_above_5000(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', $this->validConfigPayload([
                'max_daily_messages' => 5001,
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['max_daily_messages']);
    }

    // ── Test Connection ───────────────────────────────────────────────────────

    public function test_test_connection_returns_422_when_config_not_set(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config/test')
            ->assertStatus(422);
    }

    public function test_test_connection_returns_success_when_gateway_responds_ok(): void
    {
        $this->createConfig('valid-token');

        // Mock GoWaGatewayService to return a successful response
        $this->mock(GoWaGatewayService::class, function ($mock) {
            $mock->shouldReceive('testConnection')
                ->once()
                ->andReturn([
                    'success' => true,
                    'message' => 'Koneksi ke Go-WA berhasil',
                    'data'    => ['status' => 'connected'],
                ]);
        });

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config/test');

        $response->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_test_connection_returns_422_when_gateway_fails(): void
    {
        $this->createConfig('invalid-token');

        // Mock GoWaGatewayService to return a failure response
        $this->mock(GoWaGatewayService::class, function ($mock) {
            $mock->shouldReceive('testConnection')
                ->once()
                ->andReturn([
                    'success' => false,
                    'message' => 'Koneksi ke Go-WA gagal',
                    'error'   => 'Connection refused',
                ]);
        });

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config/test');

        $response->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_test_connection_passes_correct_config_to_gateway(): void
    {
        $config = $this->createConfig('test-token-for-connection');

        $this->mock(GoWaGatewayService::class, function ($mock) use ($config) {
            $mock->shouldReceive('testConnection')
                ->once()
                ->withArgs(function ($passedConfig) use ($config) {
                    return $passedConfig->id === $config->id;
                })
                ->andReturn([
                    'success' => true,
                    'message' => 'OK',
                ]);
        });

        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config/test')
            ->assertOk();
    }

    // ── Config Persistence ────────────────────────────────────────────────────

    public function test_saved_config_persists_all_fields_correctly(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blast-config', [
                'api_url'                    => 'https://custom-go-wa.example.com',
                'api_token'                  => 'custom-token-abc',
                'sender_number'              => '6289876543210',
                'max_recipients_per_session' => 250,
                'max_daily_messages'         => 750,
            ]);

        $config = WaBlastConfig::first();
        $this->assertNotNull($config);
        $this->assertEquals('https://custom-go-wa.example.com', $config->api_url);
        $this->assertEquals('6289876543210', $config->sender_number);
        $this->assertEquals(250, $config->max_recipients_per_session);
        $this->assertEquals(750, $config->max_daily_messages);
        $this->assertEquals($this->superAdmin->id, $config->updated_by);

        // Token must be encrypted
        $this->assertEquals('custom-token-abc', Crypt::decryptString($config->api_token_encrypted));
    }
}
