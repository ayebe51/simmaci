<?php
use App\Models\School;
use App\Models\Teacher;

$mts = School::where('nama', 'ilike', '%MTs%Ma%arif%02%Gandrungmangu%')->first();
if (is_null($mts)) {
    echo 'Sekolah MTs Ma\'arif 02 Gandrungmangu tidak ditemukan!' . PHP_EOL;
    return;
}
echo 'Target: ' . $mts->nama . ' (ID: ' . $mts->id . ')' . PHP_EOL;

$names = [
    'NENI ERIYANI',
    'NASIYAH',
    'KHOLIFAH',
    'SUMIATI',
    'EKA PUJI LESTARI',
    'RIJKI AMELIA HIDAYAT',
    'IMAM WAHYUDI',
    'AHMAD KHOTIM',
    'ERANI YUNITA'
];

$updatedCount = 0;
foreach ($names as $name) {
    $teachers = Teacher::where('nama', 'ilike', '%' . $name . '%')
        ->where('school_id', '<>', $mts->id)
        ->get();
    foreach ($teachers as $t) {
        echo '- Memindahkan: ' . $t->nama . ' (dari school_id: ' . $t->school_id . ')' . PHP_EOL;
        $t->school_id = $mts->id;
        $t->save();
        $updatedCount++;
    }
}
echo PHP_EOL . 'Total guru berhasil dipindahkan: ' . $updatedCount . PHP_EOL;
