<?php

// Script untuk memulihkan data SK Document yang salah tertimpa oleh SyncSkNames
// Cara menjalankan (di dalam container server):
// php artisan tinker revert_sk_names.php

use App\Models\SkDocument;

echo "Memulai proses pemulihan data...\n";

// 1. Pulihkan MEIDA KUSUMAH MARDANI, S.E.
// Karena saat ini namanya sudah menjadi 'DEFI NURAINI', kita perlu mencari dokumennya.
// Kita bisa mencari berdasarkan riwayat atau jika kita tahu ciri-ciri dokumennya (misal: jabatannya, sekolahnya).
// Namun karena kita tahu persis ada data yang berubah, kita bisa menggunakan query yang mencari anomali ini.
// Cara paling aman: cari sk_documents yang namanya 'DEFI NURAINI' tetapi kita ubah spesifik yang kita tahu salah.
// Catatan: Karena kita tidak tahu ID persisnya di production, kita akan mencari dokumen dengan nama 'DEFI NURAINI'
// yang mungkin memiliki atribut lain yang berbeda dari profil Defi Nuraini yang asli.

// Pencarian SK yang mungkin milik Meida/Ulfiyani (yang saat ini bernama DEFI NURAINI)
$sks = SkDocument::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
    ->where('nama', 'DEFI NURAINI')
    ->get();

$count = 0;
foreach ($sks as $sk) {
    echo "Ditemukan SK ID: {$sk->id}, Nama Saat ini: {$sk->nama}, Teacher ID: {$sk->teacher_id}\n";
    // Disini Anda perlu mengidentifikasi manual mana yang milik Meida dan mana yang Ulfiyani.
    // Misalnya berdasarkan 'nomor_sk', 'tanggal_penetapan', atau mencocokkan di UI.
    
    // CONTOH CARA FIX JIKA ANDA SUDAH TAHU ID-NYA:
    // Jika SK ID 10 adalah milik Meida:
    /*
    if ($sk->id == 10) { // Ganti 10 dengan ID yang sebenarnya
        $sk->nama = 'MEIDA KUSUMAH MARDANI, S.E.';
        $sk->teacher_id = null; // Putuskan relasi dari Defi Nuraini
        $sk->save();
        echo "Berhasil memulihkan MEIDA KUSUMAH MARDANI, S.E.\n";
    }
    */
}

echo "\nPETUNJUK:\n";
echo "1. Cek output di atas untuk melihat daftar SK atas nama DEFI NURAINI.\n";
echo "2. Edit script ini (uncomment bagian CONTOH CARA FIX) lalu masukkan ID dokumen yang tepat untuk Meida dan Ulfiyani.\n";
echo "3. Jalankan kembali script ini untuk memulihkannya.\n";
echo "4. Jangan lupa putuskan `teacher_id = null` jika memang mereka belum terdaftar di data guru.\n";
