<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== DAFTAR SK DI MTs MA'ARIF WANAREJA (164) ===\n\n";

$sks = SkDocument::withoutGlobalScopes()
    ->where('school_id', 164)
    ->whereNull('deleted_at')
    ->get();

foreach ($sks as $sk) {
    echo "SK ID: {$sk->id}\n";
    echo "  Nama di SK: {$sk->nama}\n";
    echo "  Teacher ID di SK: " . ($sk->teacher_id ?? "NULL") . "\n";
    
    if ($sk->teacher_id) {
        $teacher = Teacher::withoutGlobalScopes()->withTrashed()->find($sk->teacher_id);
        if ($teacher) {
            echo "  Data Guru:\n";
            echo "    - Status: " . ($teacher->trashed() ? "TRASHED" : "AKTIF") . "\n";
            echo "    - School ID Guru: {$teacher->school_id}\n";
            echo "    - Unit Kerja Guru: {$teacher->unit_kerja}\n";
        } else {
            echo "  Data Guru: TIDAK DITEMUKAN SAMA SEKALI!\n";
        }
    }
    echo "--------------------------------------------------\n";
}
