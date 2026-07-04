<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

class CleanDuplicatePendingSks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sk:clean-pending';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean duplicate pending SKs in the generator queue for the same teacher and jenis_sk';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Mencari pengajuan SK ganda yang masih mengantre di Generator (belum dicetak)...');
        
        // Find teachers who have more than 1 pending SK of the same jenis_sk AND same school
        $duplicates = SkDocument::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
            ->where(function ($q) {
                $q->whereNull('file_url')->orWhere('file_url', '')
                  ->orWhere('nomor_sk', 'like', 'REQ/%')
                  ->orWhere('nomor_sk', 'like', 'DRAFT-%');
            })
            ->select('teacher_id', 'jenis_sk', 'school_id', DB::raw('COUNT(*) as count'))
            ->whereNotNull('teacher_id')
            ->groupBy('teacher_id', 'jenis_sk', 'school_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        $deletedCount = 0;
        
        foreach ($duplicates as $dup) {
            $teacherName = DB::table('teachers')->where('id', $dup->teacher_id)->value('nama') ?? 'Guru ID ' . $dup->teacher_id;
            
            // Get all pending SKs for this teacher, jenis_sk, AND school
            $pendingSks = SkDocument::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
                ->where('teacher_id', $dup->teacher_id)
                ->where('jenis_sk', $dup->jenis_sk)
                ->where('school_id', $dup->school_id)
                ->where(function ($q) {
                    $q->whereNull('file_url')->orWhere('file_url', '')
                      ->orWhere('nomor_sk', 'like', 'REQ/%')
                      ->orWhere('nomor_sk', 'like', 'DRAFT-%');
                })
                ->orderBy('created_at', 'desc')
                ->get();
                
            // We want to KEEP the one that has the most data:
            // 1. Has file_url (PDF generated)
            // 2. Has surat_permohonan_url (Uploaded letter)
            // 3. Has nomor_permohonan
            $keep = null;
            
            // Priority 1: file_url
            foreach ($pendingSks as $sk) {
                if (!empty($sk->file_url)) {
                    $keep = $sk;
                    break;
                }
            }
            
            // Priority 2: surat_permohonan_url
            if (!$keep) {
                foreach ($pendingSks as $sk) {
                    if (!empty($sk->surat_permohonan_url)) {
                        $keep = $sk;
                        break;
                    }
                }
            }
            
            // Priority 3: nomor_permohonan
            if (!$keep) {
                foreach ($pendingSks as $sk) {
                    if (!empty($sk->nomor_permohonan)) {
                        $keep = $sk;
                        break;
                    }
                }
            }
            
            // Priority 4: just the newest one
            if (!$keep) {
                $keep = $pendingSks->first();
            }
            
            // Delete the rest
            foreach ($pendingSks as $sk) {
                if ($sk->id !== $keep->id) {
                    $sk->delete();
                    $deletedCount++;
                    $this->line("- Menghapus antrean ganda (Kosong) untuk: {$teacherName} ({$dup->jenis_sk})");
                }
            }
        }

        $this->info('');
        $this->info("✅ PROSES SELESAI!");
        $this->info("Total Antrean SK ganda yang belum dicetak yang berhasil dibersihkan: {$deletedCount}");
    }
}
