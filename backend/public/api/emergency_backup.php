<?php
require __DIR__.'/../../vendor/autoload.php';
$app = require_once __DIR__.'/../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Models\SkApplication;
use App\Models\SkDocument;
use App\Models\Teacher;
use Spatie\Activitylog\Models\Activity;

try {
    $cutoffDate = Carbon::parse('2026-06-09 00:00:00');

    $skApps = SkApplication::withoutGlobalScopes()->where('updated_at', '>=', $cutoffDate)->get();
    $skAppIds = $skApps->pluck('id')->toArray();

    $skDocs = SkDocument::whereIn('sk_application_id', $skAppIds)->get();

    $skTeachers = DB::table('sk_application_teachers')
        ->whereIn('sk_application_id', $skAppIds)
        ->get();
    
    $teacherIdsInSk = $skTeachers->pluck('teacher_id')->unique()->toArray();

    $newTeachers = Teacher::withoutGlobalScopes()
        ->whereIn('id', $teacherIdsInSk)
        ->where('created_at', '>=', $cutoffDate)
        ->get();

    $activities = Activity::where('created_at', '>=', $cutoffDate)->get();

    $backupData = [
        'sk_applications' => $skApps->toArray(),
        'sk_documents' => $skDocs->toArray(),
        'sk_application_teachers' => $skTeachers->toArray(),
        'new_teachers' => $newTeachers->toArray(),
        'activity_logs' => $activities->toArray(),
    ];

    $jsonContent = json_encode($backupData, JSON_PRETTY_PRINT);
    
    $zipFileName = 'emergency_backup_' . date('Y_m_d_His') . '.zip';
    $zipPath = storage_path('app/' . $zipFileName);

    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) === TRUE) {
        $zip->addFromString('database.json', $jsonContent);

        $docDirectory = storage_path('app/public/sk_documents');
        if (is_dir($docDirectory)) {
            $files = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($docDirectory),
                \RecursiveIteratorIterator::LEAVES_ONLY
            );

            foreach ($files as $name => $file) {
                if (!$file->isDir()) {
                    $filePath = $file->getRealPath();
                    $fileMTime = Carbon::createFromTimestamp(filemtime($filePath));
                    
                    if ($fileMTime->greaterThanOrEqualTo($cutoffDate)) {
                        $relativePath = 'sk_documents/' . substr($filePath, strlen($docDirectory) + 1);
                        $zip->addFile($filePath, $relativePath);
                    }
                }
            }
        }
        $zip->close();

        header('Content-Type: application/zip');
        header('Content-disposition: attachment; filename='.$zipFileName);
        header('Content-Length: ' . filesize($zipPath));
        readfile($zipPath);
        unlink($zipPath);
        exit;
    } else {
        echo "Gagal membuat ZIP";
    }
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage();
}
