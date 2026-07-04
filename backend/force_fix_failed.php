<?php

use App\Models\SkDocument;

// Data yang gagal sebelumnya karena master gurunya sudah tidak ada di database
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

echo "Memperbaiki paksa nama-nama yang gagal sebelumnya...\n";

$count = 0;
foreach ($failed as $f) {
    // Cari SK terbaru yang namanya masih salah (hanya ambil 1 agar tidak menimpa yang asli)
    $sk = SkDocument::withoutGlobalScopes()
        ->where('nama', $f['wrongName'])
        ->orderBy('updated_at', 'desc')
        ->first();
        
    if ($sk) {
        $sk->nama = $f['trueName'];
        // Karena master gurunya sudah terhapus permanen, kita hapus relasinya agar tidak nyasar
        $sk->teacher_id = null; 
        $sk->save();
        $count++;
        echo "✅ Berhasil memperbaiki paksa SK ID {$sk->id} menjadi {$f['trueName']}\n";
    }
}

echo "Selesai! {$count} SK berhasil diperbaiki paksa.\n";
