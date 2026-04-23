<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MinioProxyController extends Controller
{
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

            // Strip bucket name prefix if present (e.g. "simmaci-storage/sk-templates/..." -> "sk-templates/...")
            $bucket = config('filesystems.disks.s3.bucket', 'simmaci-storage');
            if (str_starts_with($path, $bucket . '/')) {
                $path = substr($path, strlen($bucket) + 1);
            }

            // Check if file exists in MinIO
            $disk = Storage::disk('s3');
            
            if (!$disk->exists($path)) {
                return response()->json(['error' => 'File not found', 'path' => $path], 404);
            }

            // Get file content
            $content = $disk->get($path);
            $mimeType = $disk->mimeType($path);

            return response($content, 200, [
                'Content-Type' => $mimeType,
                'Content-Disposition' => 'inline; filename="' . basename($path) . '"',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ], 500);
        }
    }
}
