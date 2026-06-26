<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$teacherB = App\Models\Teacher::where('nama', 'like', '%SRI UTAMI, A.Md.Pust.%')->first();
$teacherA = App\Models\Teacher::where('nama', 'like', '%SRI UTAMI, A.Ma.Pust.%')->first();

if (!$teacherA || !$teacherB) {
    echo "Teacher not found.\n";
    if ($teacherA) echo "Found Teacher A (Ma): " . $teacherA->id . "\n";
    if ($teacherB) echo "Found Teacher B (Md): " . $teacherB->id . "\n";
    exit;
}

echo "Teacher A (Correct): ID = {$teacherA->id}, Name = {$teacherA->nama}, NIM = {$teacherA->nomor_induk_maarif}\n";
echo "Teacher B (Duplicate): ID = {$teacherB->id}, Name = {$teacherB->nama}, NIM = {$teacherB->nomor_induk_maarif}\n";

$sks = App\Models\SkDocument::where('nama', $teacherB->nama)->get();
echo "Found " . $sks->count() . " SKs for Teacher B.\n";

foreach ($sks as $sk) {
    echo "Updating SK ID: {$sk->id}\n";
    $sk->nama = $teacherA->nama;
    // $sk->teacher_id is not widely used, but we update it if exists
    if (in_array('teacher_id', array_keys($sk->getAttributes()))) {
        $sk->teacher_id = $teacherA->id;
    }
    $sk->save();
}

echo "Deleting Teacher B...\n";
$teacherB->forceDelete();

echo "Done.\n";
