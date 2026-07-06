<?php

use App\Models\Teacher;

$t = Teacher::find(1264);
echo "Name: " . $t->nama . "\n";
echo "unit_kerja: " . $t->unit_kerja . "\n";
echo "school_id: " . $t->school_id . "\n";
