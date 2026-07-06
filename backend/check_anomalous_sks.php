<?php

use App\Models\SkDocument;
use App\Models\School;

echo "=== CEK SK ANEH ===\n\n";

$sks = SkDocument::withoutGlobalScopes()
    ->whereIn('id', [658, 1399, 1190, 1067])
    ->get();

foreach ($sks as $sk) {
    echo "SK ID: {$sk->id}\n";
    echo "  Nama di SK: {$sk->nama}\n";
    echo "  Nomor SK: {$sk->nomor_sk}\n";
    echo "  School ID di tabel SK: {$sk->school_id}\n";
    echo "  Teacher ID di tabel SK: {$sk->teacher_id}\n";
    echo "  Dibuat pada: {$sk->created_at}\n";
    echo "  Diupdate pada: {$sk->updated_at}\n";
    
    $school = School::find($sk->school_id);
    echo "  Nama Sekolah tujuan: " . ($school ? $school->nama : "TIDAK DITEMUKAN") . "\n";
    echo "--------------------------------------------------\n";
}
