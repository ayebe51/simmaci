<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== MENGANALISIS 12 DATA MISMATCH ===\n\n";

$sksActive = SkDocument::withoutGlobalScopes()
    ->where('status', 'active')
    ->with('teacher', 'school')
    ->get();

foreach ($sksActive as $sk) {
    if (!$sk->teacher) continue;
    
    $skSchoolId = $sk->school_id;
    $teacherSchoolId = $sk->teacher->school_id;
    
    if ($skSchoolId != $teacherSchoolId && $skSchoolId !== null && $teacherSchoolId !== null) {
        $skSchoolName = $sk->school ? $sk->school->nama : 'KOSONG';
        $teacherSchoolName = $sk->teacher->school ? $sk->teacher->school->nama : 'KOSONG';
        $teacherUnitKerja = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $sk->teacher->unit_kerja));
        $skSchoolNameClean = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $skSchoolName));
        
        echo "GURU: {$sk->nama} (Teacher ID: {$sk->teacher->id})\n";
        echo "  [SK] School: {$skSchoolId} ({$skSchoolName})\n";
        echo "  [GURU] School: {$teacherSchoolId} ({$teacherSchoolName}) | Teks: {$sk->teacher->unit_kerja}\n";
        
        // 1. Cek apakah ini bagian dari MTs Wanareja Ghost
        if ($teacherSchoolId == 164) {
            echo "  => DIAGNOSIS: Ini adalah HANTU MTs Wanareja. SK ini (ID {$sk->id}) nyasar ke {$skSchoolName} dan harus dihapus.\n";
        }
        // 2. Cek apakah Unit Kerja Text guru cocok dengan SK School Name
        elseif (strpos($skSchoolNameClean, $teacherUnitKerja) !== false || strpos($teacherUnitKerja, $skSchoolNameClean) !== false) {
            echo "  => DIAGNOSIS: Teks Unit Kerja guru cocok dengan SK. Berarti school_id di tabel Guru SALAH. Harus diupdate menjadi {$skSchoolId}.\n";
        }
        // 3. Kasus lain (Teks guru cocok dengan School ID guru, tapi SK beda)
        else {
            echo "  => DIAGNOSIS: Teks guru cocok dengan school_id guru, tapi SK beda. Mari kita cari apakah guru ini punya SK lain di {$teacherSchoolName}:\n";
            $otherSks = SkDocument::withoutGlobalScopes()
                ->where('teacher_id', $sk->teacher->id)
                ->where('id', '!=', $sk->id)
                ->get();
            if ($otherSks->count() > 0) {
                foreach ($otherSks as $o) {
                    echo "     - Ditemukan SK lain ID {$o->id} di school_id {$o->school_id} (Status: {$o->status})\n";
                }
                echo "     KESIMPULAN: SK ID {$sk->id} ini kemungkinan adalah Hantu/Mantan sekolah lama. Bisa dihapus.\n";
            } else {
                echo "     KESIMPULAN: Tidak ada SK lain. Kita perlu konfirmasi manual ke user, sekolah asli guru ini di mana?\n";
            }
        }
        echo "--------------------------------------------------\n";
    }
}
