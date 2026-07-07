<?php
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\School;
use Illuminate\Support\Facades\DB;

echo "=== [DRY RUN] PEMBERSIH GHOST SK LINTAS SEKOLAH (UNIVERSAL) ===\n";
echo "*(Tidak ada data yang dihapus atau dirubah pada mode ini)*\n\n";

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

foreach ($corruptedTeachers as $teacherId) {
    $teacher = Teacher::withoutGlobalScopes()->find($teacherId);
    if (!$teacher) continue;

    $sks = SkDocument::withoutGlobalScopes()
        ->where('teacher_id', $teacherId)
        ->orderBy('created_at', 'asc')
        ->get();

    // SK pertama adalah SK aslinya
    $originalSk = $sks->first();
    $originalSchoolName = School::find($originalSk->school_id)->nama ?? 'Unknown School';
    
    echo "Memproses Guru: {$teacher->nama}\n";
    echo " -> Unit Kerja Asli Terdeteksi: {$originalSchoolName} (ID: {$originalSk->school_id})\n";
    
    $willRestore = false;
    if ($teacher->school_id != $originalSk->school_id || $teacher->nama != $originalSk->nama) {
        $willRestore = true;
    }

    if ($willRestore) {
        $currentSchoolName = School::find($teacher->school_id)->nama ?? 'Unknown School';
        echo " ✅ [SIMULASI] Profil guru AKAN dipulihkan:\n";
        echo "     - Nama: {$teacher->nama}  -->  {$originalSk->nama}\n";
        echo "     - Unit Kerja: {$currentSchoolName}  -->  {$originalSchoolName}\n";
        $fixedTeachers++;
    } else {
        echo " 🆗 Profil guru sudah sesuai dengan SK aslinya (berada di {$originalSchoolName}).\n";
    }

    // Simulasi Hapus SK Siluman
    foreach ($sks as $sk) {
        if ($sk->school_id != $originalSk->school_id) {
            $ghostSchoolName = School::find($sk->school_id)->nama ?? 'Unknown School';
            echo " 🗑️ [SIMULASI] AKAN MENGHAPUS Ghost SK ID: {$sk->id} (tersesat di {$ghostSchoolName})\n";
            $deletedGhosts++;
        }
    }
    echo "--------------------------------------------------------\n";
}

echo "\n===============================================\n";
echo "✅ [DRY RUN] PEMBERSIHAN SELESAI!\n";
echo "Total Profil Guru yang AKAN dipulihkan ke sekolah asalnya: {$fixedTeachers}\n";
echo "Total Ghost SK yang AKAN dihapus selamanya: {$deletedGhosts}\n";
