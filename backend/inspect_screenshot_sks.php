<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\SkDocument;

echo "=== MEMBONGKAR MISTERI SK YANG ADA DI SCREENSHOT ===\n";

$skIds = [895, 1403, 1398, 1577, 1397, 684, 896, 689];

foreach ($skIds as $id) {
    $sk = SkDocument::withoutGlobalScopes()->find($id);
    if ($sk) {
        $uploader = \App\Models\User::find($sk->uploaded_by);
        $uploaderEmail = $uploader ? $uploader->email : 'N/A';
        
        $school = \App\Models\School::find($sk->school_id);
        $schoolName = $school ? $school->nama_sekolah : 'N/A';
        
        echo "SK ID: {$sk->id}\n";
        echo "  - Nama Saat Ini: {$sk->nama}\n";
        echo "  - No Surat: {$sk->nomor_permohonan}\n";
        echo "  - School ID (Unit Kerja): {$sk->school_id} ({$schoolName})\n";
        echo "  - Diupload Oleh: {$uploaderEmail}\n";
        echo "  - Teacher ID: {$sk->teacher_id}\n";
        echo "--------------------------------------------------------\n";
    }
}
