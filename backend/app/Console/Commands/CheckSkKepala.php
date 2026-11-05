<?php

namespace App\Console\Commands;

use App\Models\HeadmasterTenure;
use App\Models\SkDocument;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;

class CheckSkKepala extends Command
{
    protected $signature = 'sk:check-kepala
                            {--with-trashed : Sertakan data yang berstatus soft-deleted}
                            {--all-tables   : Cek juga di tabel sk_documents jika ada data lama}';

    protected $description = 'Periksa urutan nomor SK Kepala Madrasah, deteksi duplikasi akibat reset nomor, dan tentukan nomor berikutnya';

    public function handle(): int
    {
        $withTrashed = (bool) $this->option('with-trashed');
        $checkAllTables = (bool) $this->option('all-tables');

        $this->line("");
        $this->line("<bg=blue;fg=white;options=bold> ========================================================================= </>");
        $this->line("<bg=blue;fg=white;options=bold>           AUDIT & CEK URUTAN NOMOR SK KEPALA MADRASAH (SIMMACI)           </>");
        $this->line("<bg=blue;fg=white;options=bold> ========================================================================= </>");
        $this->line("");

        // 1. Ambil data dari HeadmasterTenure
        $query = $withTrashed 
            ? HeadmasterTenure::withoutTenantScope()->withTrashed()
            : HeadmasterTenure::withoutTenantScope();

        $tenures = $query->orderBy('id', 'asc')->get();

        $this->info("🔍 Mengambil data dari tabel: <fg=yellow>headmaster_tenures</>");
        $this->line("   Total record ditemukan : " . $tenures->count());

        $skItems = collect();

        foreach ($tenures as $t) {
            $nomor = trim($t->nomor_sk ?? '');
            if (empty($nomor)) {
                continue;
            }

            $parsed = $this->parseNomorSk($nomor);

            $skItems->push([
                'source'             => 'headmaster_tenures',
                'id'                 => $t->id,
                'nomor_sk'           => $nomor,
                'seq_num'            => $parsed['seq'],
                'seq_formatted'      => $parsed['seq'] ? str_pad($parsed['seq'], 4, '0', STR_PAD_LEFT) : 'INVALID',
                'bulan'              => $parsed['bulan'],
                'tahun'              => $parsed['tahun'],
                'nama'               => $t->teacher_name ?: ($t->teacher?->nama ?? '-'),
                'unit_kerja'         => $t->school_name ?: ($t->school?->nama ?? '-'),
                'periode'            => $t->periode ? "Ke-{$t->periode}" : '-',
                'tanggal_penetapan'  => $t->tanggal_penetapan ?: ($t->created_at ? $t->created_at->format('Y-m-d') : '-'),
                'status'             => $t->status ?: '-',
                'is_deleted'         => !empty($t->deleted_at),
                'created_at'         => $t->created_at ? $t->created_at->format('Y-m-d H:i') : '-',
            ]);
        }

        // 2. Jika opsi all-tables diaktifkan, cek juga sk_documents yang merupakan SK Kepala
        if ($checkAllTables) {
            $skDocQuery = $withTrashed
                ? SkDocument::withoutTenantScope()->withTrashed()
                : SkDocument::withoutTenantScope();

            $skDocs = $skDocQuery
                ->where(function($q) {
                    $q->where('nomor_sk', 'like', '%H-34.B%')
                      ->orWhere('jenis_sk', 'ilike', '%kepala%')
                      ->orWhere('jenis_sk', 'ilike', '%kamad%')
                      ->orWhere('jabatan', 'ilike', '%kepala%');
                })
                ->get();

            if ($skDocs->isNotEmpty()) {
                $this->info("🔍 Ditemukan {$skDocs->count()} record tambahan dari tabel: <fg=yellow>sk_documents</>");
                foreach ($skDocs as $d) {
                    $nomor = trim($d->nomor_sk ?? '');
                    if (empty($nomor) || str_starts_with($nomor, 'REQ/')) continue;

                    $parsed = $this->parseNomorSk($nomor);
                    $skItems->push([
                        'source'             => 'sk_documents',
                        'id'                 => $d->id,
                        'nomor_sk'           => $nomor,
                        'seq_num'            => $parsed['seq'],
                        'seq_formatted'      => $parsed['seq'] ? str_pad($parsed['seq'], 4, '0', STR_PAD_LEFT) : 'INVALID',
                        'bulan'              => $parsed['bulan'],
                        'tahun'              => $parsed['tahun'],
                        'nama'               => $d->nama,
                        'unit_kerja'         => $d->unit_kerja,
                        'periode'            => '-',
                        'tanggal_penetapan'  => $d->tanggal_penetapan ?: '-',
                        'status'             => $d->status,
                        'is_deleted'         => !empty($d->deleted_at),
                        'created_at'         => $d->created_at ? $d->created_at->format('Y-m-d H:i') : '-',
                    ]);
                }
            }
        }

        if ($skItems->isEmpty()) {
            $this->warn("⚠️  Belum ada data SK Kepala dengan nomor resmi yang tercatat di database.");
            $this->line("   (Pastikan data sudah terisi atau jika di server produksi, jalankan script di server terkait)");
            return self::SUCCESS;
        }

        // 3. Tampilkan Tabel Semua Data SK Kepala
        $this->line("");
        $this->info("📑 DAFTAR SELURUH SK KEPALA YANG SUDAH TERBIT:");
        
        $tableRows = [];
        $sortedItems = $skItems->sortBy([
            ['seq_num', 'asc'],
            ['id', 'asc']
        ]);

        foreach ($sortedItems as $idx => $item) {
            $delMarker = $item['is_deleted'] ? ' <fg=red>[DELETED]</>' : '';
            $tableRows[] = [
                $item['seq_formatted'],
                $item['nomor_sk'] . $delMarker,
                $item['nama'],
                $item['unit_kerja'],
                $item['periode'],
                $item['bulan'] ?? '-',
                $item['tahun'] ?? '-',
                $item['tanggal_penetapan'],
                $item['status']
            ];
        }

        $this->table(
            ['No Urut', 'Nomor SK Lengkap', 'Nama Kepala', 'Madrasah / Unit Kerja', 'Periode', 'Bulan', 'Tahun', 'Tgl Penetapan', 'Status'],
            $tableRows
        );

        // 4. Analisis Duplikasi Nomor
        $validSeqs = $skItems->filter(fn($x) => $x['seq_num'] !== null);
        $seqCounts = $validSeqs->groupBy('seq_num');
        $duplicates = $seqCounts->filter(fn($group) => $group->count() > 1);

        $this->line("");
        $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        $this->info("📊 HASIL ANALISIS KONSISTENSI PENOMORAN:");
        $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        if ($duplicates->isNotEmpty()) {
            $this->error("🚨 PERINGATAN: DITEMUKAN NOMOR SK DUPLIKAT (NOMOR MERESET):");
            foreach ($duplicates as $seq => $group) {
                $padSeq = str_pad($seq, 4, '0', STR_PAD_LEFT);
                $this->warn("   👉 Nomor Urut [{$padSeq}] digunakan sebanyak {$group->count()} kali:");
                foreach ($group as $g) {
                    $del = $g['is_deleted'] ? ' [SOFT-DELETED]' : '';
                    $this->line("      - ID #{$g['id']} ({$g['source']}): {$g['nomor_sk']} | {$g['nama']} ({$g['unit_kerja']}) | Tgl: {$g['tanggal_penetapan']}{$del}");
                }
            }
        } else {
            $this->info("✅ Tidak ditemukan nomor urut duplikat.");
        }

        // 5. Analisis Gap / Nomor Lompat
        $allSeqNumbers = $validSeqs->pluck('seq_num')->unique()->sort()->values();
        $minSeq = $allSeqNumbers->first();
        $maxSeq = $allSeqNumbers->last();

        $seqSet = $allSeqNumbers->flip()->all();
        $gaps = [];
        if ($minSeq !== null && $maxSeq !== null) {
            for ($s = 1; $s <= $maxSeq; $s++) {
                if (!array_key_exists($s, $seqSet)) {
                    $gaps[] = str_pad($s, 4, '0', STR_PAD_LEFT);
                }
            }
        }

        if (!empty($gaps)) {
            $this->warn("⚠️  Ditemukan nomor yang terlompati / gap (" . count($gaps) . " nomor):");
            $this->line("   " . implode(', ', array_slice($gaps, 0, 30)) . (count($gaps) > 30 ? ' ... dan seterusnya' : ''));
        } else {
            $this->info("✅ Urutan nomor urut berjalan berurutan tanpa ada nomor terlewat.");
        }

        // 6. Analisis Distribusi Lintas Bulan
        $this->line("");
        $this->info("📅 DISTRIBUSI PENERBITAN BERDASARKAN BULAN:");
        $byMonthYear = $skItems->groupBy(fn($i) => ($i['tahun'] ?: '????') . '-' . ($i['bulan'] ?: '??'));
        
        $monthRows = [];
        foreach ($byMonthYear->sortKeys() as $my => $itemsInMonth) {
            $minMonthSeq = $itemsInMonth->filter(fn($x) => $x['seq_num'] !== null)->min('seq_num');
            $maxMonthSeq = $itemsInMonth->filter(fn($x) => $x['seq_num'] !== null)->max('seq_num');
            $minStr = $minMonthSeq ? str_pad($minMonthSeq, 4, '0', STR_PAD_LEFT) : '-';
            $maxStr = $maxMonthSeq ? str_pad($maxMonthSeq, 4, '0', STR_PAD_LEFT) : '-';

            $monthRows[] = [
                $my,
                $itemsInMonth->count() . ' SK',
                $minStr . ' s/d ' . $maxStr
            ];
        }

        $this->table(['Tahun-Bulan', 'Jumlah Terbit', 'Rentang Nomor Urut'], $monthRows);

        // 7. Kesimpulan & Rekomendasi Nomor Berikutnya
        $nextSeq = ($maxSeq ?: 0) + 1;
        $nextSeqStr = str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
        $currentMonth = date('m');
        $currentYear = date('Y');
        $recommendedNext = "{$nextSeqStr}/PC.L/A.II/H-34.B/{$currentMonth}/{$currentYear}";

        $this->line("");
        $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        $this->info("💡 KESIMPULAN & REKOMENDASI NOMOR BERIKUTNYA:");
        $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        $this->line(" • Nomor urut terakhir yang terdaftar di sistem : <fg=yellow;options=bold>" . ($maxSeq ? str_pad($maxSeq, 4, '0', STR_PAD_LEFT) : '0000') . "</>");
        $this->line(" • Nomor urut berikutnya yang HARUS digunakan   : <fg=green;options=bold>{$nextSeqStr}</>");
        $this->line(" • Rekomendasi Format Lengkap SK Berikutnya     : <fg=cyan;options=bold>{$recommendedNext}</>");
        $this->line("");
        $this->comment("Catatan: Meskipun bulan berubah dari {$currentMonth} ke bulan berikutnya, nomor 4-digit di awal");
        $this->comment("         tetap WAJIB melanjutkan dari {$nextSeqStr}, tidak boleh kembali ke 0001.");
        $this->line("");

        return self::SUCCESS;
    }

    /**
     * Parse format nomor SK:
     * Contoh: 0002/PC.L/A.II/H-34.B/11/2026
     */
    private function parseNomorSk(string $nomor): array
    {
        $seq = null;
        $bulan = null;
        $tahun = null;

        // Ambil nomor urut paling depan
        if (preg_match('/^(\d+)\//', $nomor, $m)) {
            $seq = (int) $m[1];
        }

        $parts = explode('/', $nomor);
        $totalParts = count($parts);

        if ($totalParts >= 2) {
            // Tahun biasanya segmen paling akhir (misal 2026)
            $lastPart = trim(end($parts));
            if (preg_match('/^(20\d{2})$/', $lastPart)) {
                $tahun = $lastPart;
            }

            // Bulan biasanya segmen sebelum tahun
            if ($totalParts >= 3) {
                $secondLast = trim($parts[$totalParts - 2]);
                $bulan = $secondLast;
            }
        }

        return [
            'seq'   => $seq,
            'bulan' => $bulan,
            'tahun' => $tahun,
        ];
    }
}

