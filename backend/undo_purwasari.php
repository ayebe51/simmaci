<?php

use App\Models\Teacher;
use App\Models\SkDocument;
use App\Models\School;
use Illuminate\Support\Facades\DB;

echo "=== MENGEMBALIKAN GURU MI MA'ARIF PURWASARI ===\n\n";

// Nama-nama guru MI yang tidak sengaja terbawa ke MTs
$miTeachersNames = [
    "M. HAMAM NASIR, S.Pd.I",
    "SUYATMI, S.Pd.I",
    "IDA FARIDA, S.Pd.I",
    "SRI ROHAYANTI, S.Pd.",
    "ASA NORMA TIYAS, S.Pd.",
    "AHMADI, S.Pd.I",
    "MUTI AZIZAH, S.Pd."
];

// Cari School ID untuk MI Ma'arif Purwasari
$miSchool = School::whereRaw("LOWER(nama) LIKE '%mi ma%purwasari%'")->first();
$miSchoolId = $miSchool ? $miSchool->id : null;
$miSchoolName = $miSchool ? $miSchool->nama : "MI Ma'arif Purwasari";

echo "School ID MI Purwasari ditemukan: " . ($miSchoolId ?? "TIDAK DITEMUKAN, MENGGUNAKAN TEKS SAJA") . "\n";

DB::beginTransaction();
try {
    $tCount = 0;
    $skCount = 0;
    
    foreach ($miTeachersNames as $name) {
        $teachers = Teacher::withoutGlobalScopes()->where('nama', $name)->get();
        
        foreach ($teachers as $t) {
            $t->unit_kerja = $miSchoolName;
            if ($miSchoolId) {
                $t->school_id = $miSchoolId;
            } else {
                $t->school_id = null; // Biar jadi ghost lagi kalau sekolah tidak ada, daripada numpuk di MTs
            }
            $t->save();
            $tCount++;
            
            // Kembalikan juga SK-nya
            $sks = SkDocument::withoutGlobalScopes()->where('teacher_id', $t->id)->get();
            foreach ($sks as $sk) {
                $sk->unit_kerja = $miSchoolName;
                if ($miSchoolId) {
                    $sk->school_id = $miSchoolId;
                }
                $sk->save();
                $skCount++;
            }
        }
    }
    
    DB::commit();
    echo "✅ SUKSES UNDO!\n";
    echo "- Berhasil memulihkan {$tCount} profil Guru kembali ke {$miSchoolName}.\n";
    echo "- Berhasil memulihkan {$skCount} dokumen SK kembali ke {$miSchoolName}.\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL: " . $e->getMessage() . "\n";
}
