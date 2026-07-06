<?php

use App\Models\Teacher;
use App\Models\SkDocument;

echo "=== CEK KHALIMATUS SA'DIYAH ===\n";

$teacher = Teacher::withoutGlobalScopes()->whereRaw("LOWER(nama) LIKE '%khalimatus%'")->first();
if ($teacher) {
    echo "GURU:\n";
    echo "  ID: {$teacher->id}\n";
    echo "  Nama: {$teacher->nama}\n";
    echo "  Unit Kerja: {$teacher->unit_kerja}\n";
    echo "  School ID: {$teacher->school_id}\n";
}

$sks = SkDocument::withoutGlobalScopes()->whereRaw("LOWER(nama) LIKE '%khalimatus%'")->get();
foreach ($sks as $sk) {
    echo "\nSK:\n";
    echo "  ID: {$sk->id}\n";
    echo "  Nama di SK: {$sk->nama}\n";
    echo "  School ID di SK: {$sk->school_id}\n";
    echo "  Teacher ID di SK: {$sk->teacher_id}\n";
}
