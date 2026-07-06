<?php

use App\Models\Teacher;

echo "=== CARI GURU SUPRIYATUN ===\n";
$teachers = Teacher::withoutGlobalScopes()->withTrashed()->whereRaw("LOWER(nama) LIKE '%supriyatun%'")->get();

foreach ($teachers as $t) {
    $status = $t->trashed() ? "[TERHAPUS]" : "[AKTIF]";
    echo "ID: {$t->id} {$status}\n";
    echo "  Nama: {$t->nama}\n";
    echo "  School ID di DB: {$t->school_id}\n";
    echo "  Unit Kerja Text: {$t->unit_kerja}\n";
    echo "  NIM: " . ($t->nomor_induk_maarif ?: 'KOSONG') . "\n";
    echo "-------------------\n";
}
