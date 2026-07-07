<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\SkDocument;
use App\Models\Teacher;

echo "=== CEK GHOST SK DARI BANTARSARI ===\n";

// Ambil semua SK yang diupload oleh operator Bantarsari, tapi gurunya bukan dari Bantarsari
$bantarsariUploaderId = \App\Models\User::where('email', '111233010166@simmaci.com')->value('id');

$sks = SkDocument::withoutGlobalScopes()
    ->where('uploaded_by', $bantarsariUploaderId)
    ->get();

foreach ($sks as $sk) {
    $teacher = Teacher::withoutGlobalScopes()->find($sk->teacher_id);
    if ($teacher && $teacher->school_id != 50) { // 50 adalah ID Bantarsari
        echo "SK ID: {$sk->id} | Nama: {$sk->nama} | Surat: {$sk->nomor_permohonan}\n";
        echo "   -> Numpang di Bantarsari (School ID SK: {$sk->school_id})\n";
        echo "   -> Padahal Guru ini milik School ID: {$teacher->school_id}\n";
        
        // Cek apakah guru ini sudah punya SK asli di sekolahnya sendiri
        $realSks = SkDocument::withoutGlobalScopes()
            ->where('teacher_id', $teacher->id)
            ->where('school_id', $teacher->school_id)
            ->get();
            
        if ($realSks->count() > 0) {
            echo "   ✅ Guru ini SUDAH PUNYA {$realSks->count()} SK di sekolah aslinya!\n";
        } else {
            echo "   ❌ Guru ini BELUM PUNYA SK di sekolah aslinya.\n";
        }
        echo "-----------------------------------------\n";
    }
}
