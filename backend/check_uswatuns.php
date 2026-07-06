<?php

use App\Models\Teacher;

$t1 = Teacher::where('nomor_induk_maarif', '113401967')->first();
echo "T1 (NIM 113401967):\n";
echo "  - school_id: " . ($t1 ? $t1->school_id : 'NOT FOUND') . "\n";
echo "  - unit_kerja: " . ($t1 ? $t1->unit_kerja : 'NOT FOUND') . "\n";

$t2 = Teacher::where('nomor_induk_maarif', '113404073')->first();
echo "T2 (NIM 113404073):\n";
echo "  - school_id: " . ($t2 ? $t2->school_id : 'NOT FOUND') . "\n";
echo "  - unit_kerja: " . ($t2 ? $t2->unit_kerja : 'NOT FOUND') . "\n";
