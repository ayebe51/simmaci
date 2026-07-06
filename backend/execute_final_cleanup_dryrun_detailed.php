<?php

use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\School;
use Illuminate\Support\Facades\DB;

echo "=== DRY RUN (DETAILED): EKSEKUSI FINAL MEMBERSIHKAN MISMATCH & HANTU ===\n";
echo "*(Tidak ada data yang benar-benar dirubah di database pada mode ini)*\n\n";

DB::beginTransaction();
try {
    // 1. UPDATE SCHOOL ID DI TABEL GURU (KARENA TYPO/SALAH INPUT)
    echo "--- 1. UPDATE ID SEKOLAH PADA TABEL GURU ---\n";
    $updatesTeacher = [
        1575 => 33,  // Solikhun -> Kalisabuk
        867  => 64,  // Fathurrohman -> Layansari
        389  => 120, // Ahmad Fauzi -> Tambaksari
    ];

    foreach ($updatesTeacher as $teacherId => $newSchoolId) {
        $teacher = Teacher::withoutGlobalScopes()->with('school')->find($teacherId);
        $newSchool = School::withoutGlobalScopes()->find($newSchoolId);
        if ($teacher && $newSchool) {
            $old = $teacher->school_id;
            $oldName = $teacher->school ? $teacher->school->nama : 'KOSONG';
            
            $teacher->school_id = $newSchoolId;
            $teacher->save();
            
            echo "[SIMULASI UPDATE]\n";
            echo "  Guru       : {$teacher->nama} (ID: {$teacherId})\n";
            echo "  Teks Input : '{$teacher->unit_kerja}'\n";
            echo "  School ID  : {$old} ({$oldName}) ---> {$newSchoolId} ({$newSchool->nama})\n\n";
        }
    }

    echo "--- 2. PENGHAPUSAN SK HANTU / NYASAR ---\n";
    $deleteSkIds = [
        1190, // Dany Ramadhan (nyasar ke Kedungreja)
        1403, // Tri Okta (nyasar ke Bantarsari)
        1357, // Tri Okta (nyasar ke Gentasari)
        1067, // Din Azizah (nyasar ke Tambaksari)
        658,  // Kartini Suratmi (nyasar ke Gandrungmangu)
        1399, // Aan Rusliana (nyasar ke Bantarsari)
        960,  // Intiha'us (nyasar ke Sidasari)
        1019, // Maftuhin (nyasar ke Kutasari)
        1441, // Ana Wahayu (nyasar ke Bulusari)
    ];

    foreach ($deleteSkIds as $skId) {
        $sk = SkDocument::withoutGlobalScopes()->with('teacher', 'school')->find($skId);
        if ($sk && $sk->teacher) {
            $nama = $sk->nama;
            $skSchoolName = $sk->school ? $sk->school->nama : 'KOSONG';
            $teacherSchoolName = $sk->teacher->school ? $sk->teacher->school->nama : 'KOSONG';
            
            echo "[SIMULASI HAPUS SK ID {$skId}]\n";
            echo "  Guru             : {$nama}\n";
            echo "  SK Tercatat di   : School ID {$sk->school_id} ({$skSchoolName})\n";
            echo "  Asal Guru Asli   : School ID {$sk->teacher->school_id} ({$teacherSchoolName})\n";
            echo "  Tindakan         : SK ini adalah Hantu dan DIHAPUS.\n\n";
            
            $sk->delete();
        }
    }

    echo "--- 3. PERBAIKAN NOMOR SK PRIMAWANTI ---\n";
    $primawantiSk = SkDocument::withoutGlobalScopes()->with('teacher', 'school')->find(893);
    if ($primawantiSk) {
        $oldNum = $primawantiSk->nomor_permohonan;
        $newNum = '025/MI.KDRJ/SP.SK.Mrf/V/2026';
        $schoolName = $primawantiSk->school ? $primawantiSk->school->nama : 'KOSONG';
        
        $primawantiSk->nomor_permohonan = $newNum;
        $primawantiSk->save();
        
        echo "[SIMULASI PERBAIKAN]\n";
        echo "  Guru        : {$primawantiSk->nama} (SK ID: 893)\n";
        echo "  Sekolah     : {$primawantiSk->school_id} ({$schoolName})\n";
        echo "  Nomor Lama  : {$oldNum} (Nomor MTs Wanareja yang nyasar)\n";
        echo "  Nomor Baru  : {$newNum} (Nomor asli MI Kedungreja)\n";
    }

    // MEMBATALKAN SEMUA PERUBAHAN AGAR AMAN (DRY RUN)
    DB::rollBack();
    echo "\n=== DRY RUN SELESAI! SEMUA PERUBAHAN TELAH DIBATALKAN KEMBALI ===\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
}
