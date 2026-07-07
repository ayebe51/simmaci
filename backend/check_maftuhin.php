<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== CEK KASUS MAFTUHIN ===\n";

$sks = SkDocument::withoutGlobalScopes()
    ->where('nama', 'LIKE', '%MAFTUHIN%')
    ->whereHas('teacher', function($q) {
        $q->where('nomor_induk_maarif', '113403949');
    })
    ->get();

foreach ($sks as $sk) {
    echo "SK ID: {$sk->id}\n";
    echo "  - Nama di SK: {$sk->nama}\n";
    echo "  - Unit Kerja (SK): {$sk->school_id}\n";
    echo "  - Nomor Surat: {$sk->nomor_permohonan}\n";
    echo "  - Tgl Upload: {$sk->created_at}\n";
    echo "  - Uploader ID: {$sk->uploaded_by}\n";
    
    $uploader = \App\Models\User::find($sk->uploaded_by);
    if ($uploader) {
        echo "  - Uploader Email: {$uploader->email}\n";
    }
}

$teacher = Teacher::withoutGlobalScopes()->where('nomor_induk_maarif', '113403949')->first();
if ($teacher) {
    echo "\nPROFIL GURU SAAT INI:\n";
    echo "  - Teacher ID: {$teacher->id}\n";
    echo "  - Nama: {$teacher->nama}\n";
    echo "  - Unit Kerja (Sekarang): {$teacher->school_id}\n";
    echo "  - Tgl Dibuat: {$teacher->created_at}\n";
}
