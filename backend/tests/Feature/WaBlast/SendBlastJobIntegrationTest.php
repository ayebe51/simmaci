<?php

namespace Tests\Feature\WaBlast;

use App\Jobs\SendBlastJob;
use App\Models\User;
use App\Models\WaBlast;
use App\Models\WaBlastConfig;
use App\Models\WaBlastRecipient;
use App\Services\GoWaGatewayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Crypt;
use Tests\TestCase;

/**
 * End-to-end integration tests for SendBlastJob.
 *
 * Tests the full job execution with a mocked GoWaGatewayService,
 * verifying blast and recipient status transitions for all scenarios:
 * - All recipients succeed → blast status 'completed'
 * - Some recipients fail → blast status 'completed' with failed_count > 0
 * - All recipients fail → blast status 'failed'
 * - Gateway timeout → blast status 'failed' with error message
 *
 * Requirements: 4, 10
 */
class SendBlastJobIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private WaBlastConfig $config;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'email'     => 'superadmin@test.com',
            'is_active' => true,
        ]);

        $this->config = WaBlastConfig::create([
            'api_url'                    => 'https://go-wa.example.com',
            'api_token_encrypted'        => Crypt::encryptString('test-token'),
            'sender_number'              => '6281234567890',
            'max_recipients_per_session' => 500,
            'max_daily_messages'         => 1000,
            'updated_by'                 => $this->superAdmin->id,
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Create a WaBlast in 'sending' status with the given number of pending recipients.
     */
    private function createBlastWithPendingRecipients(int $count, string $messageBody = 'Halo {{nama}} dari {{nama_sekolah}}.'): WaBlast
    {
        $blast = WaBlast::create([
            'title'              => 'Test Blast',
            'recipient_category' => 'kepala_sekolah',
            'message_body'       => $messageBody,
            'blast_status'       => 'sending',
            'total_recipients'   => $count,
            'sent_count'         => 0,
            'failed_count'       => 0,
            'invalid_count'      => 0,
            'sent_at'            => now(),
            'created_by'         => $this->superAdmin->id,
        ]);

        for ($i = 1; $i <= $count; $i++) {
            WaBlastRecipient::create([
                'wa_blast_id'    => $blast->id,
                'recipient_name' => "Penerima {$i}",
                'school_name'    => "Sekolah {$i}",
                'phone_number'   => '6281234' . str_pad($i, 6, '0', STR_PAD_LEFT),
                'recipient_type' => 'kepala_sekolah',
                'delivery_status' => 'pending',
            ]);
        }

        return $blast;
    }

    /**
     * Run the job synchronously (bypasses queue, executes handle() directly).
     */
    private function runJob(int $blastId): void
    {
        $job = new SendBlastJob($blastId);
        app()->call([$job, 'handle']);
    }

    // ── Scenario 1: All Recipients Succeed ───────────────────────────────────

    public function test_all_recipients_succeed_sets_blast_status_to_completed(): void
    {
        $blast = $this->createBlastWithPendingRecipients(3);

        $this->mock(GoWaGatewayService::class, function ($mock) {
            $mock->shouldReceive('sendText')
                ->times(3)
                ->andReturn([
                    'success' => true,
                    'message' => 'Pesan berhasil dikirim',
                ]);
        });

        $this->runJob($blast->id);

        $blast->refresh();
        $this->assertEquals('completed', $blast->blast_status);
        $this->assertEquals(3, $blast->sent_count);
        $this->assertEquals(0, $blast->failed_count);
        $this->assertNotNull($blast->completed_at);
    }

    public function test_all_recipients_succeed_sets_delivery_status_to_sent(): void
    {
        $blast = $this->createBlastWithPendingRecipients(2);

        $this->mock(GoWaGatewayService::class, function ($mock) {
            $mock->shouldReceive('sendText')
                ->times(2)
                ->andReturn(['success' => true, 'message' => 'OK']);
        });

        $this->runJob($blast->id);

        $sentCount = WaBlastRecipient::where('wa_blast_id', $blast->id)
            ->where('delivery_status', 'sent')
            ->count();

        $this->assertEquals(2, $sentCount);
    }

    public function test_all_recipients_succeed_records_sent_at_timestamp(): void
    {
        $blast = $this->createBlastWithPendingRecipients(1);

        $this->mock(GoWaGatewayService::class, function ($mock) {
            $mock->shouldReceive('sendText')
                ->once()
                ->andReturn(['success' => true, 'message' => 'OK']);
        });

        $this->runJob($blast->id);

        $recipient = WaBlastRecipient::where('wa_blast_id', $blast->id)->first();
        $this->assertNotNull($recipient->sent_at);
    }

    // ── Scenario 2: Some Recipients Fail ─────────────────────────────────────

    public function test_partial_failure_sets_blast_status_to_completed(): void
    {
        $blast = $this->createBlastWithPendingRecipients(3);

        $callCount = 0;
        $this->mock(GoWaGatewayService::class, function ($mock) use (&$callCount) {
            $mock->shouldReceive('sendText')
                ->times(3)
                ->andReturnUsing(function () use (&$callCount) {
                    $callCount++;
                    // First 2 succeed, last one fails
                    if ($callCount <= 2) {
                        return ['success' => true, 'message' => 'OK'];
                    }
                    return ['success' => false, 'message' => 'Nomor tidak terdaftar di WhatsApp'];
                });
        });

        $this->runJob($blast->id);

        $blast->refresh();
        // At least one sent → completed (not failed)
        $this->assertEquals('completed', $blast->blast_status);
        $this->assertEquals(2, $blast->sent_count);
        $this->assertEquals(1, $blast->failed_count);
    }

    public function test_partial_failure_continues_sending_to_remaining_recipients(): void
    {
        $blast = $this->createBlastWithPendingRecipients(3);

        $callCount = 0;
        $this->mock(GoWaGatewayService::class, function ($mock) use (&$callCount) {
            $mock->shouldReceive('sendText')
                ->times(3) // All 3 must be attempted
                ->andReturnUsing(function () use (&$callCount) {
                    $callCount++;
                    // Middle one fails, others succeed
                    return $callCount === 2
                        ? ['success' => false, 'message' => 'Error']
                        : ['success' => true, 'message' => 'OK'];
                });
        });

        $this->runJob($blast->id);

        $blast->refresh();
        $this->assertEquals(2, $blast->sent_count);
        $this->assertEquals(1, $blast->failed_count);
    }

    public function test_partial_failure_stores_error_message_for_failed_recipient(): void
    {
        $blast = $this->createBlastWithPendingRecipients(2);

        $callCount = 0;
        $this->mock(GoWaGatewayService::class, function ($mock) use (&$callCount) {
            $mock->shouldReceive('sendText')
                ->times(2)
                ->andReturnUsing(function () use (&$callCount) {
                    $callCount++;
                    return $callCount === 1
                        ? ['success' => true, 'message' => 'OK']
                        : ['success' => false, 'message' => 'Nomor tidak valid'];
                });
        });

        $this->runJob($blast->id);

        $failedRecipient = WaBlastRecipient::where('wa_blast_id', $blast->id)
            ->where('delivery_status', 'failed')
            ->first();

        $this->assertNotNull($failedRecipient);
        $this->assertEquals('Nomor tidak valid', $failedRecipient->error_message);
    }

    // ── Scenario 3: All Recipients Fail ──────────────────────────────────────

    public function test_all_recipients_fail_sets_blast_status_to_failed(): void
    {
        $blast = $this->createBlastWithPendingRecipients(3);

        $this->mock(GoWaGatewayService::class, function ($mock) {
            $mock->shouldReceive('sendText')
                ->times(3)
                ->andReturn([
                    'success' => false,
                    'message' => 'Gagal mengirim pesan',
                ]);
        });

        $this->runJob($blast->id);

        $blast->refresh();
        $this->assertEquals('failed', $blast->blast_status);
        $this->assertEquals(0, $blast->sent_count);
        $this->assertEquals(3, $blast->failed_count);
    }

    public function test_all_recipients_fail_sets_all_delivery_statuses_to_failed(): void
    {
        $blast = $this->createBlastWithPendingRecipients(2);

        $this->mock(GoWaGatewayService::class, function ($mock) {
            $mock->shouldReceive('sendText')
                ->times(2)
                ->andReturn(['success' => false, 'message' => 'Error']);
        });

        $this->runJob($blast->id);

        $failedCount = WaBlastRecipient::where('wa_blast_id', $blast->id)
            ->where('delivery_status', 'failed')
            ->count();

        $this->assertEquals(2, $failedCount);
    }

    // ── Scenario 4: Gateway Timeout / Connection Error ────────────────────────

    public function test_gateway_timeout_sets_blast_status_to_failed(): void
    {
        $blast = $this->createBlastWithPendingRecipients(2);

        $this->mock(GoWaGatewayService::class, function ($mock) {
            $mock->shouldReceive('sendText')
                ->once() // Job stops after first timeout
                ->andThrow(new ConnectionException('Connection timed out'));
        });

        $this->runJob($blast->id);

        $blast->refresh();
        $this->assertEquals('failed', $blast->blast_status);
    }

    public function test_gateway_timeout_stores_correct_error_message(): void
    {
        $blast = $this->createBlastWithPendingRecipients(1);

        $this->mock(GoWaGatewayService::class, function ($mock) {
            $mock->shouldReceive('sendText')
                ->once()
                ->andThrow(new ConnectionException('Connection timed out'));
        });

        $this->runJob($blast->id);

        $blast->refresh();
        $this->assertEquals('Go-WA Gateway tidak dapat dihubungi.', $blast->error_message);
    }

    public function test_gateway_timeout_stops_processing_remaining_recipients(): void
    {
        $blast = $this->createBlastWithPendingRecipients(3);

        $this->mock(GoWaGatewayService::class, function ($mock) {
            // Only called once — job stops after timeout
            $mock->shouldReceive('sendText')
                ->once()
                ->andThrow(new ConnectionException('Timeout'));
        });

        $this->runJob($blast->id);

        // When a ConnectionException occurs, the job aborts immediately without
        // updating any recipient's delivery_status. All 3 remain 'pending'.
        $pendingCount = WaBlastRecipient::where('wa_blast_id', $blast->id)
            ->where('delivery_status', 'pending')
            ->count();

        $this->assertEquals(3, $pendingCount);

        // And the blast itself is marked failed
        $blast->refresh();
        $this->assertEquals('failed', $blast->blast_status);
    }

    public function test_gateway_timeout_sets_completed_at_timestamp(): void
    {
        $blast = $this->createBlastWithPendingRecipients(1);

        $this->mock(GoWaGatewayService::class, function ($mock) {
            $mock->shouldReceive('sendText')
                ->once()
                ->andThrow(new ConnectionException('Timeout'));
        });

        $this->runJob($blast->id);

        $blast->refresh();
        $this->assertNotNull($blast->completed_at);
    }

    // ── Scenario 5: No Config Set ─────────────────────────────────────────────

    public function test_job_fails_gracefully_when_no_config_set(): void
    {
        // Remove the config
        WaBlastConfig::query()->delete();

        $blast = $this->createBlastWithPendingRecipients(1);

        // Gateway should never be called
        $this->mock(GoWaGatewayService::class, function ($mock) {
            $mock->shouldNotReceive('sendText');
        });

        $this->runJob($blast->id);

        $blast->refresh();
        $this->assertEquals('failed', $blast->blast_status);
        $this->assertEquals('Konfigurasi Go-WA Gateway belum diatur.', $blast->error_message);
    }

    // ── Scenario 6: Blast Not Found ───────────────────────────────────────────

    public function test_job_exits_gracefully_when_blast_not_found(): void
    {
        // Should not throw — just log and return
        $this->mock(GoWaGatewayService::class, function ($mock) {
            $mock->shouldNotReceive('sendText');
        });

        // No exception should be thrown
        $this->runJob(99999);

        // Nothing to assert — just verifying no exception is thrown
        $this->assertTrue(true);
    }

    // ── Scenario 7: With PDF Attachment ──────────────────────────────────────

    public function test_job_uses_send_file_when_blast_has_attachment(): void
    {
        $blast = WaBlast::create([
            'title'              => 'Blast dengan Lampiran',
            'recipient_category' => 'kepala_sekolah',
            'message_body'       => 'Lihat lampiran.',
            'blast_status'       => 'sending',
            'attachment_path'    => 'wa-blasts/attachments/surat.pdf',
            'attachment_name'    => 'surat.pdf',
            'total_recipients'   => 1,
            'sent_count'         => 0,
            'failed_count'       => 0,
            'invalid_count'      => 0,
            'sent_at'            => now(),
            'created_by'         => $this->superAdmin->id,
        ]);

        WaBlastRecipient::create([
            'wa_blast_id'    => $blast->id,
            'recipient_name' => 'Ahmad Kepala',
            'school_name'    => 'MI Darwata',
            'phone_number'   => '6281234567890',
            'recipient_type' => 'kepala_sekolah',
            'delivery_status' => 'pending',
        ]);

        $this->mock(GoWaGatewayService::class, function ($mock) {
            // sendFile must be called (not sendText) when attachment is present
            $mock->shouldReceive('sendFile')
                ->once()
                ->andReturn(['success' => true, 'message' => 'File berhasil dikirim']);

            $mock->shouldNotReceive('sendText');
        });

        $this->runJob($blast->id);

        $blast->refresh();
        $this->assertEquals('completed', $blast->blast_status);
    }

    // ── Template Variable Substitution ───────────────────────────────────────

    public function test_job_substitutes_template_variables_in_message(): void
    {
        $blast = WaBlast::create([
            'title'              => 'Blast Variabel',
            'recipient_category' => 'kepala_sekolah',
            'message_body'       => 'Yth. {{nama}} dari {{nama_sekolah}}, harap hadir.',
            'blast_status'       => 'sending',
            'total_recipients'   => 1,
            'sent_count'         => 0,
            'failed_count'       => 0,
            'invalid_count'      => 0,
            'sent_at'            => now(),
            'created_by'         => $this->superAdmin->id,
        ]);

        WaBlastRecipient::create([
            'wa_blast_id'    => $blast->id,
            'recipient_name' => 'Budi Santoso',
            'school_name'    => 'MI Al-Ikhlas',
            'phone_number'   => '6281234567890',
            'recipient_type' => 'kepala_sekolah',
            'delivery_status' => 'pending',
        ]);

        $capturedMessage = null;

        $this->mock(GoWaGatewayService::class, function ($mock) use (&$capturedMessage) {
            $mock->shouldReceive('sendText')
                ->once()
                ->withArgs(function ($to, $message, $config) use (&$capturedMessage) {
                    $capturedMessage = $message;
                    return true;
                })
                ->andReturn(['success' => true, 'message' => 'OK']);
        });

        $this->runJob($blast->id);

        // Variables should be substituted
        $this->assertStringContainsString('Budi Santoso', $capturedMessage);
        $this->assertStringContainsString('MI Al-Ikhlas', $capturedMessage);
        $this->assertStringNotContainsString('{{nama}}', $capturedMessage);
        $this->assertStringNotContainsString('{{nama_sekolah}}', $capturedMessage);
    }

    // ── Invalid Number Recipients ─────────────────────────────────────────────

    public function test_job_skips_invalid_number_recipients(): void
    {
        $blast = WaBlast::create([
            'title'              => 'Blast dengan Invalid',
            'recipient_category' => 'kepala_sekolah',
            'message_body'       => 'Pesan.',
            'blast_status'       => 'sending',
            'total_recipients'   => 2,
            'sent_count'         => 0,
            'failed_count'       => 0,
            'invalid_count'      => 1,
            'sent_at'            => now(),
            'created_by'         => $this->superAdmin->id,
        ]);

        // One valid pending recipient
        WaBlastRecipient::create([
            'wa_blast_id'    => $blast->id,
            'recipient_name' => 'Valid Penerima',
            'school_name'    => 'MI Valid',
            'phone_number'   => '6281234567890',
            'recipient_type' => 'kepala_sekolah',
            'delivery_status' => 'pending',
        ]);

        // One invalid_number recipient (already marked, should be skipped)
        WaBlastRecipient::create([
            'wa_blast_id'    => $blast->id,
            'recipient_name' => 'Invalid Penerima',
            'school_name'    => 'MI Invalid',
            'phone_number'   => '123', // invalid
            'recipient_type' => 'kepala_sekolah',
            'delivery_status' => 'invalid_number',
        ]);

        $this->mock(GoWaGatewayService::class, function ($mock) {
            // Only called once for the valid pending recipient
            $mock->shouldReceive('sendText')
                ->once()
                ->andReturn(['success' => true, 'message' => 'OK']);
        });

        $this->runJob($blast->id);

        $blast->refresh();
        $this->assertEquals('completed', $blast->blast_status);
        $this->assertEquals(1, $blast->sent_count);
        $this->assertEquals(1, $blast->invalid_count);
    }

    // ── Unexpected Exception ──────────────────────────────────────────────────

    public function test_unexpected_exception_sets_blast_to_failed(): void
    {
        $blast = $this->createBlastWithPendingRecipients(1);

        $this->mock(GoWaGatewayService::class, function ($mock) {
            $mock->shouldReceive('sendText')
                ->once()
                ->andThrow(new \RuntimeException('Unexpected server error'));
        });

        $this->runJob($blast->id);

        $blast->refresh();
        $this->assertEquals('failed', $blast->blast_status);
        $this->assertEquals('Go-WA Gateway tidak dapat dihubungi.', $blast->error_message);
    }
}
