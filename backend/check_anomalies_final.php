<?php
use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

echo "=== MEMERIKSA ANOMALI SK LINTAS SEKOLAH ===\n\n";

$corruptedTeachers = DB::table('sk_documents')
    ->select('teacher_id')
    ->whereNotNull('teacher_id')
    ->whereNull('deleted_at')
    ->groupBy('teacher_id')
    ->havingRaw('COUNT(DISTINCT school_id) > 1')
    ->pluck('teacher_id');

if ($corruptedTeachers->isEmpty()) {
    echo "✅ BERSIH! Tidak ada satu pun profil Guru yang memiliki SK lintas sekolah.\n\n";
} else {
    echo "⚠️ PERINGATAN! Masih ditemukan " . $corruptedTeachers->count() . " profil Guru dengan SK lintas sekolah:\n\n";
    foreach ($corruptedTeachers as $teacherId) {
        $teacher = Teacher::withoutGlobalScopes()->find($teacherId);
        if (!$teacher) continue;
        echo "Guru: {$teacher->nama} (NIM: {$teacher->nomor_induk_maarif})\n";
        
        $sks = SkDocument::withoutGlobalScopes()->where('teacher_id', $teacherId)->get();
        foreach ($sks as $sk) {
            $schoolName = \App\Models\School::find($sk->school_id)->nama ?? "Unknown ({$sk->school_id})";
            echo "  - SK ID: {$sk->id} | Sekolah: {$schoolName}\n";
        }
        echo "--------------------------------------------------------\n";
    }
}

echo "=== MEMERIKSA DUPLIKASI NIM DI DATABASE ===\n\n";
$duplicateNims = DB::table('teachers')
    ->select('nomor_induk_maarif')
    ->whereNotNull('nomor_induk_maarif')
    ->where('nomor_induk_maarif', '!=', '')
    ->whereNull('deleted_at')
    ->groupBy('nomor_induk_maarif')
    ->havingRaw('COUNT(id) > 1')
    ->pluck('nomor_induk_maarif');

if ($duplicateNims->isEmpty()) {
    echo "✅ BERSIH! Tidak ada NIM ganda yang terdaftar di database.\n";
} else {
    echo "⚠️ PERINGATAN! Ditemukan NIM ganda:\n";
    foreach ($duplicateNims as $nim) {
        echo "NIM: {$nim}\n";
        $teachers = Teacher::withoutGlobalScopes()->where('nomor_induk_maarif', $nim)->get();
        foreach ($teachers as $t) {
            $schoolName = \App\Models\School::find($t->school_id)->nama ?? "Unknown ({$t->school_id})";
            echo "  - Nama: {$t->nama} | Sekolah: {$schoolName} | ID: {$t->id}\n";
        }
        echo "--------------------------------------------------------\n";
    }
}
