<?php
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\School;
use Illuminate\Support\Facades\DB;

echo "=== [DRY RUN] PEMBERSIH GHOST SK LINTAS SEKOLAH (MANUAL OVERRIDE) ===\n";
echo "*(Tidak ada data yang dihapus atau dirubah pada mode ini)*\n\n";

$instructions = [
    '113401741' => 'SPLIT', // Fathurrohman
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
$clonedTeachers = 0;

foreach ($instructions as $nim => $targetSchoolId) {
    $teacher = Teacher::withoutGlobalScopes()->where('nomor_induk_maarif', $nim)->first();
    if (!$teacher) {
        echo "Guru dengan NIM {$nim} tidak ditemukan.\n";
        continue;
    }

    echo "Memproses Guru: {$teacher->nama} (NIM: {$nim})\n";
    $sks = SkDocument::withoutGlobalScopes()->where('teacher_id', $teacher->id)->get();

    if ($targetSchoolId === 'SPLIT') {
        echo " ➡️ [SIMULASI] Guru ini mengajar di banyak sekolah secara sah. Profilnya AKAN DIDUPLIKASI.\n";
        foreach ($sks as $i => $sk) {
            $schoolName = School::find($sk->school_id)->nama ?? 'Unknown';
            if ($i === 0) {
                echo "    ✅ Profil Asli dipertahankan untuk: {$schoolName} (SK ID: {$sk->id})\n";
            } else {
                echo "    ✅ Profil Baru AKAN DIBUAT untuk: {$schoolName} (SK ID: {$sk->id})\n";
                $clonedTeachers++;
            }
        }
        echo "--------------------------------------------------------\n";
        continue;
    }

    $targetSchoolName = School::find($targetSchoolId)->nama ?? 'Unknown';
    echo " ➡️ [SIMULASI] Target Unit Kerja yang Benar: {$targetSchoolName} (ID: {$targetSchoolId})\n";

    if ($teacher->school_id != $targetSchoolId) {
        $currentSchoolName = School::find($teacher->school_id)->nama ?? 'Unknown';
        echo "    🔄 Profil guru AKAN dipulihkan dari {$currentSchoolName} --> {$targetSchoolName}\n";
        $fixedTeachers++;
    } else {
        echo "    🆗 Profil guru sudah berada di {$targetSchoolName}.\n";
    }

    foreach ($sks as $sk) {
        if ($sk->school_id != $targetSchoolId) {
            $ghostSchoolName = School::find($sk->school_id)->nama ?? 'Unknown';
            echo "    🗑️ AKAN MENGHAPUS Ghost SK ID: {$sk->id} (tersesat di {$ghostSchoolName})\n";
            $deletedGhosts++;
        } else {
            echo "    ✅ SK ID: {$sk->id} AKAN DIPERTAHANKAN (Milik {$targetSchoolName})\n";
        }
    }
    echo "--------------------------------------------------------\n";
}

echo "\n===============================================\n";
echo "✅ [DRY RUN] SELESAI!\n";
echo "Total Profil Guru yang AKAN dipulihkan: {$fixedTeachers}\n";
echo "Total Profil Guru yang AKAN diduplikasi (Split): {$clonedTeachers}\n";
echo "Total Ghost SK yang AKAN dihapus selamanya: {$deletedGhosts}\n";
