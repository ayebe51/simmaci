<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Meeting\UploadPhotosRequest;
use App\Models\Meeting;
use App\Models\MeetingPhoto;
use App\Services\MeetingPhotoService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * MeetingPhotoController
 *
 * Handles REST API endpoints for meeting photo management.
 * Provides endpoints for uploading, viewing, deleting, and downloading photos.
 *
 * **Validates: Requirements 34**
 */
class MeetingPhotoController extends Controller
{
    use ApiResponse;

    public function __construct(
        private MeetingPhotoService $photoService,
    ) {}

    /**
     * Get all photos for a meeting.
     *
     * Returns gallery data with photo URLs and metadata.
     *
     * @param Meeting $meeting
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Meeting $meeting, Request $request): JsonResponse
    {
        // Check access for operators
        $user = $request->user();
        if ($user->role === 'operator' && $user->school_id) {
            $hasAccess = $meeting->schools()->where('school_id', $user->school_id)->exists();
            if (!$hasAccess) {
                return $this->errorResponse('Anda tidak memiliki akses ke rapat ini.', null, 403);
            }
        }

        try {
            $galleryData = $this->photoService->getGalleryData($meeting);
            $photoCount = $this->photoService->getPhotoCount($meeting);

            return $this->successResponse([
                'photos' => $galleryData,
                'count' => $photoCount,
            ], 'Foto rapat berhasil diambil.');
        } catch (\Exception $e) {
            \Log::error('Failed to get meeting photos', [
                'meeting_id' => $meeting->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Gagal mengambil foto rapat. Silakan coba lagi.', null, 500);
        }
    }

    /**
     * Upload photos for a meeting.
     *
     * Only super_admin and admin_yayasan can upload photos.
     * Accepts multiple photos in a single request.
     *
     * @param UploadPhotosRequest $request
     * @param Meeting $meeting
     * @return JsonResponse
     */
    public function store(UploadPhotosRequest $request, Meeting $meeting): JsonResponse
    {
        try {
            $uploadedPhotos = [];

            foreach ($request->file('photos') as $file) {
                $photo = $this->photoService->uploadPhoto(
                    $meeting,
                    $file,
                    $request->user()
                );

                $uploadedPhotos[] = [
                    'id' => $photo->id,
                    'original_filename' => $photo->original_filename,
                    'photo_url' => "/meetings/{$meeting->id}/photos/{$photo->id}/file",
                    'thumbnail_url' => "/meetings/{$meeting->id}/photos/{$photo->id}/thumbnail",
                    'file_size' => $photo->file_size,
                    'width' => $photo->width,
                    'height' => $photo->height,
                    'uploaded_at' => $photo->created_at->toIso8601String(),
                ];
            }

            return $this->successResponse([
                'photos' => $uploadedPhotos,
                'count' => count($uploadedPhotos),
            ], 'Foto berhasil diunggah.', 201);
        } catch (\Exception $e) {
            \Log::error('Failed to upload meeting photos', [
                'meeting_id' => $meeting->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse($e->getMessage(), null, 400);
        }
    }

    /**
     * Serve a photo file (stream from private storage).
     *
     * Photos are stored on the local (private) disk, so they need to be
     * served through an authenticated endpoint.
     *
     * @param Meeting $meeting
     * @param MeetingPhoto $photo
     * @return \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
     */
    public function show(Meeting $meeting, MeetingPhoto $photo)
    {
        // Verify photo belongs to the meeting
        if ($photo->meeting_id !== $meeting->id) {
            return $this->errorResponse('Foto tidak ditemukan untuk rapat ini.', null, 404);
        }

        try {
            if (!\Illuminate\Support\Facades\Storage::exists($photo->storage_path)) {
                return $this->errorResponse('File foto tidak ditemukan.', null, 404);
            }

            return response()->stream(function () use ($photo) {
                echo \Illuminate\Support\Facades\Storage::get($photo->storage_path);
            }, 200, [
                'Content-Type' => $photo->mime_type ?? 'image/jpeg',
                'Content-Disposition' => 'inline; filename="' . $photo->original_filename . '"',
                'Cache-Control' => 'public, max-age=86400',
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to serve meeting photo', [
                'meeting_id' => $meeting->id,
                'photo_id' => $photo->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Gagal memuat foto.', null, 500);
        }
    }

    /**
     * Serve a photo thumbnail (stream from private storage).
     *
     * @param Meeting $meeting
     * @param MeetingPhoto $photo
     * @return \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
     */
    public function thumbnail(Meeting $meeting, MeetingPhoto $photo)
    {
        // Verify photo belongs to the meeting
        if ($photo->meeting_id !== $meeting->id) {
            return $this->errorResponse('Foto tidak ditemukan untuk rapat ini.', null, 404);
        }

        try {
            $path = $photo->thumbnail_path ?? $photo->storage_path;

            if (!\Illuminate\Support\Facades\Storage::exists($path)) {
                // Fallback to original if thumbnail doesn't exist
                $path = $photo->storage_path;
                if (!\Illuminate\Support\Facades\Storage::exists($path)) {
                    return $this->errorResponse('File foto tidak ditemukan.', null, 404);
                }
            }

            return response()->stream(function () use ($path) {
                echo \Illuminate\Support\Facades\Storage::get($path);
            }, 200, [
                'Content-Type' => $photo->mime_type ?? 'image/jpeg',
                'Content-Disposition' => 'inline; filename="thumb_' . $photo->original_filename . '"',
                'Cache-Control' => 'public, max-age=86400',
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to serve meeting photo thumbnail', [
                'meeting_id' => $meeting->id,
                'photo_id' => $photo->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Gagal memuat thumbnail.', null, 500);
        }
    }

    /**
     * Delete a photo from a meeting.
     *
     * Only super_admin and admin_yayasan can delete photos.
     *
     * @param Meeting $meeting
     * @param MeetingPhoto $photo
     * @return JsonResponse
     */
    public function destroy(Meeting $meeting, MeetingPhoto $photo): JsonResponse
    {
        // Verify photo belongs to the meeting
        if ($photo->meeting_id !== $meeting->id) {
            return $this->errorResponse('Foto tidak ditemukan untuk rapat ini.', null, 404);
        }

        try {
            $this->photoService->deletePhoto($photo);

            return $this->successResponse(null, 'Foto berhasil dihapus.');
        } catch (\Exception $e) {
            \Log::error('Failed to delete meeting photo', [
                'meeting_id' => $meeting->id,
                'photo_id' => $photo->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Gagal menghapus foto. Silakan coba lagi.', null, 500);
        }
    }

    /**
     * Download all photos as a ZIP file.
     *
     * Only super_admin and admin_yayasan can download photos.
     *
     * @param Meeting $meeting
     * @return \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
     */
    public function download(Meeting $meeting)
    {
        try {
            return $this->photoService->downloadPhotosAsZip($meeting);
        } catch (\Exception $e) {
            \Log::error('Failed to download meeting photos', [
                'meeting_id' => $meeting->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse($e->getMessage(), null, 400);
        }
    }
}
