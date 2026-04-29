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

            // Strip bucket name prefix if present (e.g. "simmaci-storage/sk-templates/..." -> "sk-templates/...")
            $bucket = config('filesystems.disks.s3.bucket', 'simmaci-storage');
            if (str_starts_with($path, $bucket . '/')) {
                $path = substr($path, strlen($bucket) + 1);
            }

            // Check if file exists in MinIO
            $disk = Storage::disk('s3');

            if (!$disk->exists($path)) {
                \Log::warning('[MinioProxy] File not found', ['path' => $path, 'bucket' => $bucket]);
                return response()->json(['error' => 'File not found', 'path' => $path], 404);
            }

            // Get file content
            $content = $disk->get($path);

            // Determine MIME type — S3/MinIO may return false, so fall back to extension
            $mimeType = $disk->mimeType($path);
            if (!$mimeType || $mimeType === 'application/octet-stream') {
                $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
                $mimeType = self::MIME_MAP[$ext] ?? 'application/octet-stream';
            }

            // For PDFs and images, serve inline so the browser renders them directly.
            // For other types, force download.
            $inlineTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'];
            $disposition = in_array($mimeType, $inlineTypes)
                ? 'inline; filename="' . basename($path) . '"'
                : 'attachment; filename="' . basename($path) . '"';

            return response($content, 200, [
                'Content-Type'        => $mimeType,
                'Content-Disposition' => $disposition,
                'Content-Length'      => strlen($content),
                'Cache-Control'       => 'private, max-age=3600',
                // Override the global nosniff header so the browser trusts our Content-Type
                'X-Content-Type-Options' => 'nosniff',
            ]);
        } catch (\Exception $e) {
            \Log::error('[MinioProxy] Exception', [
                'path'    => $path ?? 'null',
                'message' => $e->getMessage(),
                'file'    => $e->getFile(),
                'line'    => $e->getLine(),
            ]);
            return response()->json([
                'error' => $e->getMessage(),
                'file'  => $e->getFile(),
                'line'  => $e->getLine(),
            ], 500);
        }
    }
}
