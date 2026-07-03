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

        // === PART 2: RESTORE MISSING SK DOCUMENT DATA ===
        $this->info('');
        $this->info('Memulai proses pemulihan data pengajuan SK yang hilang...');
        $activeSks = SkDocument::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
            ->whereNull('deleted_at')
            ->where(function ($q) {
                $q->whereNull('nomor_permohonan')
                  ->orWhere('nomor_permohonan', '')
                  ->orWhereNull('tanggal_permohonan')
                  ->orWhere('tanggal_permohonan', '');
            })
            ->get();

        $recoveredSkFieldsCount = 0;
        foreach ($activeSks as $sk) {
            // Find soft-deleted SKs for the same teacher (or same name/school_id if teacher_id is null)
            $query = SkDocument::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)->onlyTrashed();
            
            if ($sk->teacher_id) {
                $query->where('teacher_id', $sk->teacher_id);
            } else {
                $query->where(DB::raw('LOWER(TRIM(nama))'), strtolower(trim($sk->nama)))
                      ->where('school_id', $sk->school_id);
            }

            $deletedSkMatches = $query->get();
            $restoredSkFields = [];

            foreach ($deletedSkMatches as $deletedSk) {
                if (empty($sk->nomor_permohonan) && !empty($deletedSk->nomor_permohonan)) {
                    $sk->nomor_permohonan = $deletedSk->nomor_permohonan;
                    $restoredSkFields[] = 'Nomor Permohonan';
                }
                if (empty($sk->tanggal_permohonan) && !empty($deletedSk->tanggal_permohonan)) {
                    $sk->tanggal_permohonan = $deletedSk->tanggal_permohonan;
                    $restoredSkFields[] = 'Tanggal Permohonan';
                }
                if (empty($sk->surat_permohonan_url) && !empty($deletedSk->surat_permohonan_url)) {
                    $sk->surat_permohonan_url = $deletedSk->surat_permohonan_url;
                    $restoredSkFields[] = 'Surat Permohonan URL';
                }
            }

            if (count($restoredSkFields) > 0) {
                $sk->save();
                $recoveredSkFieldsCount++;
                $this->line("- Berhasil memulihkan [" . implode(', ', array_unique($restoredSkFields)) . "] untuk SK: {$sk->nama}");
            }
        }

        // === PART 3: DEDUPLICATE PENDING SK DOCUMENTS ===
        $this->info('');
        $this->info('Memulai proses pembersihan antrean SK ganda (Deduplikasi)...');
        
        // Find all teachers who have a printed SK (file_url is not null)
        $printedSks = SkDocument::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
            ->whereNotNull('file_url')
            ->where('file_url', '!=', '')
            ->whereNotIn('nomor_sk', ['REQ/%', 'DRAFT-%']) // Ensure it's a real SK number
            ->get();

        $deduplicatedCount = 0;

        foreach ($printedSks as $printedSk) {
            // Find unprinted (REQ/DRAFT) SKs for the same teacher and same jenis_sk
            $query = SkDocument::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
                ->where('id', '!=', $printedSk->id)
                ->where('jenis_sk', $printedSk->jenis_sk)
                ->where(function ($q) {
                    $q->whereNull('file_url')->orWhere('file_url', '')
                      ->orWhere('nomor_sk', 'like', 'REQ/%')
                      ->orWhere('nomor_sk', 'like', 'DRAFT-%');
                });
                
            if ($printedSk->teacher_id) {
                $query->where('teacher_id', $printedSk->teacher_id);
            } else {
                $query->where(DB::raw('LOWER(TRIM(nama))'), strtolower(trim($printedSk->nama)))
                      ->where('school_id', $printedSk->school_id);
            }

            $duplicateUnprinted = $query->get();

            foreach ($duplicateUnprinted as $dup) {
                $dup->delete(); // Soft delete the duplicate pending request
                $deduplicatedCount++;
                $this->line("- Menghapus SK Ganda di antrean untuk: {$dup->nama} ({$dup->jenis_sk})");
            }
        }

        $this->info('');
        $this->info("✅ PROSES SELESAI!");
        $this->info("Total Guru yang berhasil diselamatkan datanya: {$recoveredCount}");
        $this->info("Total Dokumen SK yang berhasil dikaitkan ulang ke guru: {$recoveredSkCount}");
        $this->info("Total Dokumen SK yang berhasil dipulihkan data permohonannya: {$recoveredSkFieldsCount}");
        $this->info("Total Antrean SK ganda yang berhasil dibersihkan: {$deduplicatedCount}");
    }
}
