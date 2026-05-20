<?php

namespace App\Services;

use App\Models\Meeting;
use App\Models\MeetingPhoto;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use ZipArchive;

/**
 * MeetingPhotoService
 *
 * Handles photo management for meetings including:
 * - Uploading photos with validation (format, size)
 * - Generating thumbnails using PHP GD library
 * - Storing photos in Laravel Storage
 * - Retrieving photos for a meeting
 * - Deleting photos
 * - Downloading all photos as ZIP
 * - Generating gallery data for frontend
 *
 * **Validates: Requirements 34**
 */
class MeetingPhotoService
{
    private const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    private const MAX_PHOTOS_PER_MEETING = 50;
    private const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    private const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    private const THUMBNAIL_WIDTH = 300;
    private const THUMBNAIL_HEIGHT = 300;

    public function __construct() {}

    /**
     * Upload a photo for a meeting.
     *
     * Validates the file, stores it in Laravel Storage, generates a thumbnail,
     * and creates a MeetingPhoto record.
     *
     * @param Meeting $meeting The meeting to upload photo for
     * @param \Illuminate\Http\UploadedFile $file The photo file
     * @param User $uploader The user uploading the photo
     * @return MeetingPhoto The created MeetingPhoto record
     * @throws \Exception If validation fails or upload fails
     */
    public function uploadPhoto(Meeting $meeting, $file, User $uploader): MeetingPhoto
    {
        // Validate file format
        $this->validateFileFormat($file);

        // Validate file size
        $this->validateFileSize($file);

        // Check photo count limit
        $this->validatePhotoCount($meeting);

        // Get image dimensions
        $dimensions = $this->getImageDimensions($file->getPathname());
        $width = $dimensions['width'];
        $height = $dimensions['height'];

        // Generate unique filename
        $filename = $this->generateFilename($file);
        $storagePath = "meetings/{$meeting->id}/photos/{$filename}";

        // Store original photo
        Storage::put($storagePath, file_get_contents($file->getPathname()));

        // Generate and store thumbnail
        $thumbnailPath = $this->generateThumbnail($file->getPathname(), $meeting->id, $filename);

        // Create MeetingPhoto record
        $photo = MeetingPhoto::create([
            'meeting_id' => $meeting->id,
            'original_filename' => $file->getClientOriginalName(),
            'storage_path' => $storagePath,
            'thumbnail_path' => $thumbnailPath,
            'file_size' => $file->getSize(),
            'width' => $width,
            'height' => $height,
            'mime_type' => $file->getMimeType(),
            'uploaded_by' => $uploader->id,
        ]);

        return $photo;
    }

    /**
     * Delete a photo from a meeting.
     *
     * Removes the photo file, thumbnail, and database record.
     *
     * @param MeetingPhoto $photo The photo to delete
     * @return bool True if deletion was successful
     */
    public function deletePhoto(MeetingPhoto $photo): bool
    {
        // Delete files from storage
        $photo->deleteFiles();

        // Delete database record (soft delete)
        return $photo->delete();
    }

