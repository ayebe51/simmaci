<?php
use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

echo "=== EKSEKUSI PEMBERSIH GHOST SK LINTAS SEKOLAH (UNIVERSAL) ===\n\n";

$corruptedTeachers = DB::table('sk_documents')
    ->select('teacher_id')
    ->whereNotNull('teacher_id')
    ->whereNull('deleted_at')
    ->groupBy('teacher_id')
    ->havingRaw('COUNT(DISTINCT school_id) > 1')
    ->pluck('teacher_id');

if ($corruptedTeachers->isEmpty()) {
    echo "Tidak ada guru yang terdeteksi memiliki SK lintas sekolah.\n";
    exit;
}

$fixedTeachers = 0;
$deletedGhosts = 0;

DB::beginTransaction();
try {
    foreach ($corruptedTeachers as $teacherId) {
        $teacher = Teacher::withoutGlobalScopes()->find($teacherId);
        if (!$teacher) continue;

        $sks = SkDocument::withoutGlobalScopes()
            ->where('teacher_id', $teacherId)
            ->orderBy('created_at', 'asc')
            ->get();

        // SK pertama adalah SK aslinya
        $originalSk = $sks->first();
        
        echo "Memproses Guru: {$teacher->nama}\n";
        echo " -> Unit Kerja Asli: {$originalSk->school_id}\n";

        // 1. Pulihkan Profil Guru
        $teacher->school_id = $originalSk->school_id;
        $teacher->nama = $originalSk->nama;
        $teacher->save();
        $fixedTeachers++;
        echo " ✅ Profil guru berhasil dipulihkan (Nama: {$teacher->nama}, School ID: {$teacher->school_id})\n";

        // 2. Hapus SK Siluman
        foreach ($sks as $sk) {
            if ($sk->school_id != $originalSk->school_id) {
                // Hapus histori approval
                \App\Models\ApprovalHistory::where('document_id', $sk->id)
                    ->where('document_type', 'sk_document')
                    ->delete();
                
                // Hapus SK Siluman
                $sk->delete();
                $deletedGhosts++;
                echo " 🗑️ Menghapus Ghost SK ID: {$sk->id} (tersesat di School ID: {$sk->school_id})\n";
            }
        }
        echo "--------------------------------------------------------\n";
    }
    DB::commit();
    echo "\n✅ PEMBERSIHAN SELESAI!\n";
    echo "Total Profil Guru yang berhasil dipulihkan ke sekolah asalnya: {$fixedTeachers}\n";
    echo "Total Ghost SK yang berhasil dihapus selamanya: {$deletedGhosts}\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ GAGAL: " . $e->getMessage() . "\n";
}
