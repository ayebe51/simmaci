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
        
        // Get schools that have empty jenjang OR are RA but empty status_jamiyyah
        $schools = DB::table('schools')
            ->where(function($q) {
                $q->whereNull('jenjang')
                  ->orWhere('jenjang', '');
            })
            ->orWhere(function($q) {
                $q->where('jenjang', 'RA')
                  ->where(function($q2) {
                      $q2->whereNull('status_jamiyyah')
                         ->orWhere('status_jamiyyah', '')
                         ->orWhere('status_jamiyyah', '!=', "Jam'iyyah");
                  });
            })
            ->select('id', 'nama', 'jenjang', 'status_jamiyyah')
            ->get();
        
        $this->info("Found {$schools->count()} schools with empty jenjang");
        
        $updated = 0;
        $notDetected = 0;
        
        $progressBar = $this->output->createProgressBar($schools->count());
        $progressBar->start();
        
        foreach ($schools as $school) {
            $nama = strtoupper($school->nama);
            $jenjang = $school->jenjang; // Keep existing jenjang if not empty
            
            // Detect jenjang from school name if it's empty
            if (empty($jenjang)) {
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
            } elseif (preg_match('/\bRA\b|\bR A\b|RAUDHATUL|RAUDATUL|TK\b|TAMAN KANAK|PAUD\b|\bBA\b|BUSTHANUL|BUSTANUL/', $nama)) {
                $jenjang = 'RA';
            }
            } // Close if (empty($jenjang))
            
            if ($jenjang) {
                $updateData = ['jenjang' => $jenjang];
                if ($jenjang === 'RA') {
                    $updateData['status_jamiyyah'] = "Jam'iyyah";
                }
                
                DB::table('schools')
                    ->where('id', $school->id)
                    ->update($updateData);
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
                    WHEN LOWER(jenjang) LIKE '%ra%' OR LOWER(jenjang) LIKE '%tk%' OR LOWER(jenjang) LIKE '%paud%' THEN 'tk_ra'
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
