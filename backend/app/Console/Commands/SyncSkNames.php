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
    protected $signature = 'sk:sync-names';

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
        $this->info('Memulai sinkronisasi nama pengajuan SK dengan profil guru (beserta gelar)...');
        
        $sks = SkDocument::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
            ->whereNotNull('teacher_id')
            ->with('teacher:id,nama')
            ->get();
            
        $updatedCount = 0;
        
        foreach ($sks as $sk) {
            if ($sk->teacher && $sk->teacher->nama) {
                // Check if names are different
                if ($sk->nama !== $sk->teacher->nama) {
                    $oldName = $sk->nama;
                    $sk->nama = $sk->teacher->nama;
                    $sk->save();
                    $updatedCount++;
                    
                    $this->line("- Mengupdate: {$oldName} -> {$sk->teacher->nama}");
                }
            }
        }
        
        $this->info('');
        $this->info("✅ PROSES SELESAI!");
        $this->info("Total data SK yang berhasil disinkronkan namanya: {$updatedCount}");
    }
}
