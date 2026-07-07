<?php
// Skrip ini hanya untuk memverifikasi teori bahwa admin Bantarsari meng-upload file Excel yang berisi nama-nama dari sekolah lain
use App\Models\SkDocument;
use Illuminate\Support\Facades\DB;

echo "=== MENGUSUT ASAL-USUL SK HANTU BANTARSARI ===\n\n";

$sks = SkDocument::withoutGlobalScopes()
    ->where('school_id', 50) // Bantarsari
    ->whereIn('nama', [
        'TRI OKTA ISTIYONO, S.Pd.',
        'AAN RUSLIANA, S.Pd.I',
        'DASINI, S.Pd.I',
        'MATORI, S.Pd.'
    ])
    ->get();

foreach ($sks as $sk) {
    echo "SK ID: {$sk->id}\n";
    echo "Nama di SK: {$sk->nama}\n";
    echo "No Permohonan: {$sk->nomor_permohonan}\n";
    echo "Tanggal Dibuat (Upload Excel): {$sk->created_at}\n";
    
    // Cek siapa uploader-nya
    echo "Diupload oleh (Email): {$sk->created_by}\n";
    echo "----------------------------------------\n";
}

echo "TEORI: Jika 'created_by' adalah email admin Bantarsari, maka ini membuktikan bahwa admin Bantarsari SENDIRI yang meng-upload nama-nama tersebut (mungkin karena copy-paste template Excel dari MTs Wanareja dan lupa menghapus isinya).\n";
