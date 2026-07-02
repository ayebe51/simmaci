<?php

namespace App\Console\Commands;

use App\Models\Teacher;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AnalyzeNim extends Command
{
    protected $signature = 'data:analyze-nim';
    protected $description = 'Export teachers without NIM and analyze NIM gap';

    public function handle()
    {
        // 1. Export teachers without NIM
        $teachersNoNim = Teacher::withoutGlobalScope(\App\Traits\HasTenantScope::class)
            ->whereNull('nomor_induk_maarif')
            ->orWhere('nomor_induk_maarif', '')
            ->get(['id', 'nama', 'unit_kerja', 'kecamatan']);
            
        $csv = fopen(base_path('guru_tanpa_nim.csv'), 'w');
        fputcsv($csv, ['ID', 'Nama', 'Unit Kerja', 'Kecamatan']);
        foreach ($teachersNoNim as $t) {
            fputcsv($csv, [$t->id, $t->nama, $t->unit_kerja, $t->kecamatan]);
        }
        fclose($csv);
        $this->info("Exported {$teachersNoNim->count()} teachers without NIM to guru_tanpa_nim.csv");

        // 2. Analyze NIM distribution
        $teachersWithNim = Teacher::withoutGlobalScope(\App\Traits\HasTenantScope::class)
            ->whereNotNull('nomor_induk_maarif')
            ->where('nomor_induk_maarif', '!=', '')
            ->pluck('nomor_induk_maarif');
            
        $nimNumbers = [];
        foreach ($teachersWithNim as $nim) {
            // Asumsi NIM punya format tertentu misalnya berakhiran angka urut 4 digit.
            // Atau coba ekstrak digit-digit di bagian tertentu.
            // Let's just collect all and show sample if we don't know the exact format.
            // If NIM is purely numeric or ends with number:
            if (preg_match('/(\d+)$/', $nim, $matches)) {
                $nimNumbers[] = (int) $matches[1];
            }
        }
        
        sort($nimNumbers);
        
        $this->info("Found " . count($nimNumbers) . " numeric NIMs.");
        
        if (count($nimNumbers) > 0) {
            $this->info("Min: " . $nimNumbers[0]);
            $this->info("Max: " . $nimNumbers[count($nimNumbers) - 1]);
            
            // Find gaps
            $gaps = [];
            for ($i = 1; $i < count($nimNumbers); $i++) {
                $diff = $nimNumbers[$i] - $nimNumbers[$i-1];
                if ($diff > 1 && $diff < 50000) { // filter out massive jumps that might just be different formats
                    $gaps[] = [
                        'from' => $nimNumbers[$i-1],
                        'to' => $nimNumbers[$i],
                        'size' => $diff - 1
                    ];
                }
            }
            
            usort($gaps, function($a, $b) { return $b['size'] <=> $a['size']; });
            
            $this->info("Top 10 Largest Gaps:");
            $count = 0;
            foreach ($gaps as $gap) {
                if ($count++ >= 10) break;
                $this->info("Gap size {$gap['size']}: from {$gap['from']} to {$gap['to']}");
            }
        }
    }
}
