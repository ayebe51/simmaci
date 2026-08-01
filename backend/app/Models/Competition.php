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

    public function results()
    {
        return $this->hasMany(CompetitionResult::class);
    }

    /**
     * Count participants already registered from a given school.
     */
    public function countFromSchool(int $schoolId): int
    {
        return $this->participants()->where('school_id', $schoolId)->count();
    }
}
