<?php
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\School;
use Illuminate\Support\Facades\DB;

echo "=== [DRY RUN] PEMBERSIH GHOST SK LINTAS SEKOLAH (MANUAL OVERRIDE) ===\n";
echo "*(Tidak ada data yang dihapus atau dirubah pada mode ini)*\n\n";

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
$movedSks = 0;

// KHUSUS FATHURROHMAN: Pindahkan SK 433 ke profil aslinya di Cilopadang (NIM 113403337)
echo "➡️ Memproses Kasus Khusus: FATHURROHMAN\n";
$fathurCilopadang = Teacher::withoutGlobalScopes()->where('nomor_induk_maarif', '113403337')->first();
$fathurLayansari = Teacher::withoutGlobalScopes()->where('nomor_induk_maarif', '113401741')->first();

if ($fathurLayansari) {
    if ($fathurCilopadang) {
        echo "   ✅ [SIMULASI] Profil Cilopadang (NIM: 113403337) DITEMUKAN.\n";
        echo "   🔄 [SIMULASI] AKAN MEMINDAHKAN SK ID 433 dari NIM 113401741 ke profil asli Cilopadang (113403337)\n";
        $movedSks++;
    } else {
        echo "   ⚠️ [SIMULASI] Profil Cilopadang (NIM: 113403337) TIDAK DITEMUKAN! Profil ini AKAN DIBUAT secara otomatis.\n";
        echo "   🔄 [SIMULASI] AKAN MEMINDAHKAN SK ID 433 ke profil baru Cilopadang.\n";
        $movedSks++;
    }
    
    echo "   🔄 [SIMULASI] Profil Layansari (NIM: 113401741) AKAN dikembalikan ke MI Ma'arif 02 Layansari (School ID: 64)\n";
    $fixedTeachers++;
    echo "--------------------------------------------------------\n";
}

foreach ($instructions as $nim => $targetSchoolId) {
    $teacher = Teacher::withoutGlobalScopes()->where('nomor_induk_maarif', $nim)->first();
    if (!$teacher) {
        echo "Guru dengan NIM {$nim} tidak ditemukan.\n";
        continue;
    }

    echo "Memproses Guru: {$teacher->nama} (NIM: {$nim})\n";
    $sks = SkDocument::withoutGlobalScopes()->where('teacher_id', $teacher->id)->get();

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
echo "Total SK yang AKAN dipindahkan ke Profil Asli: {$movedSks}\n";
echo "Total Ghost SK yang AKAN dihapus selamanya: {$deletedGhosts}\n";
