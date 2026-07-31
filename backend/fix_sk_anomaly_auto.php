<?php

// Script Pemulihan Otomatis untuk Kasus "MEIDA" dan "ULFIYANI"
// Jalankan dengan: php artisan tinker fix_sk_anomaly_auto.php

use App\Models\SkDocument;
use App\Models\ActivityLog;
use App\Models\Teacher;

echo "Mencari data SK asli milik MEIDA dan ULFIYANI dari riwayat log...\n";

// Target nama yang rusak
$targets = [
    'MEIDA KUSUMAH MARDANI, S.E.',
    'ULFIYANI MUNGASIROH, S.E., M.Pd.'
];

foreach ($targets as $originalName) {
    // Cari di activity log berdasarkan nama aslinya
    $log = ActivityLog::where('description', 'like', "%{$originalName}%")
        ->whereIn('event', ['submit_sk', 'submit_sk_request', 'bulk_create_sk'])
        ->orderBy('created_at', 'desc')
        ->first();

    if ($log) {
        $skId = $log->subject_id; // Ini adalah ID dari SkDocument
        if ($skId) {
            $sk = SkDocument::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)->find($skId);
            
            if ($sk) {
                echo "\n✅ Ditemukan dokumen untuk {$originalName} (ID SK: {$sk->id})\n";
                echo "   Nama saat ini di database: {$sk->nama}\n";
                
                if ($sk->nama === 'DEFI NURAINI') {
                    // Pulihkan nama
                    $sk->nama = $originalName;
                    // Lepaskan dari teacher_id yang salah
                    $sk->teacher_id = null;
                    $sk->save();
                    
                    echo "   🚀 BERHASIL: Nama telah dikembalikan menjadi '{$originalName}' dan teacher_id di-null-kan.\n";
                } else {
                    echo "   ⚠️ INFO: Nama saat ini bukan DEFI NURAINI, melainkan '{$sk->nama}'. Tidak ada perubahan dilakukan.\n";
                }
            } else {
                echo "❌ SK Document dengan ID {$skId} sudah tidak ada di database.\n";
            }
        } else {
            // Jika lewat bulk create mungkin subject_id tidak ada, kita coba cari via string matching
             echo "⚠️ Log ditemukan namun subject_id kosong. Tidak bisa fix otomatis untuk {$originalName}.\n";
        }
    } else {
        echo "\n❌ Tidak dapat menemukan riwayat log untuk {$originalName}.\n";
        
        // Coba cari langsung ke sk_documents yang namanya DEFI NURAINI dan cek isinya
        $sks = SkDocument::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
            ->where('nama', 'DEFI NURAINI')
            ->get();
            
        echo "   Sebagai alternatif, ini daftar SK dengan nama DEFI NURAINI saat ini:\n";
        foreach ($sks as $s) {
            echo "   -> ID: {$s->id} | Unit Kerja: {$s->unit_kerja} | Tanggal Penetapan: {$s->tanggal_penetapan}\n";
        }
        echo "   Anda bisa mengedit script ini dengan hardcode \$sk = SkDocument::find(ID); \$sk->nama='...'; \$sk->save();\n";
    }
}

echo "\nSelesai.\n";
