<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

class SyncSkNames extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sk:sync-names {--dry-run : Lakukan simulasi tanpa menyimpan perubahan ke database}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync nama di sk_documents dengan nama lengkap beserta gelar di teachers';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $isDryRun = $this->option('dry-run');

        if ($isDryRun) {
            $this->warn('--- DRY RUN MODE AKTIF --- (Tidak ada data yang diubah di database)');
        }

        $this->info('Memulai sinkronisasi nama pengajuan SK dengan profil guru (beserta gelar)...');
        
        $sks = SkDocument::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
            ->whereNotNull('teacher_id')
            ->with('teacher:id,nama,school_id,unit_kerja')
            ->get();
            
        $updatedCount = 0;
        
        foreach ($sks as $sk) {
            if ($sk->teacher && $sk->teacher->nama) {
                // Check if names are different
                if ($sk->nama !== $sk->teacher->nama) {
                    $oldName = $sk->nama;
                    $newName = $sk->teacher->nama;

                    // Safeguard 1: Pastikan guru dan dokumen SK berada di Unit Kerja / Sekolah yang sama
                    // Jika beda sekolah, maka kemungkinan besar teacher_id ini merujuk ke orang yang salah
                    if ($sk->school_id && $sk->teacher->school_id && $sk->school_id !== $sk->teacher->school_id) {
                        $this->warn("- [ANOMALI] Dilewati: {$oldName} (SK) beda unit kerja (sekolah) dengan {$newName} (Teacher).");
                        continue;
                    }

                    // Safeguard 2: Cek kemiripan nama untuk mencegah salah timpa orang yang berbeda di dalam sekolah yang sama
                    similar_text(strtolower(trim($oldName)), strtolower(trim($newName)), $similarityPercent);
                    if ($similarityPercent < 40) {
                        $this->warn("- [ANOMALI] Dilewati: {$oldName} (SK) sangat berbeda dengan {$newName} (Teacher). Cek kebenaran teacher_id!");
                        continue;
                    }
                    
                    $sk->nama = $newName;
                    
                    if (!$isDryRun) {
                        $sk->save();
                    }
                    $updatedCount++;
                    
                    $this->line("- " . ($isDryRun ? "[DRY RUN] Akan mengupdate: " : "Mengupdate: ") . "{$oldName} -> {$newName}");
                }
            }
        }
        
        $this->info('');
        $this->info("✅ PROSES SELESAI!");
        
        if ($isDryRun) {
            $this->info("Total data SK yang BISA disinkronkan namanya: {$updatedCount}");
        } else {
            $this->info("Total data SK yang berhasil disinkronkan namanya: {$updatedCount}");
        }
    }
}
