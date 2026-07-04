<?php
use App\Models\SkDocument;

$d = SkDocument::onlyTrashed()
    ->orderBy('deleted_at', 'desc')
    ->limit(500)
    ->get(['id', 'nama', 'unit_kerja', 'jenis_sk', 'nomor_sk', 'file_url', 'deleted_at']);

$withFile = $d->filter(fn($x) => $x->file_url)->count();
$withoutFile = $d->filter(fn($x) => !$x->file_url)->count();

echo 'Total SK terhapus: ' . $d->count() . PHP_EOL;
echo '======================================' . PHP_EOL;
echo 'Yang sudah ada FILE (tercetak): ' . $withFile . PHP_EOL;
echo 'Yang belum ada FILE (antrean) : ' . $withoutFile . PHP_EOL;
echo '======================================' . PHP_EOL;
foreach ($d->take(100) as $sk) {
    $hasFile = $sk->file_url ? 'ADA FILE' : 'KOSONG';
    echo '[' . $sk->deleted_at . '] ' . $sk->nama . ' | ' . $sk->unit_kerja . ' | ' . $sk->nomor_sk . ' | ' . $hasFile . PHP_EOL;
}
