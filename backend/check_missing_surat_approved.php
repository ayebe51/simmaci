<?php

use App\Models\SkDocument;

echo "=== DAFTAR SEMUA SK 'APPROVED' TANPA NOMOR & TANGGAL SURAT ===\n\n";

$query = SkDocument::withoutGlobalScopes()
    ->where('status', 'approved')
    ->where(function ($q) {
        $q->whereNull('nomor_permohonan')
          ->orWhere('nomor_permohonan', '')
          ->orWhereNull('tanggal_permohonan');
    });

$sks = $query->get();
$total = $sks->count();
echo "Total SK 'Approved' yang metadatanya tidak lengkap: {$total}\n\n";

if ($total > 0) {
    foreach ($sks as $index => $sk) {
        $schoolName = $sk->school ? $sk->school->nama : ($sk->unit_kerja ?? 'TIDAK DIKETAHUI');
        $no = $index + 1;
        echo "{$no}. SK ID: {$sk->id} | Nama: {$sk->nama}\n";
        echo "   - Sekolah: {$schoolName} (School ID: " . ($sk->school_id ?? 'KOSONG') . ")\n";
        echo "   - Nomor Surat: " . ($sk->nomor_permohonan ?: "[KOSONG]") . "\n";
        echo "   - Tanggal Surat: " . ($sk->tanggal_permohonan ?: "[KOSONG]") . "\n";
        echo "--------------------------------------------------\n";
    }
} else {
    echo "Luar biasa! Tidak ada SK dengan status 'approved' yang metadatanya kosong.\n";
}
