<?php
require __DIR__.'/../../vendor/autoload.php';
$app = require_once __DIR__.'/../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\ActivityLog;

header('Content-Type: application/json');

if (!isset($_FILES['backup_file'])) {
    http_response_code(400);
    echo json_encode(['message' => 'File tidak ditemukan']);
    exit;
}

try {
    $zipPath = $_FILES['backup_file']['tmp_name'];
    $zip = new ZipArchive();

    if ($zip->open($zipPath) === TRUE) {
        $jsonContent = $zip->getFromName('database.json');
        if (!$jsonContent) {
            $zip->close();
            http_response_code(400);
            echo json_encode(['message' => 'File database.json tidak ditemukan']);
            exit;
        }

        $data = json_decode($jsonContent, true);

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $filename = $zip->getNameIndex($i);

            // Restore MinIO files
            if (str_starts_with($filename, 's3_files/') && !str_ends_with($filename, '/')) {
                $content = $zip->getFromIndex($i);
                $s3Path = substr($filename, strlen('s3_files/')); // e.g. "uploads/xyz.pdf"
                // Store using Laravel's configured S3 disk
                \Illuminate\Support\Facades\Storage::disk('s3')->put($s3Path, $content, 'public');
            }

            // Restore Local Storage files (just in case)
            if (str_starts_with($filename, 'sk_documents/') && !str_ends_with($filename, '/')) {
                $content = $zip->getFromIndex($i);
                $destPath = storage_path('app/public/' . $filename);
                $dir = dirname($destPath);
                if (!is_dir($dir)) {
                    mkdir($dir, 0755, true);
                }
                file_put_contents($destPath, $content);
            }
        }
        $zip->close();

        DB::statement('SET session_replication_role = \'replica\';');
        
        DB::beginTransaction();

        if (isset($data['new_teachers'])) {
            foreach ($data['new_teachers'] as $row) {
                Teacher::withoutGlobalScopes()->updateOrCreate(['id' => $row['id']], $row);
            }
        }

        if (isset($data['sk_documents'])) {
            foreach ($data['sk_documents'] as $row) {
                SkDocument::withoutGlobalScopes()->updateOrCreate(['id' => $row['id']], $row);
            }
        }

        if (isset($data['activity_logs'])) {
            foreach ($data['activity_logs'] as $row) {
                ActivityLog::updateOrCreate(['id' => $row['id']], $row);
            }
        }

        DB::commit();
        DB::statement('SET session_replication_role = \'origin\';');

        echo json_encode(['message' => 'Restore Berhasil! Pengajuan SK hari ini sudah kembali.']);
    } else {
        http_response_code(400);
        echo json_encode(['message' => 'Gagal ekstrak ZIP']);
    }
} catch (\Exception $e) {
    DB::rollBack();
    DB::statement('SET session_replication_role = \'origin\';');
    http_response_code(500);
    echo json_encode(['message' => 'Gagal: ' . $e->getMessage()]);
}
