<?php

namespace App\Jobs;

use App\Models\WaBlastConfig;
use App\Services\GoWaGatewayService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendPpdbWaNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 60;
    public int $tries = 2;

    public function __construct(
        public string $phone,
        public string $message
    ) {}

    public function handle(GoWaGatewayService $waGatewayService): void
    {
        try {
            $config = WaBlastConfig::where('is_active', true)->first();
            if ($config) {
                $waGatewayService->sendMessage($config, $this->phone, $this->message);
                Log::info("PPDB WA Notification sent successfully to {$this->phone}");
            }
        } catch (\Throwable $e) {
            Log::warning("PPDB WA Notification failed to {$this->phone}: " . $e->getMessage());
        }
    }
}
