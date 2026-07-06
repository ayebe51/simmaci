<?php

use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

echo "Memulai perbaikan data silang antar-sekolah (Cross-School)...\n";

// 1. Jalankan force fix dulu untuk 4 SK yang gagal sebelumnya
$failed = [
    [
        'wrongName' => 'ALFINA AMANATUL FAUZAH, S.Pd.',
        'trueName' => 'KHALIMATUS SA\'DIYAH, S.Pd.'
    ],
    [
        'wrongName' => 'AHMAD ALFARIQI',
        'trueName' => 'DWI YULIYANTI, S.Pd.'
    ],
    [
        'wrongName' => 'ULIN NABILLAH',
        'trueName' => 'NANI WIDIANINGSIH DEWI'
    ],
    [
        'wrongName' => 'MAFTUHIN, S.Pd.I',
        'trueName' => 'INTIHA\'US SANGADAH, S.Pd.'
    ]
];

foreach ($failed as $f) {
    $sk = SkDocument::withoutGlobalScopes()
        ->where('nama', $f['wrongName'])
        ->orderBy('updated_at', 'desc')
        ->first();
        
    if ($sk) {
        $sk->nama = $f['trueName'];
        $sk->teacher_id = null; 
        $sk->save();
        echo "✅ [FORCE FIX] Berhasil memperbaiki paksa SK ID {$sk->id} menjadi {$f['trueName']}\n";
    }
}

// 2. Fix Cross-School
$sks = DB::table('sk_documents as sk')
    ->join('teachers as t', 'sk.teacher_id', '=', 't.id')
    ->select('sk.id as sk_id', 'sk.nama as sk_nama', 'sk.school_id as sk_school', 'sk.teacher_id as sk_t_id', 't.school_id as t_school')
    ->whereNotNull('sk.teacher_id')
    ->where(function($q) {
        $q->whereColumn('sk.school_id', '!=', 't.school_id')
          ->orWhereNull('t.school_id');
    })
    ->get();

$fixedToTeacher = 0;
$fixedToNull = 0;

foreach ($sks as $row) {
    $sk = SkDocument::withoutGlobalScopes()->find($row->sk_id);
    if (!$sk) continue;

    $bareName = trim(explode(',', $sk->nama)[0]);

    // Cari guru dengan nama yang sama di sekolah asalnya (school_id milik SK)
    $correctTeacher = Teacher::withoutGlobalScopes()
        ->whereRaw("UPPER(TRIM(SPLIT_PART(nama, ',', 1))) = ?", [strtoupper($bareName)])
        ->where('school_id', $sk->school_id)
        ->first();

    if ($correctTeacher) {
        $sk->teacher_id = $correctTeacher->id;
        $sk->save();
        $fixedToTeacher++;
        echo "✅ [RE-LINK] SK ID {$sk->id} (Nama: {$sk->nama}) dikembalikan ke Guru ID {$correctTeacher->id} (Sekolah {$sk->school_id})\n";
    } else {
        // Jika tidak ditemukan di sekolahnya, berarti guru ini sudah terhapus permanen
        // Kita kosongkan teacher_id nya agar tidak nyasar ke sekolah lain
        $sk->teacher_id = null;
        $sk->save();
        $fixedToNull++;
        echo "⚠️ [UN-LINK] SK ID {$sk->id} (Nama: {$sk->nama}): Guru tidak ditemukan di Sekolah {$sk->school_id}. ID Guru dikosongkan.\n";
    }
}

echo "\n--- SELESAI ---\n";
echo "Total SK dikembalikan ke Guru yang benar: {$fixedToTeacher}\n";
echo "Total SK dikosongkan (Un-link) karena Guru terhapus: {$fixedToNull}\n";
