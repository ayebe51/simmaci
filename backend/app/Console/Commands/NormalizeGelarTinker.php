<?php

namespace App\Console\Commands;

use App\Services\NormalizationService;
use Illuminate\Console\Command;

class NormalizeGelarTinker extends Command
{
    protected $signature = 'tinker:normalize-gelar
                            {nama? : Nama guru yang akan dinormalisasi (opsional, jika kosong akan masuk mode interaktif)}
                            {--batch : Mode batch untuk normalisasi multiple nama sekaligus}';

    protected $description = 'Normalisasi gelar akademik pada nama guru (untuk digunakan via tinker atau CLI)';

    public function __construct(private NormalizationService $normalizationService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $nama = $this->argument('nama');
        $batch = $this->option('batch');

        if ($batch) {
            return $this->handleBatchMode();
        }

        if ($nama) {
            return $this->normalizeSingle($nama);
        }

        return $this->handleInteractiveMode();
    }

    /**
     * Normalisasi single nama dan tampilkan hasilnya
     */
    private function normalizeSingle(string $nama): int
    {
        $this->info('Input: ' . $nama);
        
        $normalized = $this->normalizationService->normalizeTeacherName($nama);
        
        $this->newLine();
        $this->line('Hasil normalisasi:');
        $this->line('<fg=green>' . $normalized . '</>');
        
        // Tampilkan breakdown
        $parsed = $this->normalizationService->parseAcademicDegreesPublic($nama);
        
        $this->newLine();
        $this->line('Breakdown:');
        
        if (!empty($parsed['prefix_degrees'])) {
            $this->line('  Gelar depan: <fg=cyan>' . implode(', ', $parsed['prefix_degrees']) . '</>');
        }
        
        $this->line('  Nama: <fg=yellow>' . mb_strtoupper($parsed['name'], 'UTF-8') . '</>');
        
        if (!empty($parsed['suffix_degrees'])) {
            $this->line('  Gelar belakang: <fg=cyan>' . implode(', ', $parsed['suffix_degrees']) . '</>');
        }

        return self::SUCCESS;
    }

    /**
     * Mode interaktif untuk normalisasi nama satu per satu
     */
    private function handleInteractiveMode(): int
    {
        $this->info('=== Mode Interaktif Normalisasi Gelar ===');
        $this->line('Ketik nama guru untuk dinormalisasi, atau "exit" untuk keluar.');
        $this->newLine();

        while (true) {
            $nama = $this->ask('Nama guru');

            if ($nama === null || strtolower(trim($nama)) === 'exit') {
                $this->info('Selesai.');
                break;
            }

            if (trim($nama) === '') {
                $this->warn('Nama tidak boleh kosong.');
                continue;
            }

            $this->newLine();
            $this->normalizeSingle($nama);
            $this->newLine();
            $this->line(str_repeat('─', 60));
            $this->newLine();
        }

        return self::SUCCESS;
    }

    /**
     * Mode batch untuk normalisasi multiple nama sekaligus
     */
    private function handleBatchMode(): int
    {
        $this->info('=== Mode Batch Normalisasi Gelar ===');
        $this->line('Masukkan nama-nama guru (satu per baris).');
        $this->line('Ketik "DONE" pada baris baru untuk memproses.');
        $this->newLine();

        $names = [];
        $lineNum = 1;

        while (true) {
            $input = $this->ask("Baris {$lineNum}");

            if ($input === null || strtoupper(trim($input)) === 'DONE') {
                break;
            }

            if (trim($input) !== '') {
                $names[] = $input;
                $lineNum++;
            }
        }

        if (empty($names)) {
            $this->warn('Tidak ada nama yang dimasukkan.');
            return self::SUCCESS;
        }

        $this->newLine();
        $this->info('Memproses ' . count($names) . ' nama...');
        $this->newLine();

        $results = [];
        foreach ($names as $nama) {
            $normalized = $this->normalizationService->normalizeTeacherName($nama);
            $results[] = [
                'input' => $nama,
                'output' => $normalized,
                'changed' => $nama !== $normalized,
            ];
        }

        // Tampilkan hasil dalam tabel
        $tableData = array_map(function ($result) {
            return [
                'Input' => $result['input'],
                'Output' => $result['output'],
                'Status' => $result['changed'] ? '<fg=green>✓ Berubah</>' : '<fg=gray>Tidak berubah</>',
            ];
        }, $results);

        $this->table(['Input', 'Output', 'Status'], $tableData);

        $changed = count(array_filter($results, fn($r) => $r['changed']));
        $unchanged = count($results) - $changed;

        $this->newLine();
        $this->info("Total: {$changed} berubah, {$unchanged} tidak berubah");

        return self::SUCCESS;
    }

    /**
     * Helper method untuk digunakan langsung dari tinker
     * 
     * Usage di tinker:
     *   Artisan::call('tinker:normalize-gelar', ['nama' => 'dr. ahmad fauzi s.pd'])
     *   
     * Atau untuk mendapatkan hasil langsung:
     *   app(NormalizationService::class)->normalizeTeacherName('dr. ahmad fauzi s.pd')
     */
    public static function normalize(string $nama): string
    {
        return app(NormalizationService::class)->normalizeTeacherName($nama);
    }

    /**
     * Helper method untuk parse degrees dari tinker
     * 
     * Usage di tinker:
     *   Artisan::call('tinker:normalize-gelar', ['nama' => 'ahmad s.pd.i m.ag'])
     */
    public static function parse(string $nama): array
    {
        return app(NormalizationService::class)->parseAcademicDegreesPublic($nama);
    }
}
