<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Meeting Model
 *
 * Represents a meeting/rapat at the foundation level (yayasan).
 * Meetings are cross-tenant and involve multiple schools.
 *
 * @property int $id
 * @property string $title
 * @property string|null $agenda
 * @property string $location
 * @property \Illuminate\Support\Carbon $started_at
 * @property \Illuminate\Support\Carbon $ended_at
 * @property bool $geolocation_enabled
 * @property float|null $latitude
 * @property float|null $longitude
 * @property int|null $geolocation_radius_meters
 * @property string|null $qr_umum_token
 * @property int|null $invitation_blast_id
 * @property int|null $reminder_blast_id
 * @property \Illuminate\Support\Carbon|null $reminder_scheduled_at
 * @property int $created_by
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 *
 * @property-read string $status Computed property: 'upcoming', 'ongoing', or 'completed'
 * @property-read \Illuminate\Database\Eloquent\Collection<MeetingParticipant> $participants
 * @property-read \Illuminate\Database\Eloquent\Collection<MeetingAttendance> $attendances
 * @property-read \Illuminate\Database\Eloquent\Collection<School> $schools
 * @property-read User $creator
 * @property-read WaBlast|null $invitationBlast
 * @property-read WaBlast|null $reminderBlast
 */
class Meeting extends Model
{
    use HasFactory, SoftDeletes, AuditLogTrait;

    protected $fillable = [
        'title',
        'agenda',
        'location',
        'started_at',
        'ended_at',
        'geolocation_enabled',
        'latitude',
        'longitude',
        'geolocation_radius_meters',
        'qr_umum_token',
        'invitation_blast_id',
        'reminder_blast_id',
        'reminder_scheduled_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'reminder_scheduled_at' => 'datetime',
            'geolocation_enabled' => 'boolean',
        ];
    }

    // ── Relationships ──

    /**
     * Get the participants registered for this meeting.
     *
     * @return HasMany
     */
    public function participants(): HasMany
    {
        return $this->hasMany(MeetingParticipant::class);
    }

    /**
     * Get the attendance records for this meeting.
     *
     * @return HasMany
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(MeetingAttendance::class);
    }

    /**
     * Get the schools involved in this meeting.
     *
     * @return BelongsToMany
     */
    public function schools(): BelongsToMany
    {
        return $this->belongsToMany(School::class, 'meeting_schools');
    }

    /**
     * Get the user who created this meeting.
     *
     * @return BelongsTo
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the WA blast for the invitation.
     *
     * @return BelongsTo
     */
    public function invitationBlast(): BelongsTo
    {
        return $this->belongsTo(WaBlast::class, 'invitation_blast_id');
    }

    /**
     * Get the WA blast for the reminder.
     *
     * @return BelongsTo
     */
    public function reminderBlast(): BelongsTo
    {
        return $this->belongsTo(WaBlast::class, 'reminder_blast_id');
    }

    // ── Computed Properties ──

    /**
     * Get the status of the meeting based on current time.
     *
     * Returns 'upcoming' if current time is before started_at,
     * 'ongoing' if current time is between started_at and ended_at,
     * 'completed' if current time is after ended_at.
     *
     * @return string
     */
    public function getStatusAttribute(): string
    {
        $now = now();

        if ($now->lt($this->started_at)) {
            return 'upcoming';
        }

        if ($now->gt($this->ended_at)) {
            return 'completed';
        }

        return 'ongoing';
    }
}
