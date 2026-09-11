<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FileUploadController extends Controller
{
    /**
     * POST /api/media/upload
     */
    public function upload(Request $request): JsonResponse
    {
        // Validate folder and disk first
        $request->validate([
            'folder' => 'nullable|string',
            'disk' => 'nullable|string|in:local,public,s3',
        ]);

        // Conditional validation: ijazah folder requires PDF only, max 5MB
        if ($request->folder && str_starts_with($request->folder, 'ijazah')) {
            $request->validate([
                'file' => 'required|file|mimes:pdf|max:5120',
            ], [
                'file.mimes' => 'File ijazah harus berformat PDF.',
                'file.max' => 'Ukuran file ijazah maksimal 5 MB.',
            ]);
        } else {
            $request->validate([
                'file' => 'required|file|max:10240', // 10MB limit for other folders
            ]);
        }

        $file = $request->file('file');
        $disk = $request->disk ?? (config('filesystems.disks.s3.key') ? 's3' : 'public');
        $folder = $request->folder ?? 'uploads';

        $filename = Str::random(40) . '.' . $file->getClientOriginalExtension();
        
        try {
            $path = $file->storeAs($folder, $filename, $disk);
            
            if (!$path) {
                return response()->json([
                    'error' => 'Failed to store file. Check storage configuration.'
                ], 500);
            }

            // For S3/MinIO, return the relative path instead of the internal URL
            // The frontend will route through /api/files/view/{path} for authenticated access
            if ($disk === 's3') {
                $url = $path; // Just the relative path (e.g., "sk-requests/abc.pdf")
            } else {
                $url = Storage::disk($disk)->url($path);
            }

            return response()->json([
                'url' => $url,
                'path' => $path,
                'disk' => $disk,
                'filename' => $file->getClientOriginalName()
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Upload failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * DELETE /api/files (or /api/media/delete)
     */
    public function delete(Request $request): JsonResponse
    {
        $request->validate([
            'path' => 'required|string',
            'disk' => 'nullable|string|in:public,s3',
        ]);

        $user = $request->user();
        if (! $user) {
            abort(401, 'Unauthenticated.');
        }

        $rawPath = (string) $request->input('path');
        // Normalize path
        $path = str_replace('\\', '/', $rawPath);

        // 1. Path traversal protection: block '..', leading slashes, absolute paths, drive letters, null bytes
        if (
            str_contains($path, '..')
            || str_starts_with($path, '/')
            || str_contains($path, ':')
            || str_contains($path, "\0")
        ) {
            abort(403, 'Akses ditolak: Pola path traversal terdeteksi.');
        }

        // 2. Disk allowlist
        $allowedDisks = ['public', 's3'];
        $disk = $request->disk ?? (config('filesystems.disks.s3.key') ? 's3' : 'public');
        if (! in_array($disk, $allowedDisks, true)) {
            abort(403, 'Akses ditolak: Disk penyimpanan tidak diizinkan.');
        }

        // 3. Protected system directories (restricted to super_admin)
        $protectedFolders = ['sk-templates', 'templates', 'backups', 'system', 'logs', 'seeds'];
        foreach ($protectedFolders as $folder) {
            if (str_starts_with($path, $folder . '/') || $path === $folder) {
                if ($user->role !== 'super_admin') {
                    abort(403, 'Akses ditolak: Hanya Super Admin yang dapat menghapus file pada direktori sistem/template.');
                }
            }
        }

        // 4. Operator tenant isolation
        if ($user->role === 'operator') {
            if ($user->school_id && preg_match('/schools?[_\/](\d+)/', $path, $matches)) {
                $fileSchoolId = (int) $matches[1];
                if ($fileSchoolId !== (int) $user->school_id) {
                    abort(403, 'Akses ditolak: Anda tidak berwenang menghapus file milik madrasah lain.');
                }
            }
        }

        if (Storage::disk($disk)->exists($path)) {
            Storage::disk($disk)->delete($path);

            \App\Models\ActivityLog::log(
                description: "Hapus file: {$path} pada disk {$disk}",
                event: 'delete_file',
                logName: 'media',
                causer: $user,
                schoolId: $user->school_id
            );

            return response()->json(['success' => true]);
        }

        return response()->json(['error' => 'File not found'], 404);
    }

    /**
     * GET /api/files/view/{path}
     * Serve file with authentication
     */
    public function view(Request $request, string $path)
    {
        // Decode path if it's URL encoded
        $path = urldecode($path);

        // Normalize slashes
        $path = str_replace('\\', '/', $path);

        // 1. Path traversal protection: block '..', leading slashes, absolute paths, drive letters, null bytes
        if (
            str_contains($path, '..')
            || str_starts_with($path, '/')
            || str_contains($path, ':')
            || str_contains($path, "\0")
        ) {
            abort(403, 'Akses ditolak: Pola path traversal terdeteksi.');
        }

        // Extract path if it's a full URL
        if (filter_var($path, FILTER_VALIDATE_URL)) {
            $parsedPath = parse_url($path, PHP_URL_PATH);
            if ($parsedPath) {
                $path = $parsedPath;
            }
        }
        
        // Remove leading slash
        $path = ltrim($path, '/');
        
        // If it starts with storage/, remove it because the public disk roots at storage/app/public
        if (str_starts_with($path, 'storage/')) {
            $path = substr($path, strlen('storage/'));
        }
        
        // Strip bucket name if accidentally included in the path
        if (str_starts_with($path, 'simmaci-storage/')) {
            $path = substr($path, strlen('simmaci-storage/'));
        }
        
        // 2. Disk allowlist: ONLY allow 'public' and 's3' (disallow 'local' or arbitrary disks)
        $allowedDisks = ['public', 's3'];
        $disk = $request->query('disk', config('filesystems.disks.s3.key') ? 's3' : 'public');
        if (! in_array($disk, $allowedDisks, true)) {
            abort(403, 'Akses ditolak: Disk penyimpanan tidak diizinkan.');
        }

        $user = $request->user();

        // 3. Protected system directories (restricted to super_admin)
        $protectedFolders = ['sk-templates', 'templates', 'backups', 'system', 'logs', 'seeds'];
        foreach ($protectedFolders as $folder) {
            if (str_starts_with($path, $folder . '/') || $path === $folder) {
                if (! $user || $user->role !== 'super_admin') {
                    abort(403, 'Akses ditolak: Hanya Super Admin yang dapat mengakses file pada direktori sistem/template.');
                }
            }
        }

        // 4. Operator tenant isolation on school-prefixed paths (e.g. schools/123/... or school_123/...)
        if ($user && $user->role === 'operator') {
            if ($user->school_id && preg_match('/schools?[_\/](\d+)/', $path, $matches)) {
                $fileSchoolId = (int) $matches[1];
                if ($fileSchoolId !== (int) $user->school_id) {
                    abort(403, 'Akses ditolak: Anda tidak berwenang mengakses file milik madrasah lain.');
                }
            }
        }
        
        // Check if file exists
        if (!Storage::disk($disk)->exists($path)) {
            // Fallback: if we checked s3 but it failed, try the local public disk
            if ($disk === 's3' && Storage::disk('public')->exists($path)) {
                $disk = 'public';
            } else {
                return response()->json([
                    'error' => 'File not found',
                    'path' => $path
                ], 404);
            }
        }

        // Stream the file instead of loading entirely into memory to prevent 504 Timeouts
        $mimeType = Storage::disk($disk)->mimeType($path);
        
        return Storage::disk($disk)->response($path, basename($path), [
            'Content-Type' => $mimeType,
            'Content-Disposition' => 'inline; filename="' . basename($path) . '"'
        ]);
    }
}
