<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * MeetingMinutes Model
 *
 * Represents the minutes/notulensi of a meeting.
 * Stores the meeting summary, decisions, and action items in HTML format.
 *
 * @property int $id
 * @property int $meeting_id
 * @property string $title Title of the minutes (typically same as meeting title)
 * @property string $content HTML content of the minutes from rich text editor
 * @property int $created_by User ID who created the minutes
 * @property int|null $updated_by User ID who last updated the minutes
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 *
 * @property-read Meeting $meeting
 * @property-read User $creator
 * @property-read User|null $updater
 */
class MeetingMinutes extends Model
{
    use HasFactory, SoftDeletes, AuditLogTrait;

    protected $fillable = [
        'meeting_id',
        'title',
        'content',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    // ── Relationships ──

    /**
     * Get the meeting these minutes belong to.
     *
     * @return BelongsTo
     */
    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class);
    }

    /**
     * Get the user who created these minutes.
     *
     * @return BelongsTo
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who last updated these minutes.
     *
     * @return BelongsTo
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
