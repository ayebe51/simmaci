<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

/**
 * MeetingPhoto Model
 *
 * Represents a photo uploaded for a meeting (kegiatan rapat).
 * Stores metadata about the photo including file path, dimensions, and uploader info.
 *
 * @property int $id
 * @property int $meeting_id FK to meetings
 * @property string $storage_path Path to file in Laravel Storage (relative: meetings/{meeting_id}/photos/{filename})
 * @property string $thumbnail_path Path to thumbnail in Laravel Storage
 * @property string $original_filename Original filename as uploaded
 * @property int $file_size File size in bytes
 * @property int $width Image width in pixels
 * @property int $height Image height in pixels
 * @property string $mime_type MIME type (e.g., image/jpeg, image/png)
 * @property int $uploaded_by FK to users (user who uploaded the photo)
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 *
 * @property-read Meeting $meeting
 * @property-read User $uploader
 */
class MeetingPhoto extends Model
{
    use HasFactory, SoftDeletes, AuditLogTrait;

    protected $table = 'meeting_photos';

    protected $fillable = [
        'meeting_id',
        'storage_path',
        'thumbnail_path',
        'original_filename',
        'file_size',
        'width',
        'height',
        'mime_type',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    // ── Relationships ──

    /**
     * Get the meeting this photo belongs to.
     *
     * @return BelongsTo
     */
    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class);
    }

    /**
     * Get the user who uploaded this photo.
     *
     * @return BelongsTo
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    // ── Methods ──

    /**
     * Get the full URL to the photo file.
     *
     * @return string
     */
    public function getPhotoUrl(): string
    {
        return Storage::url($this->storage_path);
    }

    /**
     * Get the full URL to the thumbnail file.
     *
     * @return string
     */
    public function getThumbnailUrl(): string
    {
        return $this->thumbnail_path ? Storage::url($this->thumbnail_path) : $this->getPhotoUrl();
    }

    /**
     * Delete the photo file and thumbnail from storage.
     *
     * This method is called before the model is deleted.
     * It removes both the original file and the thumbnail.
     *
     * @return void
     */
    public function deleteFiles(): void
    {
        // Delete original file
        if (Storage::exists($this->storage_path)) {
            Storage::delete($this->storage_path);
        }

        // Delete thumbnail
        if ($this->thumbnail_path && Storage::exists($this->thumbnail_path)) {
            Storage::delete($this->thumbnail_path);
        }
    }

    /**
     * Boot the model.
     *
     * Register event listeners for the model.
     *
     * @return void
     */
    protected static function boot(): void
    {
        parent::boot();

        // Delete files when model is deleted (soft delete)
        static::deleting(function (self $photo) {
            if ($photo->isForceDeleting()) {
                $photo->deleteFiles();
            }
        });

        // Delete files when model is force deleted
        static::forceDeleted(function (self $photo) {
            $photo->deleteFiles();
        });
    }
}
