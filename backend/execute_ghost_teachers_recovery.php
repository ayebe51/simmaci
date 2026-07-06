<?php

use App\Models\Teacher;
use App\Models\School;
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== EKSEKUSI PEMULIHAN 469 GURU HANTU & SK NYASAR ===\n\n";

$ghostTeachers = Teacher::withoutGlobalScopes()->whereRaw("(school_id IS NULL OR school_id = 0)")
    ->whereRaw("unit_kerja IS NOT NULL AND unit_kerja != ''")->get();

$allSchools = School::all();
$schoolMap = [];
foreach ($allSchools as $s) {
    $normalized = strtolower(trim(str_replace(['’', "'", '.', ','], '', $s->nama)));
    $schoolMap[$normalized] = $s->id;
}

$successCount = 0;
$skMovedCount = 0;

DB::beginTransaction();
try {
    foreach ($ghostTeachers as $t) {
        $unitKerjaNorm = strtolower(trim(str_replace(['’', "'", '.', ','], '', $t->unit_kerja)));
        
        $correctSchoolId = null;
        if (isset($schoolMap[$unitKerjaNorm])) {
            $correctSchoolId = $schoolMap[$unitKerjaNorm];
        } else {
            // Coba partial match
            foreach ($allSchools as $s) {
                $sNorm = strtolower(trim(str_replace(['’', "'", '.', ','], '', $s->nama)));
                if (strpos($unitKerjaNorm, $sNorm) !== false || strpos($sNorm, $unitKerjaNorm) !== false) {
                    $correctSchoolId = $s->id;
                    break;
                }
            }
        }
        
        if ($correctSchoolId) {
            // 1. Pulihkan Profil Guru
            $t->school_id = $correctSchoolId;
            $t->save();
            $successCount++;
            
            // 2. Tarik Paksa SK Nyasar
            $sks = SkDocument::withoutGlobalScopes()->where('teacher_id', $t->id)->get();
            foreach ($sks as $sk) {
                if ($sk->school_id != $correctSchoolId) {
                    $sk->school_id = $correctSchoolId;
                    $sk->save();
                    $skMovedCount++;
                }
            }
        }
    }
    DB::commit();
    echo "✅ SUKSES!\n";
    echo "Berhasil memulihkan {$successCount} Guru Hantu kembali ke sekolah asalnya.\n";
    echo "Berhasil menarik paksa {$skMovedCount} SK Nyasar dari sekolah lain.\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL: " . $e->getMessage() . "\n";
}
