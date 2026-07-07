<?php
use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

use Illuminate\Support\Facades\DB;

echo "=== MEMBERSIHKAN GHOST SK & MEMULIHKAN PROFIL GURU ===\n\n";

$bantarsariUploaderEmail = '111233010166@simmaci.com';
$uploader = \App\Models\User::where('email', $bantarsariUploaderEmail)->first();
if (!$uploader) {
    die("Uploader Bantarsari tidak ditemukan.\n");
}

// Cari semua SK yang diunggah oleh operator Bantarsari
$ghostCandidates = SkDocument::withoutGlobalScopes()
    ->where('uploaded_by', $uploader->id)
    ->get();

$deletedSks = 0;
$fixedTeachers = 0;

DB::beginTransaction();
try {
    foreach ($ghostCandidates as $ghost) {
        $teacher = Teacher::withoutGlobalScopes()->find($ghost->teacher_id);
        if (!$teacher) continue;

        // Cari SK ASLI milik guru ini (di luar SK unggahan operator Bantarsari)
        $realSk = SkDocument::withoutGlobalScopes()
            ->where('teacher_id', $teacher->id)
            ->where('id', '!=', $ghost->id)
            ->where(function($q) use ($uploader) {
                // Pastikan SK asli bukan hasil unggahan operator Bantarsari
                $q->where('uploaded_by', '!=', $uploader->id)
                  ->orWhereNull('uploaded_by');
            })
            ->orderBy('created_at', 'asc') // Ambil yang paling pertama dibuat
            ->first();

        // Jika guru ini punya SK asli dari sekolah lain, berarti SK dari Bantarsari ini FIX SILUMAN!
        if ($realSk && $realSk->school_id != 50) { // 50 = Bantarsari
            echo "Menemukan Ghost SK ID: {$ghost->id} (Nama: {$ghost->nama})\n";
            echo " -> Guru ini ternyata milik School ID: {$realSk->school_id} (dibuktikan dari SK aslinya ID: {$realSk->id})\n";
            
            // 1. Pulihkan profil guru
            // Kembalikan nama guru sesuai nama di SK Asli
            $teacher->nama = $realSk->nama;
            // Kembalikan Unit Kerja (school_id) ke sekolah asal
            $teacher->school_id = $realSk->school_id;
            $teacher->save();
            $fixedTeachers++;
            
            echo " ✅ Profil Guru berhasil dipulihkan (Nama: {$teacher->nama}, School ID: {$teacher->school_id})\n";

            // 2. Hapus SK Siluman (dan histori approvalnya jika ada)
            \App\Models\ApprovalHistory::where('document_id', $ghost->id)
                ->where('document_type', 'sk_document')
                ->delete();
            
            $ghost->delete();
            $deletedSks++;
            echo " 🗑️ SK Siluman Bantarsari berhasil dihapus!\n";
            echo "--------------------------------------------------\n";
        }
    }
    DB::commit();
    echo "\n✅ PEMBERSIHAN SELESAI!\n";
    echo "Total Profil Guru yang berhasil dipulihkan ke sekolah asal: {$fixedTeachers}\n";
    echo "Total SK Siluman yang berhasil dihapus: {$deletedSks}\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL: " . $e->getMessage() . "\n";
}
