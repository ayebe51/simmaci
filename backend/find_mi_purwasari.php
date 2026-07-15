<?php

use App\Models\School;

echo "=== MENCARI SCHOOL ID MI MA'ARIF PURWASARI ===\n";

$schools = School::whereRaw("LOWER(nama) LIKE '%purwasari%'")->get();
foreach ($schools as $s) {
    echo "ID: {$s->id} | Nama: {$s->nama}\n";
}
