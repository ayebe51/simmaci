<?php
use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;


echo "=== [DRY RUN] MEMBERSIHKAN GHOST SK & MEMULIHKAN PROFIL GURU ===\n";
echo "*(Tidak ada data yang benar-benar dihapus/diubah di mode ini)*\n\n";

$bantarsariUploaderEmail = '111233010166@simmaci.com';
$uploader = \App\Models\User::where('email', $bantarsariUploaderEmail)->first();
if (!$uploader) {
    die("Uploader Bantarsari tidak ditemukan.\n");
}

$ghostCandidates = SkDocument::withoutGlobalScopes()
    ->where('uploaded_by', $uploader->id)
    ->get();

$deletedSks = 0;
$fixedTeachers = 0;

foreach ($ghostCandidates as $ghost) {
    $teacher = Teacher::withoutGlobalScopes()->find($ghost->teacher_id);
    if (!$teacher) continue;

    $realSk = SkDocument::withoutGlobalScopes()
        ->where('teacher_id', $teacher->id)
        ->where('id', '!=', $ghost->id)
        ->where(function($q) use ($uploader) {
            $q->where('uploaded_by', '!=', $uploader->id)
              ->orWhereNull('uploaded_by');
        })
        ->orderBy('created_at', 'asc')
        ->first();

    if ($realSk && $realSk->school_id != 50) { 
        echo "[SIMULASI] Menemukan Ghost SK ID: {$ghost->id} (Nama: {$ghost->nama})\n";
        echo "           -> Guru ini sejatinya milik School ID: {$realSk->school_id} (dibuktikan dari SK aslinya ID: {$realSk->id})\n";
        echo "           ✅ AKAN MEMULIHKAN Profil Guru (Nama dikembalikan ke: {$realSk->nama}, School ID dikembalikan ke: {$realSk->school_id})\n";
        echo "           🗑️ AKAN MENGHAPUS SK Siluman Bantarsari ini!\n";
        echo "--------------------------------------------------\n";
        
        $fixedTeachers++;
        $deletedSks++;
    }
}

echo "\n===============================================\n";
echo "✅ [DRY RUN] SELESAI!\n";
echo "Total Profil Guru yang AKAN dipulihkan ke sekolah asal: {$fixedTeachers}\n";
echo "Total SK Siluman yang AKAN dihapus: {$deletedSks}\n";
