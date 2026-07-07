<?php
use App\Models\Teacher;
use App\Models\School;
use Illuminate\Support\Facades\DB;

echo "=== MENGHUBUNGKAN ULANG GURU KE SEKOLAH (AUTO-RELINK) ===\n\n";

$validSchoolIds = School::pluck('id')->toArray();

$unlinkedTeachers = Teacher::withoutGlobalScopes()
    ->whereNull('deleted_at')
    ->where(function($q) use ($validSchoolIds) {
        $q->whereNull('school_id')
          ->orWhere('school_id', 0)
          ->orWhereNotIn('school_id', $validSchoolIds);
    })
    ->get();

$successCount = 0;
$failCount = 0;

DB::beginTransaction();
try {
    foreach ($unlinkedTeachers as $t) {
        if (empty($t->unit_kerja)) {
            echo "⚠️ [LEWATI] {$t->nama} (NIM: {$t->nomor_induk_maarif}) tidak memiliki teks unit_kerja di database.\n";
            $failCount++;
            continue;
        }

        // Normalisasi teks pencarian (kadang ada tanda petik ’ yang beda dengan ')
        $searchString = str_replace('’', "'", $t->unit_kerja);
        // Hapus kata 'MI' atau 'SMP' di awal untuk pencarian yang lebih luas jika gagal
        $searchString = trim($searchString);

        // Pencarian Tahap 1: Pencocokan persis (Exact Match atau Like)
        $schools = School::where('nama', 'like', "%{$searchString}%")->get();

        if ($schools->count() == 1) {
            $school = $schools->first();
            $t->school_id = $school->id;
            $t->save();
            echo "✅ [TERHUBUNG] {$t->nama} --> {$school->nama} (ID: {$school->id})\n";
            $successCount++;
        } else if ($schools->count() > 1) {
            echo "❓ [BINGUNG] Ditemukan lebih dari 1 sekolah yang cocok untuk '{$searchString}':\n";
            foreach($schools as $s) {
                echo "   -> {$s->nama} (ID: {$s->id})\n";
            }
            $failCount++;
        } else {
            // Pencarian Tahap 2: Buang kata depan seperti MI/MTs/SMP/TK/RA
            $keywords = explode(' ', $searchString);
            if (count($keywords) > 1) {
                array_shift($keywords); // Buang kata pertama
                $fallbackSearch = implode(' ', $keywords);
                $fallbackSchools = School::where('nama', 'like', "%{$fallbackSearch}%")->get();
                
                if ($fallbackSchools->count() == 1) {
                    $school = $fallbackSchools->first();
                    $t->school_id = $school->id;
                    $t->save();
                    echo "✅ [TERHUBUNG (FALLBACK)] {$t->nama} --> {$school->nama} (ID: {$school->id})\n";
                    $successCount++;
                    continue;
                }
            }
            echo "❌ [GAGAL] Tidak dapat menemukan sekolah di database yang cocok dengan: '{$searchString}'\n";
            $failCount++;
        }
    }

    DB::commit();
    echo "\n=== PROSES RELINK SELESAI ===\n";
    echo "Berhasil Dihubungkan: {$successCount} guru\n";
    echo "Gagal Dihubungkan    : {$failCount} guru\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL TOTAL: " . $e->getMessage() . "\n";
}
