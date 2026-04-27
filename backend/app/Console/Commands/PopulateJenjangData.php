<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PopulateJenjangData extends Command
{
    protected $signature = 'schools:populate-jenjang';
    protected $description = 'Populate jenjang field for existing schools based on school name';

    public function handle()
    {
        $this->info('Starting jenjang population...');
        
        // Get schools with empty jenjang
        $schools = DB::table('schools')
            ->whereNull('jenjang')
            ->orWhere('jenjang', '')
            ->select('id', 'nama')
            ->get();
        
        $this->info("Found {$schools->count()} schools with empty jenjang");
        
        $updated = 0;
        $notDetected = 0;
        
        $progressBar = $this->output->createProgressBar($schools->count());
        $progressBar->start();
        
        foreach ($schools as $school) {
            $nama = strtoupper($school->nama);
            $jenjang = null;
            
            // Detect jenjang from school name
            if (preg_match('/\bMI\b|MADRASAH IBTIDAIYAH|IBTIDAIYAH/', $nama)) {
                $jenjang = 'MI';
            } elseif (preg_match('/\bSD\b|SEKOLAH DASAR/', $nama)) {
                $jenjang = 'SD';
            } elseif (preg_match('/MTS|MT S|MADRASAH TSANAWIYAH|TSANAWIYAH/', $nama)) {
                $jenjang = 'MTs';
            } elseif (preg_match('/\bSMP\b|SEKOLAH MENENGAH PERTAMA/', $nama)) {
                $jenjang = 'SMP';
            } elseif (preg_match('/\bMA\b\s|MADRASAH ALIYAH/', $nama)) {
                $jenjang = 'MA';
            } elseif (preg_match('/\bSMA\b|SEKOLAH MENENGAH ATAS/', $nama)) {
                $jenjang = 'SMA';
            } elseif (preg_match('/\bSMK\b|SEKOLAH MENENGAH KEJURUAN/', $nama)) {
                $jenjang = 'SMK';
            }
            
            if ($jenjang) {
                DB::table('schools')
                    ->where('id', $school->id)
                    ->update(['jenjang' => $jenjang]);
                $updated++;
            } else {
                $notDetected++;
                $this->newLine();
                $this->warn("Not detected: {$school->nama}");
            }
            
            $progressBar->advance();
        }
        
        $progressBar->finish();
        $this->newLine(2);
        
        $this->info("=== SUMMARY ===");
        $this->info("Updated: {$updated}");
        $this->info("Not detected: {$notDetected}");
        
        // Show distribution
        $stats = DB::table('schools')
            ->selectRaw("
                CASE
                    WHEN LOWER(jenjang) LIKE '%mi%' OR LOWER(jenjang) LIKE '%sd%' THEN 'mi_sd'
                    WHEN LOWER(jenjang) LIKE '%mts%' OR LOWER(jenjang) LIKE '%smp%' THEN 'mts_smp'
                    WHEN LOWER(jenjang) LIKE '%ma%' OR LOWER(jenjang) LIKE '%sma%' OR LOWER(jenjang) LIKE '%smk%' THEN 'ma_sma_smk'
                    WHEN jenjang IS NULL OR jenjang = '' THEN 'undefined'
                    ELSE 'lainnya'
                END as category,
                COUNT(*) as count
            ")
            ->groupBy('category')
            ->get();
        
        $this->newLine();
        $this->info("=== JENJANG DISTRIBUTION ===");
        foreach ($stats as $stat) {
            $this->line("{$stat->category}: {$stat->count}");
        }
        
        return 0;
    }
}