    /**
     * Get all photos for a meeting.
     *
     * @param Meeting $meeting The meeting to get photos for
     * @return Collection Collection of MeetingPhoto records
     */
    public function getPhotos(Meeting $meeting): Collection
    {
        return $meeting->photos()
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Get gallery data for frontend display.
     *
     * Returns photo data formatted for frontend gallery component.
     * URLs use the MinIO proxy pattern (/api/minio/{path}) for S3 disk,
     * or the file-serving endpoint for local disk.
     *
     * @param Meeting $meeting The meeting to get gallery data for
     * @return array Array of photo data with URLs and metadata
     */
    public function getGalleryData(Meeting $meeting): array
    {
        $photos = $this->getPhotos($meeting);

        return $photos->map(function (MeetingPhoto $photo) use ($meeting) {
            return [
                'id' => $photo->id,
                'meeting_id' => $photo->meeting_id,
                'original_filename' => $photo->original_filename,
                'photo_url' => $this->getPhotoDisplayUrl($photo->storage_path),
                'thumbnail_url' => $this->getPhotoDisplayUrl($photo->thumbnail_path ?? $photo->storage_path),
                'file_size' => $photo->file_size,
                'width' => $photo->width,
                'height' => $photo->height,
                'mime_type' => $photo->mime_type,
                'uploaded_by' => $photo->uploader?->name ?? 'Admin',
                'uploaded_at' => $photo->created_at->toIso8601String(),
            ];
        })->toArray();
    }

    /**
     * Get the display URL for a photo path.
     *
     * In production (S3/MinIO disk), returns the MinIO proxy path: /minio/{storage_path}
     * In local dev, returns the file-serving endpoint path.
     *
     * @param string $storagePath
     * @return string
     */
    private function getPhotoDisplayUrl(string $storagePath): string
    {
        $disk = config('filesystems.default');

        if ($disk === 's3') {
            // Use MinIO proxy: frontend accesses /api/minio/{path}
            return '/minio/' . $storagePath;
        }

        // Fallback for local disk: use the file-serving endpoint
        // This requires the photo ID, but we only have the path here.
        // For local, use Storage::url() which works with 'serve' => true
        return Storage::url($storagePath);
    }

    /**
     * Download all photos as a ZIP file.
     *
     * Creates a ZIP archive containing all photos for a meeting.
     *
     * @param Meeting $meeting The meeting to download photos for
     * @return StreamedResponse The ZIP file response
     * @throws \Exception If ZIP creation fails
     */
    public function downloadPhotosAsZip(Meeting $meeting): StreamedResponse
    {
        $photos = $this->getPhotos($meeting);

        if ($photos->isEmpty()) {
            throw new \Exception('Tidak ada foto untuk diunduh');
        }

        $zipFilename = "rapat_{$meeting->id}_foto_" . now()->format('Y-m-d_H-i-s') . '.zip';

        return response()->streamDownload(function () use ($photos) {
            $zip = new ZipArchive();
            $tempPath = storage_path('temp/' . uniqid() . '.zip');

            if ($zip->open($tempPath, ZipArchive::CREATE) !== true) {
                throw new \Exception('Gagal membuat file ZIP');
            }

            foreach ($photos as $photo) {
                if (Storage::exists($photo->storage_path)) {
                    $content = Storage::get($photo->storage_path);
                    $zip->addFromString($photo->original_filename, $content);
                }
            }

            $zip->close();

            // Output the ZIP file
            echo file_get_contents($tempPath);

            // Clean up temp file
            @unlink($tempPath);
        }, $zipFilename, [
            'Content-Type' => 'application/zip',
        ]);
    }

    /**
     * Get photo count for a meeting.
     *
     * @param Meeting $meeting The meeting to count photos for
     * @return int The number of photos
     */
    public function getPhotoCount(Meeting $meeting): int
    {
        return $meeting->photos()->count();
    }

    /**
     * Validate file format.
     *
     * @param \Illuminate\Http\UploadedFile $file The file to validate
     * @throws \Exception If file format is not allowed
     */
    private function validateFileFormat($file): void
    {
        $mimeType = $file->getMimeType();
        $extension = strtolower($file->getClientOriginalExtension());

        if (!in_array($mimeType, self::ALLOWED_MIME_TYPES) || !in_array($extension, self::ALLOWED_EXTENSIONS)) {
            throw new \Exception('Format file tidak didukung. Gunakan JPEG, PNG, WebP, atau GIF.');
        }
    }

    /**
     * Validate file size.
     *
     * @param \Illuminate\Http\UploadedFile $file The file to validate
     * @throws \Exception If file size exceeds limit
     */
    private function validateFileSize($file): void
    {
        if ($file->getSize() > self::MAX_FILE_SIZE) {
            throw new \Exception('Ukuran file terlalu besar. Maksimal 10 MB per foto.');
        }
    }

    /**
     * Validate photo count limit.
     *
     * @param Meeting $meeting The meeting to check photo count for
     * @throws \Exception If photo count exceeds limit
     */
    private function validatePhotoCount(Meeting $meeting): void
    {
        $currentCount = $this->getPhotoCount($meeting);

        if ($currentCount >= self::MAX_PHOTOS_PER_MEETING) {
            throw new \Exception(
                "Maksimal " . self::MAX_PHOTOS_PER_MEETING . " foto per rapat. " .
                "Anda sudah memiliki {$currentCount} foto."
            );
        }
    }

    /**
     * Generate a unique filename for the photo.
     *
     * @param \Illuminate\Http\UploadedFile $file The file to generate filename for
     * @return string The generated filename
     */
    private function generateFilename($file): string
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $timestamp = now()->format('YmdHis');
        $random = str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT);

