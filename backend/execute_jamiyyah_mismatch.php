<?php

use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\School;
use Illuminate\Support\Facades\DB;

echo "=== EKSEKUSI PEMULANGAN GURU NYASAR (KHUSUS JAM'IYYAH) ===\n\n";

// Ambil semua SK aktif
$sks = SkDocument::withoutGlobalScopes()->whereNull('deleted_at')->get();
$executedCount = 0;

foreach ($sks as $sk) {
    $school = $sk->school;
    if (!$school) continue;
    
    // FOKUS HANYA JAMIYYAH
    $statusJamiyyah = strtolower($school->status_jamiyyah ?? '');
    $status = strtolower($school->status ?? '');
    if ($statusJamiyyah !== 'jamiyyah' && $status !== 'jamiyyah' && $statusJamiyyah !== "jam'iyyah" && $status !== "jam'iyyah") {
        continue;
    }

    $currentT = $sk->teacher;
    // Cek apakah data kosong
    $isDataMissing = !$currentT || empty($currentT->tmt) || empty($currentT->tanggal_lahir);
    if (!$isDataMissing) {
        continue; 
    }

    $bareName = trim(explode(',', $sk->nama)[0]);
    $bareNameLower = strtolower($bareName);
    
    // Cari Wanderer: Guru dengan nama sama di sekolah manapun, yang punya data lengkap
    $wanderers = Teacher::withoutGlobalScopes()
        ->withTrashed() // Nyasar sampai ke tong sampah pun kita cari
        ->whereRaw('LOWER(nama) LIKE ?', ['%' . $bareNameLower . '%'])
        ->get();
        
    $bestWanderer = null;
    
    foreach ($wanderers as $wt) {
        if ($wt->school_id == $sk->school_id) continue; // Harus beda school_id (berarti nyasar)
        if (empty($wt->tmt) || empty($wt->tanggal_lahir)) continue; // HARUS punya data yang lumayan lengkap
        
        // KUNCI KEAMANAN: Teks unit_kerja harus cocok dengan nama sekolah
        $wtUnitKerja = strtolower(trim(str_replace(['’', "'"], '', $wt->unit_kerja)));
        $schoolName = strtolower(trim(str_replace(['’', "'"], '', $school->nama)));
        
        if ($wtUnitKerja === $schoolName || strpos($schoolName, $wtUnitKerja) !== false || strpos($wtUnitKerja, $schoolName) !== false) {
            $bestWanderer = $wt;
            break; // Ketemu!
        }
    }
    
    if ($bestWanderer) {
        DB::beginTransaction();
        try {
            $executedCount++;
            echo "✅ MEMULANGKAN GURU: {$sk->nama} (SK ID: {$sk->id})\n";
            
            // 1. Jika terhapus (di tong sampah), pulihkan dulu (Restore)
            if ($bestWanderer->trashed()) {
                $bestWanderer->restore();
            }

            // 2. Pulangkan ke sekolah asalnya (Update school_id)
            $bestWanderer->school_id = $school->id;
            $bestWanderer->save();
            echo "   -> Berhasil mengubah School ID Guru ID {$bestWanderer->id} menjadi {$school->id}\n";
            
            // 3. Tautkan SK ke Guru yang sudah dipulangkan
            $sk->teacher_id = $bestWanderer->id;
            $sk->save();
            echo "   -> Berhasil menautkan SK ID {$sk->id} ke Guru ID {$bestWanderer->id}\n";
            
            // 4. Hapus profil kosong lama agar tidak dobel
            if ($currentT && $currentT->id !== $bestWanderer->id) {
                $currentT->delete();
                echo "   -> Berhasil menghapus profil kosong lama (Guru ID {$currentT->id})\n";
            }
            
            echo "\n";
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            echo "❌ GAGAL MEMULANGKAN: {$sk->nama} - " . $e->getMessage() . "\n\n";
        }
    }
}

echo "======================================================\n";
echo "EKSEKUSI SELESAI!\n";
echo "Total Guru Jam'iyyah yang BERHASIL dipulangkan ke sekolah asalnya: {$executedCount}\n";
