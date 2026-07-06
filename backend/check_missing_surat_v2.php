<?php

use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== CEK SK TANPA NOMOR & TANGGAL SURAT (V2) ===\n\n";

// Use whereRaw to bypass any Eloquent weirdness with dates
$query = SkDocument::withoutGlobalScopes()
    ->whereRaw("(nomor_permohonan IS NULL OR nomor_permohonan = '') OR (tanggal_permohonan IS NULL)");

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
