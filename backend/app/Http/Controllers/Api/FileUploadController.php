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
        $request->validate([
            'file' => 'required|file|max:10240', // 10MB limit
            'folder' => 'nullable|string',
            'disk' => 'nullable|string|in:local,public,s3'
        ]);

        $file = $request->file('file');
        $disk = $request->disk ?? (env('AWS_ACCESS_KEY_ID') ? 's3' : 'public');
        $folder = $request->folder ?? 'uploads';

        $filename = Str::random(40) . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs($folder, $filename, $disk);

        return response()->json([
            'url' => Storage::disk($disk)->url($path),
            'path' => $path,
            'disk' => $disk,
            'filename' => $file->getClientOriginalName()
        ]);
    }

    /**
     * DELETE /api/media/delete
     */
    public function delete(Request $request): JsonResponse
    {
        $request->validate(['path' => 'required|string', 'disk' => 'nullable|string']);
        
        $disk = $request->disk ?? (env('AWS_ACCESS_KEY_ID') ? 's3' : 'public');
        
        if (Storage::disk($disk)->exists($request->path)) {
            Storage::disk($disk)->delete($request->path);
            return response()->json(['success' => true]);
        }

        return response()->json(['error' => 'File not found'], 404);
    }
}
