<?php

use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

echo "=== DRY RUN: EKSEKUSI FINAL MEMBERSIHKAN MISMATCH & HANTU ===\n";
echo "*(Tidak ada data yang benar-benar dirubah di database pada mode ini)*\n\n";

DB::beginTransaction();
try {
    // 1. UPDATE SCHOOL ID DI TABEL GURU (KARENA TYPO/SALAH INPUT)
    $updatesTeacher = [
        1575 => 33,  // Solikhun -> Kalisabuk
        867  => 64,  // Fathurrohman -> Layansari
        389  => 120, // Ahmad Fauzi -> Tambaksari
    ];

    foreach ($updatesTeacher as $teacherId => $newSchoolId) {
        $teacher = Teacher::withoutGlobalScopes()->find($teacherId);
        if ($teacher) {
            $old = $teacher->school_id;
            $teacher->school_id = $newSchoolId;
            $teacher->save();
            echo "[SIMULASI] ✅ Guru ID {$teacherId} ({$teacher->nama}) school_id diupdate: {$old} -> {$newSchoolId}\n";
        }
    }

    echo "\n";

    // 2. HAPUS SK HANTU / NYASAR
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
        $sk = SkDocument::withoutGlobalScopes()->find($skId);
        if ($sk) {
            $nama = $sk->nama;
            $sk->delete();
            echo "[SIMULASI] 🗑️ SK Hantu ID {$skId} milik {$nama} DIHAPUS.\n";
        }
    }

    echo "\n";

    // 3. PERBAIKI NOMOR SK PRIMAWANTI (KORBAN TYPO MASSAL)
    $primawantiSk = SkDocument::withoutGlobalScopes()->find(893);
    if ($primawantiSk) {
        $oldNum = $primawantiSk->nomor_permohonan;
        $newNum = '025/MI.KDRJ/SP.SK.Mrf/V/2026';
        $primawantiSk->nomor_permohonan = $newNum;
        $primawantiSk->save();
        echo "[SIMULASI] ✅ SK Primawanti (ID 893) diperbaiki:\n";
        echo "   [{$oldNum}] ---> [{$newNum}]\n";
    }

    // MEMBATALKAN SEMUA PERUBAHAN AGAR AMAN (DRY RUN)
    DB::rollBack();
    echo "\n=== DRY RUN SELESAI! SEMUA PERUBAHAN TELAH DIBATALKAN KEMBALI ===\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
}
