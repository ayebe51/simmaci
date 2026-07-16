<?php

namespace App\Console\Commands;

use App\Models\Teacher;
use Illuminate\Console\Command;

/**
 * Artisan command: nim:check-gap
 *
 * Cek gap (nomor kosong) dalam rentang NIM tertentu.
 * Berguna untuk memverifikasi apakah logika gap-fill sudah benar.
 */
class CheckNimGap extends Command
{
    protected $signature = 'nim:check-gap
                            {--from=113403832 : NIM awal scan (default: 113403832)}
                            {--to=            : NIM akhir scan (default: NIM tertinggi aktif)}';

    protected $description = 'Cek gap NIM dalam rentang tertentu dan tampilkan daftar gap yang ditemukan';

    public function handle(): int
    {
        $fromNim = $this->option('from');
        $fromSeq = (int) substr($fromNim, 4);

        // Ambil semua NIM aktif dalam range
        $toNim = $this->option('to');

        $query = Teacher::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
            ->whereRaw("nomor_induk_maarif ~ '^[0-9]+$'")
            ->where('nomor_induk_maarif', 'like', '1134%')
            ->whereRaw("LENGTH(nomor_induk_maarif) = 9")
            ->whereNull('deleted_at');

        if ($toNim) {
            $query->whereRaw("CAST(nomor_induk_maarif AS BIGINT) BETWEEN ? AND ?", [(int) $fromNim, (int) $toNim]);
        } else {
            $query->whereRaw("CAST(nomor_induk_maarif AS BIGINT) >= ?", [(int) $fromNim]);
        }

        $nims = $query->orderByRaw("CAST(nomor_induk_maarif AS BIGINT) ASC")
            ->pluck('nomor_induk_maarif');

        if ($nims->isEmpty()) {
            $this->warn("Tidak ada NIM aktif mulai dari {$fromNim}.");
            $this->info("NIM berikutnya yang akan di-generate: {$fromNim}");
            return self::SUCCESS;
        }

        $maxNim = $nims->last();
        $maxSeq = (int) substr($maxNim, 4);
        $toSeq  = $toNim ? (int) substr($toNim, 4) : $maxSeq;

        $this->info("Range scan  : {$fromNim} – " . '1134' . str_pad($toSeq, 5, '0', STR_PAD_LEFT));
        $this->info("NIM tertinggi aktif: {$maxNim}");
        $this->info("Total NIM aktif di range: " . $nims->count());

        // Cari gap
        $nimSet = $nims->flip()->all();
        $gaps   = [];

        for ($seq = $fromSeq; $seq <= $toSeq; $seq++) {
            $candidate = '1134' . str_pad($seq, 5, '0', STR_PAD_LEFT);
            if (!array_key_exists($candidate, $nimSet)) {
                $gaps[] = $candidate;
            }
        }

        $this->info("Gap ditemukan: " . count($gaps));

        if (empty($gaps)) {
            $this->info("✅ Tidak ada gap — NIM berikutnya: " . '1134' . str_pad($maxSeq + 1, 5, '0', STR_PAD_LEFT));
        } else {
            $this->line("Gap pertama : <fg=yellow>" . $gaps[0] . "</>");
            $this->line("Gap terakhir: <fg=yellow>" . end($gaps) . "</>");
            $this->line("NIM berikutnya yang akan di-generate: <fg=green>" . $gaps[0] . "</>");

            if (count($gaps) <= 50) {
                $this->table(['#', 'NIM Gap'], array_map(
                    fn($i, $g) => [$i + 1, $g],
                    array_keys($gaps),
                    $gaps
                ));
            } else {
                $this->line("20 gap pertama: " . implode(', ', array_slice($gaps, 0, 20)));
                $this->line("... dan " . (count($gaps) - 20) . " lainnya.");
            }
        }

        return self::SUCCESS;
    }
}
