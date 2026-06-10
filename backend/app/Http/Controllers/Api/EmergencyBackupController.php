<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use ZipArchive;
use Carbon\Carbon;
use App\Models\SkApplication;
use App\Models\SkDocument;
use App\Models\Teacher;
use Spatie\Activitylog\Models\Activity;

class EmergencyBackupController extends Controller
{
    /**
     * Download Backup: Pengajuan SK dan file PDF-nya
     */
    public function backup(Request $request)
    {
        $cutoffDate = Carbon::parse('2026-06-09 00:00:00'); // Batas waktu backup server

        // 1. Ambil data SK Applications yang dibuat ATAU diupdate setelah tanggal backup VPS
        $skApps = SkApplication::withoutGlobalScopes()->where('updated_at', '>=', $cutoffDate)->get();
        $skAppIds = $skApps->pluck('id')->toArray();

        // 2. Ambil dokumen pelengkap
        $skDocs = SkDocument::whereIn('sk_application_id', $skAppIds)->get();

        // 3. Ambil relasi guru-SK
        $skTeachers = DB::table('sk_application_teachers')
            ->whereIn('sk_application_id', $skAppIds)
            ->get();
        
        $teacherIdsInSk = $skTeachers->pluck('teacher_id')->unique()->toArray();

        // 4. Ambil guru BARU yang didaftarkan setelah tanggal backup (agar tidak hilang)
        $newTeachers = Teacher::withoutGlobalScopes()
            ->whereIn('id', $teacherIdsInSk)
            ->where('created_at', '>=', $cutoffDate)
            ->get();

        // 5. Ambil activity logs hari ini
        $activities = Activity::where('created_at', '>=', $cutoffDate)->get();

        // Package all data into JSON
        $backupData = [
            'sk_applications' => $skApps->toArray(),
            'sk_documents' => $skDocs->toArray(),
            'sk_application_teachers' => $skTeachers->toArray(),
            'new_teachers' => $newTeachers->toArray(),
            'activity_logs' => $activities->toArray(),
        ];

        $jsonContent = json_encode($backupData, JSON_PRETTY_PRINT);
        
        // Buat file ZIP
        $zipFileName = 'emergency_backup_' . date('Y_m_d_His') . '.zip';
        $zipPath = storage_path('app/' . $zipFileName);

        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) === TRUE) {
            
            // Tambahkan file JSON database
            $zip->addFromString('database.json', $jsonContent);

            // Tambahkan file fisik PDF dokumen SK
            $docDirectory = storage_path('app/public/sk_documents');
            if (is_dir($docDirectory)) {
                $files = new \RecursiveIteratorIterator(
                    new \RecursiveDirectoryIterator($docDirectory),
                    \RecursiveIteratorIterator::LEAVES_ONLY
                );

                foreach ($files as $name => $file) {
                    if (!$file->isDir()) {
                        $filePath = $file->getRealPath();
                        // Get file modification time
                        $fileMTime = Carbon::createFromTimestamp(filemtime($filePath));
                        
                        // Hanya backup file yang dibuat/dimodifikasi setelah VPS backup!
                        if ($fileMTime->greaterThanOrEqualTo($cutoffDate)) {
                            $relativePath = 'sk_documents/' . substr($filePath, strlen($docDirectory) + 1);
                            $zip->addFile($filePath, $relativePath);
                        }
                    }
                }
            }

            $zip->close();
        } else {
            return response()->json(['message' => 'Gagal membuat file ZIP'], 500);
        }

        return response()->download($zipPath)->deleteFileAfterSend(true);
    }

    /**
     * Restore Backup dari file ZIP
     */
    public function restore(Request $request)
    {
        $request->validate([
            'backup_file' => 'required|file|mimes:zip',
        ]);

        $zipPath = $request->file('backup_file')->getRealPath();
        $zip = new ZipArchive();

        if ($zip->open($zipPath) === TRUE) {
            // 1. Ekstrak dan baca file database.json
            $jsonContent = $zip->getFromName('database.json');
            if (!$jsonContent) {
                $zip->close();
                return response()->json(['message' => 'File database.json tidak ditemukan dalam ZIP'], 400);
            }

            $data = json_decode($jsonContent, true);

            // 2. Ekstrak file fisik PDF ke folder storage
            // Kita pindahkan semua file di dalam folder ZIP sk_documents/ ke storage/app/public/sk_documents/
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $filename = $zip->getNameIndex($i);
                if (str_starts_with($filename, 'sk_documents/') && !str_ends_with($filename, '/')) {
                    $content = $zip->getFromIndex($i);
                    $destPath = storage_path('app/public/' . $filename);
                    
                    // Pastikan folder exist
                    $dir = dirname($destPath);
                    if (!is_dir($dir)) {
                        mkdir($dir, 0755, true);
                    }
                    file_put_contents($destPath, $content);
                }
            }
            $zip->close();

            // 3. Masukkan data ke Database (Disable foreign key checks dulu)
            DB::statement('SET session_replication_role = \'replica\';'); // Untuk PostgreSQL disable trigger FK
            
            try {
                DB::beginTransaction();

                // Restore Teachers (Hanya Guru Baru)
                foreach ($data['new_teachers'] as $row) {
                    Teacher::withoutGlobalScopes()->updateOrCreate(['id' => $row['id']], $row);
                }

                // Restore SK Applications
                foreach ($data['sk_applications'] as $row) {
                    SkApplication::withoutGlobalScopes()->updateOrCreate(['id' => $row['id']], $row);
                }

                // Restore SK Documents
                foreach ($data['sk_documents'] as $row) {
                    SkDocument::updateOrCreate(['id' => $row['id']], $row);
                }

                // Restore SK Application Teachers (Pivot table without primary key 'id' in some cases)
                // Hapus data lama yang terkait untuk menghindari duplikasi
                $appIds = array_column($data['sk_applications'], 'id');
                if (!empty($appIds)) {
                    DB::table('sk_application_teachers')->whereIn('sk_application_id', $appIds)->delete();
                }
                
                // Insert pivot batch
                $pivotChunks = array_chunk($data['sk_application_teachers'], 100);
                foreach ($pivotChunks as $chunk) {
                    // Pastikan id diabaikan jika auto-increment dan kita mau insert
                    // Namun PostgreSQL butuh id jika itu bukan auto-incremet. 
                    // Lebih aman gunakan insert()
                    DB::table('sk_application_teachers')->insert($chunk);
                }

                // Restore Activity Logs
                foreach ($data['activity_logs'] as $row) {
                    Activity::updateOrCreate(['id' => $row['id']], $row);
                }

                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                DB::statement('SET session_replication_role = \'origin\';');
                return response()->json(['message' => 'Gagal restore database: ' . $e->getMessage()], 500);
            }

            DB::statement('SET session_replication_role = \'origin\';');

            return response()->json(['message' => 'Restore Berhasil! Pengajuan SK hari ini sudah kembali.']);
        }

        return response()->json(['message' => 'Gagal membuka file ZIP'], 500);
    }
}
