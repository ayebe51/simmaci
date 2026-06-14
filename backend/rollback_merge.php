<?php
// Script untuk Rollback salah merge pada Guru

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ActivityLog;
use App\Models\Teacher;

echo "Memulai proses Rollback Deduplicate Guru...\n";
echo "-------------------------------------------\n";

// 1. ROLLBACK KASUS "NIM NYASAR" (NIM sama, Nama berbeda)
$logsNimNyasar = ActivityLog::where('event', 'deduplicate_teacher')
    ->where('description', 'like', '%NIM nyasar%')
    ->get();

$restoredNimNyasar = 0;

foreach ($logsNimNyasar as $log) {
    // Contoh format: Merge otomatis duplikat data (NIM nyasar): NUPTK 123. Nama lama: BUDI diganti menjadi SITI.
    if (preg_match('/Nama lama: (.*) diganti menjadi (.*)\./', $log->description, $matches)) {
        $oldName = trim($matches[1]);
        $newName = trim($matches[2]);
        
        $keptTeacher = Teacher::withoutTenantScope()->find($log->subject_id);
        
        if ($keptTeacher) {
            // Cari guru yang dihapus (namanya $newName dan NIM nya nyangkut)
            $droppedTeacher = Teacher::withoutTenantScope()
                ->onlyTrashed()
                ->where('nama', $newName)
                ->where('nomor_induk_maarif', $keptTeacher->nomor_induk_maarif)
                ->orderBy('deleted_at', 'desc')
                ->first();
                
            if ($droppedTeacher) {
                // a. Kembalikan data guru yang dihapus
                $droppedTeacher->restore();
                
                // b. Kembalikan data guru lama yang tertimpa namanya
                $keptTeacher->nama = $oldName;
                // Kembalikan angka NIM yang nyasar itu ke kolom NIP seperti semula
                $keptTeacher->nip = $keptTeacher->nomor_induk_maarif; 
                $keptTeacher->nomor_induk_maarif = null;
                $keptTeacher->save();
                
                $restoredNimNyasar++;
                
                // Hapus log agar tidak dieksekusi 2 kali jika script dijalankan ulang
                $log->delete();
                echo "[-] Berhasil mengembalikan $oldName & $newName (Pisah data)\n";
            }
        }
    }
}

echo "Total Rollback Kasus Beda Nama (NIM Nyasar): $restoredNimNyasar data.\n";
echo "-------------------------------------------\n";

// 2. ROLLBACK KASUS "DUPLIKAT NAMA" (Opsional - Jika ingin dipisah juga)
$logsNama = ActivityLog::where('event', 'deduplicate_teacher')
    ->where('description', 'like', '%duplikat nama%')
    ->get();

$restoredNama = 0;

foreach ($logsNama as $log) {
    // Contoh format: Merge otomatis duplikat nama: SITI digabungkan ke SITI, S.Pd.
    if (preg_match('/Merge otomatis duplikat nama: (.*) digabungkan ke (.*)\./', $log->description, $matches)) {
        $dropName = trim($matches[1]);
        
        $keptTeacher = Teacher::withoutTenantScope()->find($log->subject_id);
        
        if ($keptTeacher) {
            // Cari data guru yang terhapus dengan nama $dropName di sekolah yang sama
            $droppedTeacher = Teacher::withoutTenantScope()
                ->onlyTrashed()
                ->where('nama', $dropName)
                ->where('school_id', $keptTeacher->school_id)
                ->orderBy('deleted_at', 'desc')
                ->first();
                
            if ($droppedTeacher) {
                $droppedTeacher->restore();
                $restoredNama++;
                $log->delete();
                echo "[-] Berhasil mengembalikan $dropName yang sebelumnya tergabung.\n";
            }
        }
    }
}

echo "Total Rollback Kasus Nama Sama (Opsional): $restoredNama data.\n";
echo "Selesai.\n";
