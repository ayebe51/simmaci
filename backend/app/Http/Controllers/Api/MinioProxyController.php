<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MinioProxyController extends Controller
{
    /**
     * MIME type map for common file extensions.
     * Used as fallback when S3/MinIO doesn't return a MIME type.
     */
    private const MIME_MAP = [
        'pdf'  => 'application/pdf',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc'  => 'application/msword',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xls'  => 'application/vnd.ms-excel',
        'png'  => 'image/png',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif'  => 'image/gif',
        'svg'  => 'image/svg+xml',
        'txt'  => 'text/plain',
        'zip'  => 'application/zip',
    ];

    /**
     * Proxy MinIO requests through backend
     * GET /api/minio
     * GET /api/minio/{path}
     */
    public function proxy(Request $request, $path = null)
    {
        try {
            // If no path provided, return health check
            if (empty($path)) {
                return response()->json(['status' => 'ok', 'message' => 'MinIO proxy is working']);
            }

            // URL-decode the path in case it was encoded (e.g. %3D for = in base64 filenames)
            $path = urldecode($path);

            // Normalize slashes
            $path = str_replace('\\', '/', $path);

            // Path traversal protection: block '..', leading slashes, drive letters, null bytes
            if (
                str_contains($path, '..')
                || str_starts_with($path, '/')
                || str_contains($path, ':')
                || str_contains($path, "\0")
            ) {
                return response()->json(['error' => 'Akses ditolak: Pola path traversal terdeteksi.'], 403);
            }

            // Strip bucket name prefix if present (e.g. "simmaci-storage/sk-templates/..." -> "sk-templates/...")
            $bucket = config('filesystems.disks.s3.bucket', 'simmaci-storage');
            if (str_starts_with($path, $bucket . '/')) {
                $path = substr($path, strlen($bucket) + 1);
            }

            // Authentication check: user must be authenticated via Sanctum token
            $user = $request->user('sanctum') ?? auth('sanctum')->user();
            if (! $user && $request->filled('token')) {
                $personalAccessToken = \Laravel\Sanctum\PersonalAccessToken::findToken($request->query('token'));
                if ($personalAccessToken) {
                    $user = $personalAccessToken->tokenable;
                }
            }
            if (! $user) {
                return response()->json(['error' => 'Unauthenticated.'], 401);
            }

            // Protected system directories (restricted to super_admin)
            $protectedFolders = ['sk-templates', 'templates', 'backups', 'system', 'logs', 'seeds'];
            foreach ($protectedFolders as $folder) {
                if (str_starts_with($path, $folder . '/') || $path === $folder) {
                    if ($user->role !== 'super_admin') {
                        return response()->json(['error' => 'Akses ditolak: Hanya Super Admin yang dapat mengakses file pada direktori sistem/template.'], 403);
                    }
                }
            }

            // Operator tenant isolation on school-prefixed paths (e.g. schools/123/... or school_123/...)
            if ($user->role === 'operator') {
                if ($user->school_id && preg_match('/schools?[_\/](\d+)/', $path, $matches)) {
                    $fileSchoolId = (int) $matches[1];
                    if ($fileSchoolId !== (int) $user->school_id) {
                        return response()->json(['error' => 'Akses ditolak: Anda tidak berwenang mengakses file milik madrasah lain.'], 403);
                    }
                }
            }

            // Check if file exists in MinIO
            $disk = Storage::disk('s3');

            if (!$disk->exists($path)) {
                \Log::warning('[MinioProxy] File not found', ['path' => $path, 'bucket' => $bucket]);
                return response()->json(['error' => 'File not found', 'path' => $path], 404);
            }

            // Determine MIME type from extension first to avoid unnecessary remote metadata calls
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            $mimeType = self::MIME_MAP[$ext] ?? null;

            if (!$mimeType) {
                try {
                    $mimeType = $disk->mimeType($path) ?: 'application/octet-stream';
                } catch (\Throwable $e) {
                    $mimeType = 'application/octet-stream';
                }
            }

            // For PDFs and images, serve inline so the browser renders them directly.
            // For other types, force download.
            $inlineTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];
            $disposition = in_array($mimeType, $inlineTypes) ? 'inline' : 'attachment';

            $headers = [
                'Content-Type'           => $mimeType,
                'Cache-Control'          => 'private, max-age=86400, stale-while-revalidate=3600',
                'X-Content-Type-Options' => 'nosniff',
            ];

            // Stream response directly from S3 adapter without loading the entire file into PHP memory
            return $disk->response($path, basename($path), $headers, $disposition);
        } catch (\Exception $e) {
            \Log::error('[MinioProxy] Exception', [
                'path'    => $path ?? 'null',
                'message' => $e->getMessage(),
                'file'    => $e->getFile(),
                'line'    => $e->getLine(),
            ]);
            return response()->json([
                'error' => 'Terjadi kesalahan saat memproses file.',
            ], 500);
        }
    }
}
