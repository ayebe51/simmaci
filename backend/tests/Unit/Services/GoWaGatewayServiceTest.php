<?php

namespace Tests\Unit\Services;

use App\Models\WaBlastConfig;
use App\Services\GoWaGatewayService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * GoWaGatewayServiceTest
 *
 * Unit tests for GoWaGatewayService.
 *
 * Verifies:
 * - HTTP Basic Auth is sent (not token in body)
 * - Correct endpoints are called (/api/send/message, /api/send/file, /api/user/info)
 * - Success/failure responses are handled correctly
 * - 401 Unauthorized returns descriptive error
 * - ConnectionException is caught and returned as error array
 */
class GoWaGatewayServiceTest extends TestCase
{
    private GoWaGatewayService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new GoWaGatewayService();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Build a mock WaBlastConfig with the given token (username:password format).
     */
    private function makeConfig(string $apiUrl = 'http://gowa.test:3000', string $token = 'admin:secret'): WaBlastConfig
    {
        $config = $this->createMock(WaBlastConfig::class);
        $config->method('getDecryptedToken')->willReturn($token);
        $config->method('__get')->willReturnCallback(fn ($name) => match ($name) {
            'api_url' => $apiUrl,
            default   => null,
        });
        return $config;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // sendText — endpoint & auth
    // ─────────────────────────────────────────────────────────────────────────

    /** @test */
    public function sendText_calls_correct_endpoint_with_basic_auth(): void
    {
        Http::fake([
            'http://gowa.test:3000/api/send/message' => Http::response(['status' => 'ok'], 200),
        ]);

        $config = $this->makeConfig();
        $result = $this->service->sendText('628123456789', 'Hello', $config);

        $this->assertTrue($result['success']);

        Http::assertSent(function (Request $request) {
            // Endpoint must be /api/send/message
            $this->assertStringEndsWith('/api/send/message', $request->url());

            // Must use Basic Auth header (Authorization: Basic base64(admin:secret))
            $expectedAuth = 'Basic ' . base64_encode('admin:secret');
            $this->assertEquals($expectedAuth, $request->header('Authorization')[0]);

            // Must NOT have 'token' field in body
            $this->assertArrayNotHasKey('token', $request->data());

            // Must have phone and message
            $this->assertEquals('628123456789', $request->data()['phone']);
            $this->assertEquals('Hello', $request->data()['message']);

            return true;
        });
    }

    /** @test */
    public function sendText_returns_success_false_on_non_2xx_response(): void
    {
        Http::fake([
            'http://gowa.test:3000/api/send/message' => Http::response(['error' => 'bad request'], 400),
        ]);

        $result = $this->service->sendText('628123456789', 'Hello', $this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertEquals(400, $result['status_code']);
    }

    /** @test */
    public function sendText_returns_error_on_connection_exception(): void
    {
        Http::fake(function () {
            throw new ConnectionException('Connection refused');
        });

        $result = $this->service->sendText('628123456789', 'Hello', $this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('tidak dapat dihubungi', $result['message']);
    }

    /** @test */
    public function sendText_works_without_basic_auth_when_token_is_empty(): void
    {
        Http::fake([
            'http://gowa.test:3000/api/send/message' => Http::response(['status' => 'ok'], 200),
        ]);

        $config = $this->makeConfig(token: '');
        $result = $this->service->sendText('628123456789', 'Hello', $config);

        $this->assertTrue($result['success']);

        Http::assertSent(function (Request $request) {
            // No Authorization header should be set
            $this->assertEmpty($request->header('Authorization'));
            return true;
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // sendFile — endpoint & caption field
    // ─────────────────────────────────────────────────────────────────────────

    /** @test */
    public function sendFile_calls_correct_endpoint_with_caption_field(): void
    {
        Http::fake([
            'http://gowa.test:3000/api/send/file' => Http::response(['status' => 'ok'], 200),
        ]);

        // Mock Storage::get to return fake file content
        \Illuminate\Support\Facades\Storage::fake('local');
        \Illuminate\Support\Facades\Storage::put('wa-blasts/attachments/test.pdf', 'fake-pdf-content');

        $config = $this->makeConfig();
        $result = $this->service->sendFile('628123456789', 'Lihat lampiran', 'wa-blasts/attachments/test.pdf', $config);

        $this->assertTrue($result['success']);

        Http::assertSent(function (Request $request) {
            // Endpoint must be /api/send/file
            $this->assertStringEndsWith('/api/send/file', $request->url());

            // Must use Basic Auth
            $expectedAuth = 'Basic ' . base64_encode('admin:secret');
            $this->assertEquals($expectedAuth, $request->header('Authorization')[0]);

            // Must NOT have 'token' in body
            $this->assertStringNotContainsString('"token"', $request->body());

            // Multipart body must contain 'caption' field name and its value
            $this->assertStringContainsString('name="caption"', $request->body());
            $this->assertStringContainsString('Lihat lampiran', $request->body());

            // Must NOT contain a 'message' field name
            $this->assertStringNotContainsString('name="message"', $request->body());

            return true;
        });
    }

    /** @test */
    public function sendFile_returns_error_when_file_not_found(): void
    {
        \Illuminate\Support\Facades\Storage::fake('local');
        // Do NOT create the file

        $result = $this->service->sendFile('628123456789', 'Caption', 'nonexistent/file.pdf', $this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('tidak ditemukan', $result['message']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // testConnection — uses GET /api/user/info
    // ─────────────────────────────────────────────────────────────────────────

    /** @test */
    public function testConnection_calls_get_api_user_info(): void
    {
        Http::fake([
            'http://gowa.test:3000/api/user/info' => Http::response(['device' => 'connected'], 200),
        ]);

        $result = $this->service->testConnection($this->makeConfig());

        $this->assertTrue($result['success']);

        Http::assertSent(function (Request $request) {
            // Must be GET
            $this->assertEquals('GET', $request->method());

            // Endpoint must be /api/user/info
            $this->assertStringEndsWith('/api/user/info', $request->url());

            // Must use Basic Auth
            $expectedAuth = 'Basic ' . base64_encode('admin:secret');
            $this->assertEquals($expectedAuth, $request->header('Authorization')[0]);

            // Must NOT have 'token' in body
            $this->assertArrayNotHasKey('token', $request->data());

            return true;
        });
    }

    /** @test */
    public function testConnection_returns_descriptive_error_on_401(): void
    {
        Http::fake([
            'http://gowa.test:3000/api/user/info' => Http::response('Unauthorized', 401),
        ]);

        $result = $this->service->testConnection($this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertEquals(401, $result['status_code']);
        $this->assertStringContainsString('Basic Auth', $result['message']);
    }

    /** @test */
    public function testConnection_returns_error_on_connection_exception(): void
    {
        Http::fake(function () {
            throw new ConnectionException('Connection refused');
        });

        $result = $this->service->testConnection($this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('tidak dapat dihubungi', $result['message']);
    }

    /** @test */
    public function testConnection_returns_failure_on_non_2xx_response(): void
    {
        Http::fake([
            'http://gowa.test:3000/api/user/info' => Http::response(['error' => 'server error'], 500),
        ]);

        $result = $this->service->testConnection($this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertEquals(500, $result['status_code']);
    }
}
