<?php
require __DIR__.'/../../vendor/autoload.php';
$app = require_once __DIR__.'/../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\ActivityLog;

try {
    $cutoffDate = Carbon::parse('2026-06-09 00:00:00');

    $skDocs = SkDocument::withoutGlobalScopes()
        ->where('updated_at', '>=', $cutoffDate)
        ->get();

    $teacherIdsInSk = $skDocs->pluck('teacher_id')->unique()->filter()->toArray();

    $newTeachers = Teacher::withoutGlobalScopes()
        ->whereIn('id', $teacherIdsInSk)
        ->where('created_at', '>=', $cutoffDate)
        ->get();

    $activities = ActivityLog::where('created_at', '>=', $cutoffDate)->get();

    $backupData = [
        'sk_documents' => $skDocs->toArray(),
        'new_teachers' => $newTeachers->toArray(),
        'activity_logs' => $activities->toArray(),
    ];

    $jsonContent = json_encode($backupData, JSON_PRETTY_PRINT);
    
    $zipFileName = 'emergency_backup_' . date('Y_m_d_His') . '.zip';
    $zipPath = storage_path('app/' . $zipFileName);

    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) === TRUE) {
        $zip->addFromString('database.json', $jsonContent);

        // Backup files from MinIO
        $urlsToBackup = [];
        foreach ($skDocs as $doc) {
            if (!empty($doc->file_url)) $urlsToBackup[] = $doc->file_url;
            if (!empty($doc->surat_permohonan_url)) $urlsToBackup[] = $doc->surat_permohonan_url;
            if (!empty($doc->ijazah_url)) $urlsToBackup[] = $doc->ijazah_url;
        }
        $urlsToBackup = array_unique($urlsToBackup);

        $awsUrl = env('AWS_URL', '');
        $awsBucket = env('AWS_BUCKET', '');
        $publicPrefix = rtrim($awsUrl, '/') . '/' . $awsBucket . '/';

        foreach ($urlsToBackup as $url) {
            if (str_starts_with($url, $publicPrefix)) {
                $relativePath = substr($url, strlen($publicPrefix)); // e.g. 'uploads/file.pdf'
                // Use internal docker network to fetch fast and avoid SSL issues
                $internalUrl = 'http://minio:9000/' . $awsBucket . '/' . $relativePath;
                $fileContent = @file_get_contents($internalUrl);
                if ($fileContent !== false) {
                    $zip->addFromString('s3_files/' . $relativePath, $fileContent);
                }
            }
        }

        // Also check local storage just in case
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
    http_response_code(500);
    echo "Error: " . $e->getMessage();
}
