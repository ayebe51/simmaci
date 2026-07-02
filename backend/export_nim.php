<?php
$teachers = App\Models\Teacher::withoutGlobalScope(App\Traits\HasTenantScope::class)
    ->whereNull('nomor_induk_maarif')
    ->orWhere('nomor_induk_maarif', '')
    ->get(['id', 'nama', 'unit_kerja', 'kecamatan']);
$csv = fopen('guru_tanpa_nim.csv', 'w');
fputcsv($csv, ['ID', 'Nama', 'Unit Kerja', 'Kecamatan']);
foreach ($teachers as $t) {
    fputcsv($csv, [$t->id, $t->nama, $t->unit_kerja, $t->kecamatan]);
}
fclose($csv);
echo 'Exported ' . $teachers->count() . ' teachers to guru_tanpa_nim.csv' . PHP_EOL;
