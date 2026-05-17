<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * MeetingParticipant Model
 *
 * Represents a registered participant in a meeting.
 * Stores snapshot data of participant at the time of meeting creation.
 *
 * @property int $id
 * @property int $meeting_id
 * @property string $participant_type One of: 'teacher', 'headmaster', 'external'
 * @property int|null $participant_id FK to teachers table (nullable for external participants)
 * @property string $name Snapshot of participant name
 * @property string $jabatan Snapshot of participant position/title
 * @property string $instansi Snapshot of participant institution/school
 * @property string|null $phone_number Normalized phone number (format: 62xxxxxxxxx) — nullable for external participants
 * @property string|null $qr_token Signed token for QR_Personal (full signed URL)
 * @property bool $is_token_used One-time use tracking flag
 * @property \Illuminate\Support\Carbon|null $token_used_at Timestamp when token was used
 * @property bool $token_revoked Flag for revoked tokens (after QR regeneration)
 * @property int $version Version for optimistic locking fallback
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 *
 * @property-read Meeting $meeting
 * @property-read Teacher|null $teacher
 * @property-read \Illuminate\Database\Eloquent\Collection<MeetingAttendance> $attendances
 */
class MeetingParticipant extends Model
{
    use HasFactory, SoftDeletes, AuditLogTrait;

    protected $fillable = [
        'meeting_id',
        'participant_type',
        'participant_id',
        'name',
        'jabatan',
        'instansi',
        'phone_number',
        'qr_token',
        'is_token_used',
        'token_used_at',
        'token_revoked',
        'version',
    ];

    protected function casts(): array
    {
        return [
            'is_token_used' => 'boolean',
            'token_revoked' => 'boolean',
            'token_used_at' => 'datetime',
        ];
    }

    // ── Relationships ──

    /**
     * Get the meeting this participant belongs to.
     *
     * @return BelongsTo
     */
    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class);
    }

    /**
     * Get the teacher record if this participant is a teacher or headmaster.
     *
     * @return BelongsTo
     */
    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'participant_id');
    }

    /**
     * Get the attendance records for this participant.
     *
     * @return HasMany
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(MeetingAttendance::class, 'participant_id');
    }

    /**
     * Get the latest attendance record for this participant (singular).
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasOne
     */
    public function attendance(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(MeetingAttendance::class, 'participant_id')->latestOfMany('checked_in_at');
    }
}
