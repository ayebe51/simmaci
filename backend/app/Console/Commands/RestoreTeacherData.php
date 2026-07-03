<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Teacher;
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

class RestoreTeacherData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'teacher:restore-data';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Restores missing NIM, TTL, TMT, and School ID from soft-deleted duplicate teachers';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Memulai proses pemulihan data guru yang hilang...');

        // Find active teachers missing crucial data
        $activeTeachers = Teacher::whereNull('deleted_at')
            ->where(function ($q) {
                $q->whereNull('nomor_induk_maarif')
                  ->orWhere('nomor_induk_maarif', '')
                  ->orWhereNull('tmt')
                  ->orWhere('tmt', '')
                  ->orWhereNull('tempat_lahir')
                  ->orWhere('tempat_lahir', '')
                  ->orWhereNull('tanggal_lahir')
                  ->orWhereNull('school_id');
            })
            ->get();

        $this->info("Ditemukan {$activeTeachers->count()} guru aktif yang datanya tidak lengkap.");

        $recoveredCount = 0;
        $recoveredSkCount = 0;

        foreach ($activeTeachers as $teacher) {
            // Find soft-deleted duplicates with the same name
            $deletedMatches = Teacher::onlyTrashed()
                ->where(DB::raw('LOWER(TRIM(nama))'), strtolower(trim($teacher->nama)))
                ->get();

            if ($deletedMatches->isEmpty()) {
                continue; // No deleted duplicate found to restore from
            }

            $restoredFields = [];

            // Iterate over deleted matches to harvest missing data
            foreach ($deletedMatches as $deleted) {
                if (empty($teacher->nomor_induk_maarif) && !empty($deleted->nomor_induk_maarif)) {
                    $teacher->nomor_induk_maarif = $deleted->nomor_induk_maarif;
                    $restoredFields[] = 'NIM';
                }
                if (empty($teacher->tmt) && !empty($deleted->tmt)) {
                    $teacher->tmt = $deleted->tmt;
                    $restoredFields[] = 'TMT';
                }
                if (empty($teacher->tempat_lahir) && !empty($deleted->tempat_lahir)) {
                    $teacher->tempat_lahir = $deleted->tempat_lahir;
                    $restoredFields[] = 'Tempat Lahir';
                }
                if (empty($teacher->tanggal_lahir) && !empty($deleted->tanggal_lahir)) {
                    $teacher->tanggal_lahir = $deleted->tanggal_lahir;
                    $restoredFields[] = 'Tanggal Lahir';
                }
                if (empty($teacher->pendidikan_terakhir) && !empty($deleted->pendidikan_terakhir)) {
                    $teacher->pendidikan_terakhir = $deleted->pendidikan_terakhir;
                    $restoredFields[] = 'Pendidikan';
                }
                if (empty($teacher->school_id) && !empty($deleted->school_id)) {
                    $teacher->school_id = $deleted->school_id;
                    $restoredFields[] = 'Unit Kerja (School ID)';
                }
            }

            if (count($restoredFields) > 0) {
                $teacher->save();
                $recoveredCount++;
                $this->line("- Berhasil memulihkan [" . implode(', ', array_unique($restoredFields)) . "] untuk guru: {$teacher->nama}");
            }

            // Also check SK documents pointing to the deleted teachers and re-point them to the active teacher
            foreach ($deletedMatches as $deleted) {
                $affectedSks = SkDocument::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
                    ->where('teacher_id', $deleted->id)
                    ->get();
                
                foreach ($affectedSks as $sk) {
                    $sk->teacher_id = $teacher->id;
                    
                    // Also restore school_id and unit_kerja on SK if it's missing
                    if (empty($sk->school_id) && !empty($teacher->school_id)) {
                        $sk->school_id = $teacher->school_id;
                        $schoolName = DB::table('schools')->where('id', $teacher->school_id)->value('nama');
                        if ($schoolName) {
                            $sk->unit_kerja = $schoolName;
                        }
                    }
                    
                    $sk->save();
                    $recoveredSkCount++;
                    $this->line("  -> SK ({$sk->nomor_sk}) berhasil dikaitkan ulang ke guru aktif ini.");
                }
            }
        }

        $this->info('');
        $this->info("✅ PROSES SELESAI!");
        $this->info("Total Guru yang berhasil diselamatkan datanya: {$recoveredCount}");
        $this->info("Total Dokumen SK yang berhasil dikaitkan ulang: {$recoveredSkCount}");
    }
}
