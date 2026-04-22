<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MinioProxyController extends Controller
{
    /**
     * Proxy MinIO requests through backend
     * GET /api/minio/*
     */
    public function proxy(Request $request)
    {
        try {
            // Get the path after /api/minio/
            $path = $request->path();
            $path = str_replace('api/minio/', '', $path);

            // If path is empty, return MinIO health check
            if (empty($path)) {
                return response()->json(['status' => 'ok']);
            }

            // Check if file exists in MinIO
            $disk = Storage::disk('s3');
            
            if (!$disk->exists($path)) {
                return response()->json(['error' => 'File not found'], 404);
            }

            // Get file content
            $content = $disk->get($path);
            $mimeType = $disk->mimeType($path);

            return response($content, 200, [
                'Content-Type' => $mimeType,
                'Content-Disposition' => 'inline; filename="' . basename($path) . '"',
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
