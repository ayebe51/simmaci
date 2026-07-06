<?php

use App\Models\SkDocument;

echo "=== CEK SK TANPA NOMOR & TANGGAL SURAT ===\n\n";

// Query for SKs that are missing BOTH or EITHER of nomor_permohonan / tanggal_permohonan
$query = SkDocument::withoutGlobalScopes()
    ->where(function ($q) {
        $q->whereNull('nomor_permohonan')
          ->orWhere('nomor_permohonan', '')
          ->orWhereNull('tanggal_permohonan');
    });

$total = $query->count();
echo "Total Pengajuan SK yang tidak lengkap (Nomor/Tanggal kosong): {$total}\n\n";

if ($total > 0) {
    echo "Menampilkan 10 data teratas:\n";
    $sks = $query->limit(10)->get();
    
    foreach ($sks as $sk) {
        $schoolName = $sk->school ? $sk->school->nama : ($sk->unit_kerja ?? 'TIDAK DIKETAHUI');
        echo "SK ID: {$sk->id}\n";
        echo "  - Nama Guru: {$sk->nama}\n";
        echo "  - Asal Sekolah: {$schoolName} (School ID: " . ($sk->school_id ?? 'KOSONG') . ")\n";
        echo "  - Status SK: {$sk->status}\n";
        echo "  - Nomor Surat: " . ($sk->nomor_permohonan ?: "[KOSONG]") . "\n";
        echo "  - Tanggal Surat: " . ($sk->tanggal_permohonan ?: "[KOSONG]") . "\n";
        echo "--------------------------------------------------\n";
    }
}
