<?php

namespace App\Jobs;

use App\Models\WaBlast;
use App\Repositories\WaBlastRecipientRepository;
use App\Repositories\WaBlastRepository;
use App\Services\GoWaGatewayService;
use App\Services\WaBlastConfigService;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * SendBlastJob
 *
 * Processes WA Blast sending in the background queue.
 * Iterates over each pending recipient, substitutes template variables,
 * sends via GoWaGatewayService, and updates delivery status.
 *
 * Uses tries = 1 — retries are handled explicitly by the user via retryBlast().
 */
class SendBlastJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Number of times the job may be attempted.
     * Set to 1 — retries are handled explicitly by the user via retryBlast().
     */
    public int $tries = 1;

    /**
     * Job timeout in seconds.
     */
    public int $timeout = 3600;

    /**
     * Create a new job instance.
     *
     * @param int $blastId The WaBlast ID to process
     */
    public function __construct(
        public int $blastId
    ) {}

    /**
     * Execute the job.
     *
     * Loads Go-WA config, iterates over pending recipients, sends messages,
     * updates delivery statuses, and finalises blast status.
     */
    public function handle(
        WaBlastConfigService $configService,
        GoWaGatewayService $gatewayService,
        WaBlastRepository $blastRepository,
        WaBlastRecipientRepository $recipientRepository
    ): void {
        // Load the blast record
        $blast = WaBlast::find($this->blastId);

        if (!$blast) {
            Log::warning("SendBlastJob: WaBlast #{$this->blastId} not found.");
            return;
        }

        // Load Go-WA configuration
        $config = $configService->get();

        if (!$config) {
            $blastRepository->updateStatus($this->blastId, 'failed', [
                'error_message' => 'Konfigurasi Go-WA Gateway belum diatur.',
                'completed_at'  => now(),
            ]);
            return;
        }

        // Mark blast as sending
        $blastRepository->updateStatus($this->blastId, 'sending', [
            'sent_at' => now(),
        ]);

        // Fetch all pending recipients
        $recipients = $recipientRepository->findByBlast($this->blastId)
            ->filter(fn ($r) => $r->delivery_status === 'pending');

        $sentCount    = 0;
        $failedCount  = 0;
        $gatewayError = false;

        foreach ($recipients as $recipient) {
            // Substitute template variables in the message body
            $message = $this->substituteVariables(
                $blast->message_body,
                $recipient->recipient_name,
                $recipient->school_name
            );

            try {
                // Send via Go-WA Gateway
                if (!empty($blast->attachment_path)) {
                    $response = $gatewayService->sendFile(
                        $recipient->phone_number,
                        $message,
                        $blast->attachment_path,
                        $config
                    );
                } else {
                    $response = $gatewayService->sendText(
                        $recipient->phone_number,
                        $message,
                        $config
                    );
                }

                if ($response['success']) {
                    $recipientRepository->updateDeliveryStatus(
                        $recipient->id,
                        'sent',
                        null,
                        Carbon::now()
                    );
                    $sentCount++;
                } else {
                    $errorMessage = $response['message'] ?? 'Gagal mengirim pesan.';
                    $recipientRepository->updateDeliveryStatus(
                        $recipient->id,
                        'failed',
                        $errorMessage,
                        null
                    );
                    $failedCount++;
                }
            } catch (ConnectionException $e) {
                // 6.2: Gateway unreachable — mark blast failed and stop processing
                $blastRepository->updateStatus($this->blastId, 'failed', [
                    'error_message' => 'Go-WA Gateway tidak dapat dihubungi.',
                    'completed_at'  => now(),
                ]);
                return;
            } catch (\Exception $e) {
                // Unexpected exception — treat as connection failure
                $blastRepository->updateStatus($this->blastId, 'failed', [
                    'error_message' => 'Go-WA Gateway tidak dapat dihubungi.',
                    'completed_at'  => now(),
                ]);
                return;
            }

            // Sleep 2 seconds between messages to avoid rate limiting
            sleep(2);
        }

        // Count invalid_number recipients (already set during blast creation)
        $invalidCount = $recipientRepository->findByBlast($this->blastId)
            ->filter(fn ($r) => $r->delivery_status === 'invalid_number')
            ->count();

        // Determine final blast status
        // If at least one was sent → completed; if all failed/invalid → failed
        $finalStatus = $sentCount > 0 ? 'completed' : 'failed';

        $blastRepository->updateStatus($this->blastId, $finalStatus, [
            'completed_at' => now(),
            'sent_count'   => $sentCount,
            'failed_count' => $failedCount,
            'invalid_count' => $invalidCount,
        ]);
    }

    /**
     * Substitute template variables in a message body.
     *
     * Replaces {{nama}} with $nama and {{nama_sekolah}} with $namaSekolah.
     *
     * @param string $template    The message template containing placeholders
     * @param string $nama        The recipient's name
     * @param string $namaSekolah The recipient's school name
     * @return string             The message with placeholders replaced
     */
    private function substituteVariables(string $template, string $nama, string $namaSekolah): string
    {
        return str_replace(
            ['{{nama}}', '{{nama_sekolah}}'],
            [$nama, $namaSekolah],
            $template
        );
    }
}
