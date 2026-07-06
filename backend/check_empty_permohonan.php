<?php

use App\Models\SkDocument;

echo "=== MENGECEK PENGAJUAN DENGAN NOMOR & TANGGAL SURAT KOSONG ===\n\n";

$query = SkDocument::withoutGlobalScopes()
    ->whereNull('deleted_at')
    ->where(function($q) {
        $q->whereNull('nomor_permohonan')
          ->orWhere('nomor_permohonan', '')
          ->orWhereNull('tanggal_permohonan');
    });

$count = $query->count();
$samples = $query->take(10)->get();

echo "Total pengajuan SK yang nomor/tanggal surat permohonannya kosong: {$count}\n\n";

if ($count > 0) {
    echo "Berikut adalah 10 sampel data teratas:\n";
    echo "---------------------------------------------------\n";
    foreach ($samples as $index => $sk) {
        $no = $index + 1;
        echo "{$no}. Nama: {$sk->nama}\n";
        echo "   Nomor SK         : {$sk->nomor_sk}\n";
        echo "   Status           : {$sk->status}\n";
        echo "   Nomor Permohonan : " . ($sk->nomor_permohonan ?: '(KOSONG)') . "\n";
        echo "   Tgl Permohonan   : " . ($sk->tanggal_permohonan ?: '(KOSONG)') . "\n";
        echo "---------------------------------------------------\n";
    }
}
