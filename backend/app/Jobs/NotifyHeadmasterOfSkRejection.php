<?php

namespace App\Jobs;

use App\Models\School;
use App\Models\WaBlastConfig;
use App\Services\GoWaGatewayService;
use App\Services\PhoneNormalizerService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class NotifyHeadmasterOfSkRejection implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 60;
    public $tries = 3;

    public function __construct(
        public int $skId,
        public string $nomorSk,
        public string $nama,
        public string $jenisSk,
        public ?string $rejectionReason,
        public ?int $schoolId
    ) {}

    public function handle(GoWaGatewayService $goWaService, PhoneNormalizerService $phoneNormalizer): void
    {
        Log::info('NotifyHeadmasterOfSkRejection: Starting', [
            'sk_id' => $this->skId,
            'school_id' => $this->schoolId,
        ]);

        if (!$this->schoolId) {
            Log::info('NotifyHeadmasterOfSkRejection: No school ID provided, skipping.');
            return;
        }

        $school = School::find($this->schoolId);
        if (!$school || empty($school->kepala_whatsapp)) {
            Log::info('NotifyHeadmasterOfSkRejection: No valid headmaster phone found, skipping.');
            return;
        }

        $config = WaBlastConfig::first();
        if (!$config) {
            Log::warning('NotifyHeadmasterOfSkRejection: No WaBlastConfig found.');
            return;
        }

        $normalizedPhone = $phoneNormalizer->normalize($school->kepala_whatsapp);
        if (!$phoneNormalizer->isValid($normalizedPhone)) {
            Log::warning('NotifyHeadmasterOfSkRejection: Invalid headmaster phone number', [
                'phone' => $school->kepala_whatsapp
            ]);
            return;
        }

        $message = "Assalamu'alaikum Bapak/Ibu Kepala Madrasah,\n\n";
        $message .= "Kami informasikan bahwa pengajuan SK dengan detail berikut telah *DITOLAK*:\n\n";
        $message .= "No. Registrasi: {$this->nomorSk}\n";
        $message .= "Nama: {$this->nama}\n";
        $message .= "Jenis SK: {$this->jenisSk}\n";
        
        if (!empty($this->rejectionReason)) {
            $message .= "Alasan Penolakan: {$this->rejectionReason}\n";
        }
        
        $message .= "\nHarap sampaikan kepada operator/guru yang bersangkutan untuk melakukan perbaikan jika diperlukan.\n\n";
        $message .= "Terima kasih,\nSistem SIMMACI";

        try {
            $response = $goWaService->sendText($normalizedPhone, $message, $config);
            
            if (!$response['success']) {
                Log::error('NotifyHeadmasterOfSkRejection: Failed to send WA', [
                    'response' => $response
                ]);
            } else {
                Log::info('NotifyHeadmasterOfSkRejection: WA sent successfully to headmaster');
            }
        } catch (\Exception $e) {
            Log::error('NotifyHeadmasterOfSkRejection: Exception while sending WA', [
                'exception' => $e->getMessage()
            ]);
        }
    }
}
