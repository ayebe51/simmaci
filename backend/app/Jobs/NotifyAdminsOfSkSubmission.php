<?php

namespace App\Jobs;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class NotifyAdminsOfSkSubmission implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 60;
    public $tries = 3;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public int $skId,
        public string $nomorSk,
        public string $jenisSk,
        public string $nama,
        public string $unitKerja,
        public ?int $schoolId = null
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info('NotifyAdminsOfSkSubmission: Starting', [
            'sk_id' => $this->skId,
            'nomor_sk' => $this->nomorSk,
        ]);

        $admins = User::whereIn('role', ['super_admin', 'admin_yayasan'])->get();

        $created = 0;
        foreach ($admins as $admin) {
            try {
                Notification::create([
                    'user_id'   => $admin->id,
                    'school_id' => $this->schoolId,
                    'type'      => 'sk_submitted',
                    'title'     => 'Pengajuan SK Baru',
                    'message'   => "Pengajuan {$this->jenisSk} dari {$this->nama} ({$this->unitKerja}) menunggu verifikasi.",
                    'is_read'   => false,
                    'metadata'  => ['sk_id' => $this->skId, 'nomor_sk' => $this->nomorSk],
                ]);
                $created++;
            } catch (\Exception $e) {
                Log::error('Failed to create notification for admin', [
                    'admin_id' => $admin->id,
                    'sk_id' => $this->skId,
                    'exception' => $e->getMessage(),
                ]);
                // Continue to next admin
            }
        }

        Log::info('NotifyAdminsOfSkSubmission: Completed', [
            'sk_id' => $this->skId,
            'notifications_created' => $created,
        ]);
    }
}
