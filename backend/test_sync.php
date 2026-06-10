<?php

// Find old teachers with NIP looking like NIM
$oldTeachers = App\Models\Teacher::withoutTenantScope()
    ->where('nip', 'like', '1134%')
    ->get();

$matchCount = 0;
$mismatchCount = 0;

foreach ($oldTeachers as $old) {
    // Check if there is a NEW teacher with this as nomor_induk_maarif
    $new = App\Models\Teacher::withoutTenantScope()
        ->where('nomor_induk_maarif', $old->nip)
        ->where('id', '!=', $old->id)
        ->first();
        
    if ($new) {
        echo "MATCH: Old [{$old->nama}] (NIP: {$old->nip}) -> New [{$new->nama}] (NIM: {$new->nomor_induk_maarif})\n";
        $matchCount++;
    } else {
        $mismatchCount++;
    }
}

echo "\nTotal Matches: $matchCount\n";
echo "Total Mismatches: $mismatchCount\n";
