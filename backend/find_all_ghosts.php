<?php
use App\Models\SkDocument;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

echo "=== MENDETEKSI SEMUA GURU YANG MENJADI KORBAN PENIMPAAN LINTAS SEKOLAH ===\n\n";

// Cari semua guru yang memiliki SK di lebih dari 1 sekolah yang berbeda
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

echo "Ditemukan " . $corruptedTeachers->count() . " guru yang memiliki SK di banyak sekolah!\n";
echo "Menganalisa masing-masing guru...\n\n";

foreach ($corruptedTeachers as $teacherId) {
    $teacher = Teacher::withoutGlobalScopes()->find($teacherId);
    if (!$teacher) continue;

    echo "GURU: {$teacher->nama} (NIM: {$teacher->nomor_induk_maarif})\n";
    
    $sks = SkDocument::withoutGlobalScopes()
        ->where('teacher_id', $teacherId)
        ->orderBy('created_at', 'asc')
        ->get();

    // Asumsi: SK pertama yang diunggah (paling lama) adalah milik sekolah aslinya.
    // SK-SK berikutnya yang beda school_id adalah hasil penimpaan (Ghost SK).
    $originalSk = $sks->first();
    echo "  -> Asal Sekolah (SK Pertama): School ID {$originalSk->school_id} (Dibuat: {$originalSk->created_at})\n";
    
    foreach ($sks as $sk) {
        $isGhost = ($sk->school_id != $originalSk->school_id) ? "⚠️ [GHOST SK]" : "✅ [SK ASLI]";
        $uploader = \App\Models\User::find($sk->uploaded_by);
        $uploaderEmail = $uploader ? $uploader->email : 'N/A';
        
        echo "     $isGhost SK ID: {$sk->id} | School: {$sk->school_id} | Surat: {$sk->nomor_permohonan} | Uploader: {$uploaderEmail} | Tgl: {$sk->created_at}\n";
    }
    
    $teacherStatus = ($teacher->school_id != $originalSk->school_id) 
        ? "⚠️ TERSESAT DI SCHOOL ID {$teacher->school_id}" 
        : "✅ AMAN DI SCHOOL ID {$teacher->school_id}";
        
    echo "  -> Status Profil Guru Saat Ini: {$teacherStatus}\n";
    echo "--------------------------------------------------------\n";
}
