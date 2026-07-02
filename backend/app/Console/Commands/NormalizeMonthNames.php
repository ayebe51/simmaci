<?php

namespace App\Console\Commands;

use App\Models\Teacher;
use App\Models\SkDocument;
use App\Services\NormalizationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Normalisasi penulisan nama bulan yang tidak baku pada kolom tanggal teks.
 *
 * Target kolom:
 *  - teachers.tmt            — sering berisi "01 Nopember 2012" atau "01 Pebruari 2008"
 *  - sk_documents.tanggal_penetapan — umumnya sudah ISO, tapi cek juga
 *
 * Daftar ejaan tidak baku yang dikoreksi:
 *  - Nopember  → November
 *  - Pebruari  → Februari
 *  - Agustus   → (sudah baku, tidak perlu)
 *  - Oktober   → (sudah baku)
 *  - Desember  → (sudah baku)
 *  dan lainnya
 */
class NormalizeMonthNames extends Command
{
    protected $signature   = 'data:normalize-months
                                {--dry-run : Tampilkan rencana tanpa menyimpan}
                                {--teachers-only : Hanya proses tabel teachers}
                                {--sk-only : Hanya proses tabel sk_documents}';

    protected $description = 'Normalisasi ejaan nama bulan tidak baku (Nopember→November, Pebruari→Februari, dll) pada kolom tanggal teks';

    /**
     * Peta ejaan tidak baku → ejaan baku.
     * Key: lowercase, Value: ejaan baku dengan huruf kapital di awal.
     */
    private const MONTH_ALIASES = [
        // Ejaan tidak baku Indonesia
        'nopember'  => 'November',
        'pebruari'  => 'Februari',
        // Ejaan bahasa Inggris yang kadang muncul
        'january'   => 'Januari',
        'february'  => 'Februari',
        'march'     => 'Maret',
        'may'       => 'Mei',
        'june'      => 'Juni',
        'july'      => 'Juli',
        'august'    => 'Agustus',
        'october'   => 'Oktober',
        'december'  => 'Desember',
        // Singkatan tidak baku
        'nop'       => 'Nov',
        'peb'       => 'Feb',
        'ags'       => 'Agust',
    ];

    private NormalizationService $norm;
    private int $totalFixed = 0;
    private int $totalSkipped = 0;

    public function __construct(NormalizationService $norm)
    {
        parent::__construct();
        $this->norm = $norm;
    }

    public function handle(): int
    {
        $isDryRun    = $this->option('dry-run');
        $teachersOnly = $this->option('teachers-only');
        $skOnly       = $this->option('sk-only');

        if ($isDryRun) {
            $this->warn('(DRY-RUN: tidak ada perubahan yang disimpan)');
        }

        if (!$skOnly) {
            $this->processTeachers($isDryRun);
        }

        if (!$teachersOnly) {
            $this->processSkDocuments($isDryRun);
        }

        $this->newLine();
        $this->info("Selesai: <fg=green>{$this->totalFixed}</> diperbaiki, <fg=yellow>{$this->totalSkipped}</> tidak perlu perubahan.");

        return 0;
    }

    // ── Teachers ──────────────────────────────────────────────────────────────

    private function processTeachers(bool $isDryRun): void
    {
        $this->info('── Teachers: normalisasi kolom tmt ──────────────────────────────');

        // Hanya ambil record yang tmtnya berisi nama bulan (bukan ISO YYYY-MM-DD)
        $teachers = Teacher::withoutGlobalScope(\App\Traits\HasTenantScope::class)
            ->whereNotNull('tmt')
            ->where('tmt', 'not like', '____-__-__%')   // bukan format ISO
            ->get(['id', 'tmt', 'nama', 'school_id']);

        $this->line("  Ditemukan <fg=yellow>{$teachers->count()}</> guru dengan TMT non-ISO.");

        foreach ($teachers as $teacher) {
            $original = $teacher->tmt;
            $normalized = $this->normalizeDateText($original);

            if ($normalized === $original) {
                $this->totalSkipped++;
                continue;
            }

            // Coba parse ke ISO untuk validasi — jika gagal, skip
            $parsed = $this->norm->parseIndonesianDate($normalized);

            $this->line(sprintf(
                '  <fg=%s>%s</> [guru #%d %s]  "%s" → "%s"%s',
                $parsed ? 'green' : 'red',
                $parsed ? '✔' : '✘',
                $teacher->id,
                $teacher->nama,
                $original,
                $normalized,
                $parsed ? " (<fg=cyan>{$parsed}</>)" : ' (gagal parse, skip)'
            ));

            if (!$parsed) {
                $this->totalSkipped++;
                continue;
            }

            if (!$isDryRun) {
                $teacher->update(['tmt' => $parsed]);
            }

            $this->totalFixed++;
        }
    }

    // ── SK Documents ─────────────────────────────────────────────────────────

    private function processSkDocuments(bool $isDryRun): void
    {
        $this->info('── SK Documents: normalisasi kolom tanggal_penetapan ─────────────');

        $sks = SkDocument::withoutGlobalScope(\App\Traits\HasTenantScope::class)
            ->whereNotNull('tanggal_penetapan')
            ->where('tanggal_penetapan', 'not like', '____-__-__%')
            ->get(['id', 'nomor_sk', 'tanggal_penetapan']);

        $this->line("  Ditemukan <fg=yellow>{$sks->count()}</> SK dengan tanggal non-ISO.");

        foreach ($sks as $sk) {
            $original = $sk->tanggal_penetapan;
            $normalized = $this->normalizeDateText($original);

            if ($normalized === $original) {
                $this->totalSkipped++;
                continue;
            }

            $parsed = $this->norm->parseIndonesianDate($normalized);

            $this->line(sprintf(
                '  <fg=%s>%s</> [SK %s] "%s" → "%s"%s',
                $parsed ? 'green' : 'red',
                $parsed ? '✔' : '✘',
                $sk->nomor_sk,
                $original,
                $normalized,
                $parsed ? " (<fg=cyan>{$parsed}</>)" : ' (gagal parse, skip)'
            ));

            if (!$parsed) {
                $this->totalSkipped++;
                continue;
            }

            if (!$isDryRun) {
                DB::table('sk_documents')
                    ->where('id', $sk->id)
                    ->update(['tanggal_penetapan' => $parsed]);
            }

            $this->totalFixed++;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Ganti ejaan bulan tidak baku dalam string tanggal teks.
     * Contoh: "01 Nopember 2012" → "01 November 2012"
     */
    private function normalizeDateText(string $val): string
    {
        foreach (self::MONTH_ALIASES as $alias => $correct) {
            // Match kata utuh, case-insensitive
            $pattern = '/\b' . preg_quote($alias, '/') . '\b/i';
            $replaced = preg_replace($pattern, $correct, $val);
            if ($replaced !== $val) {
                return $replaced;
            }
        }
        return $val;
    }
}
