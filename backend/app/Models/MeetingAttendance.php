<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * MeetingAttendance Model
 *
 * Represents an attendance record for a meeting participant.
 * Records check-in via QR_Personal, QR_Umum (walk-in), or manual check-in by admin.
 *
 * @property int $id
 * @property int $meeting_id
 * @property int|null $participant_id FK to meeting_participants (nullable for walk-in)
 * @property string $attendance_type One of: 'qr_personal', 'qr_umum', 'manual'
 * @property bool $is_delegation Whether this is a delegation check-in
 * @property int|null $delegated_for_participant_id FK to meeting_participants (participant being represented)
 * @property string|null $delegation_letter_path Path to delegation letter file in storage
 * @property string|null $walk_in_name Name of walk-in participant
 * @property string|null $walk_in_jabatan Position/title of walk-in participant
 * @property string|null $walk_in_instansi Institution/school of walk-in participant
 * @property string|null $walk_in_phone Phone number of walk-in participant
 * @property \Illuminate\Support\Carbon $checked_in_at Timestamp of check-in with microsecond precision
 * @property int|null $checked_in_by_admin_id FK to users (admin who performed manual check-in)
 * @property array|null $device_info Device information (browser, OS, device type, IP) as JSONB
 * @property string|null $ip_address IP address of check-in device
 * @property int $version Version for optimistic locking fallback
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 *
 * @property-read Meeting $meeting
 * @property-read MeetingParticipant|null $participant
 * @property-read MeetingParticipant|null $delegatedForParticipant
 * @property-read User|null $checkedInByAdmin
 */
class MeetingAttendance extends Model
{
    use HasFactory, SoftDeletes, AuditLogTrait;

    protected $fillable = [
        'meeting_id',
        'participant_id',
        'attendance_type',
        'is_delegation',
        'delegated_for_participant_id',
        'delegation_letter_path',
        'walk_in_name',
        'walk_in_jabatan',
        'walk_in_instansi',
        'walk_in_phone',
        'checked_in_at',
        'checked_in_by_admin_id',
        'device_info',
        'ip_address',
        'version',
    ];

    protected function casts(): array
    {
        return [
            'is_delegation' => 'boolean',
            'checked_in_at' => 'datetime',
            'device_info' => 'array',
        ];
    }

    /**
     * Serialize dates without UTC 'Z' suffix.
     * App timezone is Asia/Jakarta, so dates should be sent as-is without timezone indicator.
     */
    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d\TH:i:s');
    }

    // ── Relationships ──

    /**
     * Get the meeting this attendance record belongs to.
     *
     * @return BelongsTo
     */
    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class);
    }

    /**
     * Get the participant who checked in.
     *
     * @return BelongsTo
     */
    public function participant(): BelongsTo
    {
        return $this->belongsTo(MeetingParticipant::class, 'participant_id');
    }

    /**
     * Get the participant being represented (for delegation check-in).
     *
     * @return BelongsTo
     */
    public function delegatedForParticipant(): BelongsTo
    {
        return $this->belongsTo(MeetingParticipant::class, 'delegated_for_participant_id');
    }

    /**
     * Get the admin who performed manual check-in.
     *
     * @return BelongsTo
     */
    public function checkedInByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_in_by_admin_id');
    }
}
