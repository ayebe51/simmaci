<?php
require __DIR__.'/../../vendor/autoload.php';
$app = require_once __DIR__.'/../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\SkApplication;
use App\Models\SkDocument;
use App\Models\Teacher;
use Spatie\Activitylog\Models\Activity;

header('Content-Type: application/json');

if (!isset($_FILES['backup_file'])) {
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
            echo json_encode(['message' => 'File database.json tidak ditemukan']);
            exit;
        }

        $data = json_decode($jsonContent, true);

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $filename = $zip->getNameIndex($i);
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

        foreach ($data['new_teachers'] as $row) {
            Teacher::withoutGlobalScopes()->updateOrCreate(['id' => $row['id']], $row);
        }

        foreach ($data['sk_applications'] as $row) {
            SkApplication::withoutGlobalScopes()->updateOrCreate(['id' => $row['id']], $row);
        }

        foreach ($data['sk_documents'] as $row) {
            SkDocument::updateOrCreate(['id' => $row['id']], $row);
        }

        $appIds = array_column($data['sk_applications'], 'id');
        if (!empty($appIds)) {
            DB::table('sk_application_teachers')->whereIn('sk_application_id', $appIds)->delete();
        }
        
        $pivotChunks = array_chunk($data['sk_application_teachers'], 100);
        foreach ($pivotChunks as $chunk) {
            DB::table('sk_application_teachers')->insert($chunk);
        }

        foreach ($data['activity_logs'] as $row) {
            Activity::updateOrCreate(['id' => $row['id']], $row);
        }

        DB::commit();
        DB::statement('SET session_replication_role = \'origin\';');

        echo json_encode(['message' => 'Restore Berhasil! Pengajuan SK hari ini sudah kembali.']);
    } else {
        echo json_encode(['message' => 'Gagal ekstrak ZIP']);
    }
} catch (\Exception $e) {
    DB::rollBack();
    DB::statement('SET session_replication_role = \'origin\';');
    echo json_encode(['message' => 'Gagal: ' . $e->getMessage()]);
}
