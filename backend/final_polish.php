<?php

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== MEMULAI PERBAIKAN FINAL (FINAL POLISH) ===\n\n";

$sks = SkDocument::withoutGlobalScopes()->get();
$relinkedTrashed = 0;
$relinkedNull = 0;

foreach ($sks as $sk) {
    if ($sk->teacher_id) {
        // KASUS 1: Teacher ada di tong sampah (soft-deleted)
        $trashedTeacher = Teacher::withoutGlobalScopes()->withTrashed()->where('id', $sk->teacher_id)->whereNotNull('deleted_at')->first();
        if ($trashedTeacher) {
            // Cari guru yang AKTIF dengan nama yang sama di sekolah yang sama
            $activeTeacher = Teacher::where('school_id', $trashedTeacher->school_id)
                ->where('nama', $trashedTeacher->nama)
                ->first();
            
            if ($activeTeacher) {
                $sk->teacher_id = $activeTeacher->id;
                $sk->save();
                $relinkedTrashed++;
                echo "♻️ SK {$sk->nama} (ID: {$sk->id}) dialihkan dari guru yang terhapus ke Guru Aktif (ID: {$activeTeacher->id})\n";
            }
        }
    } else {
        // KASUS 3: Teacher ID kosong (NULL)
        $bareName = strtoupper(trim(explode(',', $sk->nama)[0]));
        $activeTeacher = Teacher::where('school_id', $sk->school_id)
            ->where(function($q) use ($bareName) {
                $q->where('nama', 'LIKE', "%{$bareName}%")
                  ->orWhereRaw("UPPER(TRIM(SPLIT_PART(nama, ',', 1))) = ?", [$bareName]);
            })
            ->first();
            
        if ($activeTeacher) {
            $sk->teacher_id = $activeTeacher->id;
            $sk->save();
            $relinkedNull++;
            echo "🔗 SK {$sk->nama} (ID: {$sk->id}) yang putus berhasil ditautkan ke Guru Aktif (ID: {$activeTeacher->id})\n";
        }
    }
}

echo "\n=== KESIMPULAN ===\n";
echo "Berhasil menyelamatkan {$relinkedTrashed} SK dari guru yang terhapus.\n";
echo "Berhasil menautkan {$relinkedNull} SK yang sempat terputus.\n";
echo "Selesai!\n";
