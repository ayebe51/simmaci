<?php

use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "Memulai update tahun_ajaran untuk SK yang sudah approved...\n";

// Cek jumlah data yang akan diupdate
$stats = DB::table('sk_documents')
    ->whereNull('tahun_ajaran')
    ->whereIn('status', ['approved', 'active', 'Approved', 'Active'])
    ->whereNull('deleted_at')
    ->selectRaw('EXTRACT(YEAR FROM created_at) as tahun_buat, COUNT(*) as jumlah_sk')
    ->groupByRaw('EXTRACT(YEAR FROM created_at)')
    ->orderByRaw('EXTRACT(YEAR FROM created_at)')
    ->get();

echo "Distribusi data yang akan diupdate:\n";
foreach ($stats as $stat) {
    $tapel = $stat->tahun_buat . '/' . ($stat->tahun_buat + 1);
    echo "- Tahun {$stat->tahun_buat} (akan diisi {$tapel}): {$stat->jumlah_sk} SK\n";
}

$total = $stats->sum('jumlah_sk');
if ($total == 0) {
    echo "Tidak ada SK yang perlu diupdate.\n";
    exit;
}

echo "Total: {$total} SK\n\n";

// Lakukan update
$affected = DB::table('sk_documents')
    ->whereNull('tahun_ajaran')
    ->whereIn('status', ['approved', 'active', 'Approved', 'Active'])
    ->whereNull('deleted_at')
    ->update([
        'tahun_ajaran' => DB::raw("EXTRACT(YEAR FROM created_at)::text || '/' || (EXTRACT(YEAR FROM created_at) + 1)::text")
    ]);

echo "Update selesai! Berhasil memperbarui {$affected} SK.\n";
