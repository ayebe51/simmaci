<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Competition extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'event_id',
        'name',
        'category',
        'type',
        'jenjang',
        'lomba_type',
        'date',
        'location',
        'status',
        'deadline',
        'scoring_criteria',
        'max_per_school',
    ];

    protected $casts = [
        'date'             => 'date',
        'deadline'         => 'datetime',
        'scoring_criteria' => 'array',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function participants()
    {
        return $this->hasMany(CompetitionParticipant::class);
    }

    public function anugerahRegistrations()
    {
        return $this->hasMany(AnugerahRegistration::class);
    }

    public function results()
    {
        return $this->hasMany(CompetitionResult::class);
    }

    /**
     * Total participants count combining festival participants and anugerah registrations.
     */
    public function getParticipantsCountAttribute($value): int
    {
        $count = (int) ($value ?? 0);

        if (isset($this->attributes['anugerah_registrations_count'])) {
            $count += (int) $this->attributes['anugerah_registrations_count'];
        } elseif ($this->relationLoaded('anugerahRegistrations')) {
            $count += $this->anugerahRegistrations->count();
        }

        return $count;
    }

    /**
     * Count participants already registered from a given school.
     */
    public function countFromSchool(int $schoolId): int
    {
        return $this->participants()->where('school_id', $schoolId)->count();
    }

    /**
     * Check if scores/evaluation for this competition are locked.
     */
    public function isScoresLocked(): bool
    {
        // 1. Global lock
        if (\App\Models\Setting::getValue('all_competition_scores_locked') === 'true') {
            return true;
        }

        // 2. Per-competition lock setting
        if (\App\Models\Setting::getValue("competition_scores_locked_{$this->id}") === 'true') {
            return true;
        }

        // 3. Competition status FINISHED or LOCKED
        if (in_array(strtoupper((string) $this->status), ['FINISHED', 'LOCKED'], true)) {
            return true;
        }

        return false;
    }

    /**
     * Lock scores for this competition.
     */
    public function lockScores(): void
    {
        \App\Models\Setting::setValue("competition_scores_locked_{$this->id}", 'true');
        $this->update(['status' => 'FINISHED']);
    }

    /**
     * Unlock scores for this competition.
     */
    public function unlockScores(): void
    {
        \App\Models\Setting::setValue("competition_scores_locked_{$this->id}", 'false');
        $this->update(['status' => 'OPEN']);
    }

    /**
     * Lock scores for ALL competitions globally.
     */
    public static function lockAllScores(): void
    {
        \App\Models\Setting::setValue('all_competition_scores_locked', 'true');
        static::query()->update(['status' => 'FINISHED']);
    }

    /**
     * Unlock scores for ALL competitions globally.
     */
    public static function unlockAllScores(): void
    {
        \App\Models\Setting::setValue('all_competition_scores_locked', 'false');
        foreach (static::all() as $c) {
            \App\Models\Setting::setValue("competition_scores_locked_{$c->id}", 'false');
        }
        static::query()->update(['status' => 'OPEN']);
    }
}

