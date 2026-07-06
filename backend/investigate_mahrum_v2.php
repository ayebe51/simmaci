<?php

use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\School;

echo "=== INVESTIGASI MENDALAM KASUS AHMAD MAHRUM ===\n\n";

$sks = SkDocument::withoutGlobalScopes()
    ->where('nama', 'like', '%AHMAD MAHRUM%')
    ->get();

foreach ($sks as $sk) {
    $school = School::find($sk->school_id);
    $schoolName = $school ? $school->nama : "Unknown (ID: {$sk->school_id})";
    
    echo "SK ID: {$sk->id}\n";
    echo "Sekolah: {$schoolName} (ID: {$sk->school_id})\n";
    echo "Nama di SK: {$sk->nama}\n";
    echo "Teacher ID di SK: " . ($sk->teacher_id ?? 'NULL') . "\n";
    
    if ($sk->teacher_id) {
        $teacher = Teacher::withoutGlobalScopes()->find($sk->teacher_id);
        if ($teacher) {
            echo "-> NAMA ASLI DI MASTER GURU: {$teacher->nama}\n";
            echo "-> Nomer Surat Guru: {$teacher->nomor_surat_permohonan}\n";
            echo "-> File Surat Guru: " . basename($teacher->surat_permohonan_url) . "\n";
        } else {
            echo "-> WARNING: Teacher ID {$sk->teacher_id} tidak ditemukan di database!\n";
        }
    }
    
    echo "File Surat SK: " . basename($sk->surat_permohonan_url) . "\n";
    echo "----------------------------------------\n";
}
