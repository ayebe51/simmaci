<?php

/**
 * Script Pemeriksaan Data SK Kepala yang Sudah Terbit di SIMMACI
 * 
 * Penggunaan di VPS / Local:
 *   php cek_sk_kepala.php
 *   php cek_sk_kepala.php --with-trashed
 *   php cek_sk_kepala.php --all-tables
 */

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\HeadmasterTenure;
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

// Helper styling ANSI CLI
function c(string $text, string $color = '0'): string {
    return "\033[{$color}m{$text}\033[0m";
}

$args = $argv ?? [];
$withTrashed = in_array('--with-trashed', $args, true);
$checkAllTables = in_array('--all-tables', $args, true);

echo "\n" . c("=========================================================================", "1;37;44") . "\n";
echo c("          AUDIT & CEK DATA SK KEPALA YANG SUDAH TERBIT DI SIMMACI         ", "1;37;44") . "\n";
echo c("=========================================================================", "1;37;44") . "\n\n";

// 1. Ambil data dari headmaster_tenures
$query = $withTrashed 
    ? HeadmasterTenure::withoutTenantScope()->withTrashed()
    : HeadmasterTenure::withoutTenantScope();

$tenures = $query->orderBy('id', 'asc')->get();

echo c("🔍 Mengambil data dari tabel: ", "1;33") . c("headmaster_tenures", "1;36") . "\n";
echo "   Total record ditemukan : " . $tenures->count() . "\n\n";

$skItems = collect();

foreach ($tenures as $t) {
    $nomor = trim($t->nomor_sk ?? '');
    if (empty($nomor)) {
        continue;
    }

    $seq = null;
    if (preg_match('/^(\d+)\//', $nomor, $m)) {
        $seq = (int) $m[1];
    }

    $parts = explode('/', $nomor);
    $bulan = count($parts) >= 3 ? trim($parts[count($parts) - 2]) : '-';
    $tahun = count($parts) >= 2 ? trim(end($parts)) : '-';

    $skItems->push([
        'source'            => 'headmaster_tenures',
        'id'                => $t->id,
        'nomor_sk'          => $nomor,
        'seq_num'           => $seq,
        'seq_formatted'     => $seq !== null ? str_pad($seq, 4, '0', STR_PAD_LEFT) : 'INVALID',
        'bulan'             => $bulan,
        'tahun'             => $tahun,
        'nama'              => $t->teacher_name ?: ($t->teacher?->nama ?? '-'),
        'unit_kerja'        => $t->school_name ?: ($t->school?->nama ?? '-'),
        'periode'           => $t->periode ? "Ke-{$t->periode}" : '-',
        'tanggal_penetapan' => $t->tanggal_penetapan ?: ($t->created_at ? $t->created_at->format('Y-m-d') : '-'),
        'status'            => $t->status ?: '-',
        'is_deleted'        => !empty($t->deleted_at),
        'created_at'        => $t->created_at ? $t->created_at->format('Y-m-d H:i') : '-',
    ]);
}

// 2. Cek juga tabel sk_documents jika diminta atau jika headmaster_tenures kosong
if ($checkAllTables || $skItems->isEmpty()) {
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
        echo c("🔍 Memeriksa juga tabel sk_documents (ditemukan {$skDocs->count()} record):\n", "1;33");
        foreach ($skDocs as $d) {
            $nomor = trim($d->nomor_sk ?? '');
            if (empty($nomor) || str_starts_with($nomor, 'REQ/')) continue;

            $seq = null;
            if (preg_match('/^(\d+)\//', $nomor, $m)) {
                $seq = (int) $m[1];
            }
            $parts = explode('/', $nomor);
            $bulan = count($parts) >= 3 ? trim($parts[count($parts) - 2]) : '-';
            $tahun = count($parts) >= 2 ? trim(end($parts)) : '-';

            $skItems->push([
                'source'            => 'sk_documents',
                'id'                => $d->id,
                'nomor_sk'          => $nomor,
                'seq_num'           => $seq,
                'seq_formatted'     => $seq !== null ? str_pad($seq, 4, '0', STR_PAD_LEFT) : 'INVALID',
                'bulan'             => $bulan,
                'tahun'             => $tahun,
                'nama'              => $d->nama,
                'unit_kerja'        => $d->unit_kerja,
                'periode'           => '-',
                'tanggal_penetapan' => $d->tanggal_penetapan ?: '-',
                'status'            => $d->status,
                'is_deleted'        => !empty($d->deleted_at),
                'created_at'        => $d->created_at ? $d->created_at->format('Y-m-d H:i') : '-',
            ]);
        }
    }
}

if ($skItems->isEmpty()) {
    echo c("⚠️  Tidak ada data SK Kepala ditemukan di database.\n", "1;31");
    echo "Jika SIMMACI dijalankan di server VPS / Docker produksi, mohon jalankan script ini di dalam container backend server produksi.\n\n";
    exit(0);
}

// 3. Tampilkan Data
echo c("📑 DAFTAR SK KEPALA YANG SUDAH DITERBITKAN:\n", "1;32");
echo str_repeat("-", 105) . "\n";
printf("%-8s | %-32s | %-28s | %-12s | %-8s\n", "NO URUT", "NOMOR SK", "NAMA KEPALA", "TGL TETAP", "STATUS");
echo str_repeat("-", 105) . "\n";

