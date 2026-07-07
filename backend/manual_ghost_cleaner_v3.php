<?php
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\School;
use Illuminate\Support\Facades\DB;

echo "=== EKSEKUSI PEMBERSIH GHOST SK LINTAS SEKOLAH (MANUAL OVERRIDE) ===\n\n";

$instructions = [
    '113402864' => 164,     // Tri Okta -> Wanareja
    '113401085' => 164,     // Kartini Suratmi -> Wanareja
    '113403599' => 101,     // Intiha'us Sangadah -> Kutasari
    '113403949' => 100,     // Maftuhin -> Sidasari
    '113401967' => 62,      // Uswatun Chasanah -> Gandrungmanis
    '113401084' => 164,     // Aan Rusliana -> Wanareja
    '113403243' => 164,     // Dany Ramadhan -> Wanareja
    '113402979' => 164,     // Din Azizah -> Wanareja
];

$fixedTeachers = 0;
$deletedGhosts = 0;

DB::beginTransaction();
try {
    foreach ($instructions as $nim => $targetSchoolId) {
        $teacher = Teacher::withoutGlobalScopes()->where('nomor_induk_maarif', $nim)->first();
        if (!$teacher) continue;

        echo "Memproses Guru: {$teacher->nama} (NIM: {$nim})\n";
        $sks = SkDocument::withoutGlobalScopes()->where('teacher_id', $teacher->id)->get();

        $targetSchoolName = School::find($targetSchoolId)->nama ?? 'Unknown';
        echo " ➡️ Target Unit Kerja yang Benar: {$targetSchoolName}\n";

        // 1. Pulihkan Profil Guru
        if ($teacher->school_id != $targetSchoolId) {
            $teacher->school_id = $targetSchoolId;
            $targetSk = $sks->firstWhere('school_id', $targetSchoolId);
            if ($targetSk) {
                $teacher->nama = $targetSk->nama;
            }
            $teacher->save();
            $fixedTeachers++;
            echo "    🔄 Profil guru berhasil dipulihkan ke {$targetSchoolName}\n";
        }

        // 2. Hapus SK Siluman
        foreach ($sks as $sk) {
            if ($sk->school_id != $targetSchoolId) {
                $ghostSchoolName = School::find($sk->school_id)->nama ?? 'Unknown';
                
                \App\Models\ApprovalHistory::where('document_id', $sk->id)
                    ->where('document_type', 'sk_document')
                    ->delete();
                
                $sk->delete();
                $deletedGhosts++;
                echo "    🗑️ Menghapus Ghost SK ID: {$sk->id} (tersesat di {$ghostSchoolName})\n";
            }
        }
        echo "--------------------------------------------------------\n";
    }
    DB::commit();
    echo "\n✅ PEMBERSIHAN SELESAI!\n";
    echo "Total Profil Guru yang berhasil dipulihkan: {$fixedTeachers}\n";
    echo "Total Ghost SK yang berhasil dihapus selamanya: {$deletedGhosts}\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL: " . $e->getMessage() . "\n";
}
