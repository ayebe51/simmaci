<?php

use App\Models\School;

$schools = School::whereRaw("LOWER(nama) LIKE '%purwasari%'")->get();
if ($schools->isEmpty()) {
    echo "TIDAK ADA SEKOLAH DENGAN KATA 'purwasari'\n";
} else {
    foreach ($schools as $s) {
        echo "School ID: {$s->id}, Nama: {$s->nama}\n";
    }
}