$sorted = $skItems->sortBy([
    ['seq_num', 'asc'],
    ['tanggal_penetapan', 'asc']
]);

foreach ($sorted as $item) {
    $del = $item['is_deleted'] ? ' [DELETED]' : '';
    printf(
        "%-8s | %-32s | %-28s | %-12s | %-8s\n",
        $item['seq_formatted'],
        substr($item['nomor_sk'] . $del, 0, 32),
        substr($item['nama'], 0, 28),
        $item['tanggal_penetapan'],
        $item['status']
    );
    echo "         └── Madrasah: " . c($item['unit_kerja'], "0;36") . " | Periode: {$item['periode']} | Bulan: {$item['bulan']} | Th: {$item['tahun']}\n";
}
echo str_repeat("-", 105) . "\n\n";

// 4. Analisis Duplikasi (Nomor Sama)
$validSeqs = $skItems->filter(fn($x) => $x['seq_num'] !== null);
$duplicates = $validSeqs->groupBy('seq_num')->filter(fn($g) => $g->count() > 1);

echo c("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n", "0;34");
echo c("📊 HASIL ANALISIS KONSISTENSI & DUPLIKASI NOMOR:\n", "1;37");
echo c("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n", "0;34");

if ($duplicates->isNotEmpty()) {
    echo c("🚨 PERINGATAN: DITEMUKAN NOMOR URUT SK DUPLIKAT (NOMOR MERESET)!\n", "1;31");
    foreach ($duplicates as $seq => $group) {
        $pad = str_pad($seq, 4, '0', STR_PAD_LEFT);
        echo c("   👉 Nomor Urut [{$pad}] dipakai sebanyak {$group->count()} kali:\n", "1;33");
        foreach ($group as $g) {
            $del = $g['is_deleted'] ? ' [TERHAPUS]' : '';
            echo "      - ID #{$g['id']} | Nomor: " . c($g['nomor_sk'], "1;37") . " | {$g['nama']} ({$g['unit_kerja']}) | Tgl: {$g['tanggal_penetapan']}{$del}\n";
        }
    }
    echo "\n";
} else {
    echo c("✅ Tidak ditemukan nomor urut duplikat (semua nomor urut unik).\n\n", "1;32");
}

// 5. Analisis Gap
$allSeqs = $validSeqs->pluck('seq_num')->unique()->sort()->values();
$minSeq = $allSeqs->first();
$maxSeq = $allSeqs->last();
$seqSet = $allSeqs->flip()->all();

$gaps = [];
if ($minSeq !== null && $maxSeq !== null) {
    for ($s = 1; $s <= $maxSeq; $s++) {
        if (!array_key_exists($s, $seqSet)) {
            $gaps[] = str_pad($s, 4, '0', STR_PAD_LEFT);
        }
    }
}

if (!empty($gaps)) {
    echo c("⚠️  Ditemukan nomor lompat / gap (" . count($gaps) . " nomor):\n", "1;33");
    echo "   " . implode(', ', array_slice($gaps, 0, 30)) . (count($gaps) > 30 ? ' ... dan seterusnya' : '') . "\n\n";
} else {
    echo c("✅ Urutan nomor urut berjalan rapat dan kontinu (tidak ada gap).\n\n", "1;32");
}

// 6. Ringkasan per Bulan
echo c("📅 DISTRIBUSI PENOMORAN LINTAS BULAN:\n", "1;33");
$byMonthYear = $skItems->groupBy(fn($i) => ($i['tahun'] ?: '????') . '-' . ($i['bulan'] ?: '??'));
foreach ($byMonthYear->sortKeys() as $my => $monthItems) {
    $minM = $monthItems->filter(fn($x) => $x['seq_num'] !== null)->min('seq_num');
    $maxM = $monthItems->filter(fn($x) => $x['seq_num'] !== null)->max('seq_num');
    $minStr = $minM ? str_pad($minM, 4, '0', STR_PAD_LEFT) : '-';
    $maxStr = $maxM ? str_pad($maxM, 4, '0', STR_PAD_LEFT) : '-';
    echo "   • {$my} : " . count($monthItems) . " SK diterbitkan (Rentang nomor urut: {$minStr} s/d {$maxStr})\n";
}
echo "\n";

// 7. Rekomendasi
$nextSeq = ($maxSeq ?: 0) + 1;
$nextPad = str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
$curMonth = date('m');
$curYear = date('Y');
$formatNext = "{$nextPad}/PC.L/A.II/H-34.B/{$curMonth}/{$curYear}";

echo c("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n", "0;34");
echo c("💡 KESIMPULAN NOMOR BERIKUTNYA YANG HARUS DIGUNAKAN:\n", "1;32");
echo c("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n", "0;34");
echo " • Nomor urut tertinggi saat ini : " . c(($maxSeq ? str_pad($maxSeq, 4, '0', STR_PAD_LEFT) : '0000'), "1;33") . "\n";
echo " • Nomor urut berikutnya          : " . c($nextPad, "1;32") . " (wajib melanjutkan ini)\n";
echo " • Format lengkap bulan ini       : " . c($formatNext, "1;36") . "\n\n";
echo "Ingat: Meskipun bulan berganti (misal dari 10 ke 11 atau ke 12), nomor awal tetap melanjutkan {$nextPad}.\n\n";

