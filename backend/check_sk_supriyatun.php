<?php

use App\Models\SkDocument;

echo "=== CARI SK SUPRIYATUN ===\n";

$sks = SkDocument::withoutGlobalScopes()->withTrashed()->whereRaw("LOWER(nama) LIKE '%supriyatun%'")->get();

foreach ($sks as $sk) {
    $status = $sk->trashed() ? "[TERHAPUS]" : "[AKTIF]";
    echo "SK ID: {$sk->id} {$status}\n";
    echo "  Nama: {$sk->nama}\n";
    echo "  School ID: {$sk->school_id}\n";
    echo "  Nomor Permohonan: {$sk->nomor_permohonan}\n";
    echo "  Nomor SK: {$sk->nomor_sk}\n";
    echo "-------------------\n";
}
