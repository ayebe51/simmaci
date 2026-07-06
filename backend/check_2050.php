<?php

use App\Models\SkDocument;

$sk = SkDocument::find(2050);
echo "SK Nama: " . $sk->nama . "\n";
echo "Teacher ID in SK: " . $sk->teacher_id . "\n";
echo "Teacher Object from Relation:\n";
print_r($sk->teacher ? $sk->teacher->toArray() : "NULL");

echo "\nDashboard Condition check:\n";
$cond1 = empty($sk->teacher?->nomor_induk_maarif);
$cond2 = empty($sk->teacher?->tmt);
echo "Is NIM empty? " . ($cond1 ? 'Yes' : 'No') . "\n";
echo "Is TMT empty? " . ($cond2 ? 'Yes' : 'No') . "\n";