        return "{$timestamp}_{$random}.{$extension}";
    }

    /**
     * Get image dimensions using PHP GD library.
     *
     * @param string $filePath The path to the image file
     * @return array Array with 'width' and 'height' keys
     * @throws \Exception If unable to get image dimensions
     */
    private function getImageDimensions(string $filePath): array
    {
        $imageInfo = @getimagesize($filePath);

        if ($imageInfo === false) {
            throw new \Exception('Gagal membaca dimensi gambar');
        }

        return [
            'width' => $imageInfo[0],
            'height' => $imageInfo[1],
        ];
    }

    /**
     * Generate and store a thumbnail for the photo.
     *
     * @param string $filePath The path to the original image file
     * @param int $meetingId The meeting ID
     * @param string $filename The original filename
     * @return string The path to the thumbnail
     * @throws \Exception If thumbnail generation fails
     */
    private function generateThumbnail(string $filePath, int $meetingId, string $filename): string
    {
        // Get original image info
        $imageInfo = @getimagesize($filePath);
        if ($imageInfo === false) {
            throw new \Exception('Gagal membaca gambar untuk membuat thumbnail');
        }

        $originalWidth = $imageInfo[0];
        $originalHeight = $imageInfo[1];
        $mimeType = $imageInfo['mime'];

        // Create image resource based on MIME type
        $sourceImage = match ($mimeType) {
            'image/jpeg' => @imagecreatefromjpeg($filePath),
            'image/png' => @imagecreatefrompng($filePath),
            'image/gif' => @imagecreatefromgif($filePath),
            'image/webp' => @imagecreatefromwebp($filePath),
            default => null,
        };

        if ($sourceImage === false || $sourceImage === null) {
            throw new \Exception('Gagal membaca format gambar');
        }

        // Calculate thumbnail dimensions (maintain aspect ratio)
        $ratio = min(self::THUMBNAIL_WIDTH / $originalWidth, self::THUMBNAIL_HEIGHT / $originalHeight);
        $thumbWidth = (int) ($originalWidth * $ratio);
        $thumbHeight = (int) ($originalHeight * $ratio);

        // Create thumbnail image
        $thumbnail = imagecreatetruecolor($thumbWidth, $thumbHeight);

        // Preserve transparency for PNG and GIF
        if ($mimeType === 'image/png' || $mimeType === 'image/gif') {
            imagecolortransparent($thumbnail, imagecolorallocatealpha($thumbnail, 0, 0, 0, 127));
            imagealphablending($thumbnail, false);
            imagesavealpha($thumbnail, true);
        }

        // Resize image
        imagecopyresampled(
            $thumbnail,
            $sourceImage,
            0,
            0,
            0,
            0,
            $thumbWidth,
            $thumbHeight,
            $originalWidth,
            $originalHeight
        );

        // Generate thumbnail filename
        $pathInfo = pathinfo($filename);
        $thumbnailFilename = $pathInfo['filename'] . '_thumb.' . $pathInfo['extension'];
        $thumbnailPath = "meetings/{$meetingId}/photos/thumbnails/{$thumbnailFilename}";

        // Save thumbnail based on original format
        ob_start();
        match ($mimeType) {
            'image/jpeg' => imagejpeg($thumbnail, null, 85),
            'image/png' => imagepng($thumbnail),
            'image/gif' => imagegif($thumbnail),
            'image/webp' => imagewebp($thumbnail, null, 85),
        };
        $thumbnailContent = ob_get_clean();

        // Store thumbnail
        Storage::put($thumbnailPath, $thumbnailContent);

        // Free up memory
        imagedestroy($sourceImage);
        imagedestroy($thumbnail);

        return $thumbnailPath;
    }
}
