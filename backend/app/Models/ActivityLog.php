<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    protected $fillable = [
        'log_name',
        'description',
        'subject_id',
        'subject_type',
        'causer_id',
        'causer_type',
        'properties',
        'event',
        'school_id',
    ];

    /**
     * Helper to log an activity
     */
    public static function log(string $description, ?string $event = null, ?string $logName = 'default', ?Model $subject = null, ?Model $causer = null, $schoolId = null)
    {
        return self::create([
            'description' => $description,
            'event' => $event,
            'log_name' => $logName,
            'subject_id' => $subject?->getKey(),
            'subject_type' => $subject ? get_class($subject) : null,
            'causer_id' => $causer?->getKey(),
            'causer_type' => $causer ? get_class($causer) : null,
            'school_id' => $schoolId ?? ($causer && method_exists($causer, 'school') ? $causer->school_id : null),
            'properties' => [],
        ]);
    }

    protected function casts(): array
    {
        return [
            'properties' => 'array',
        ];
    }

    public function subject()
    {
        return $this->morphTo();
    }

    public function causer()
    {
        return $this->morphTo();
    }

    public function school()
    {
        return $this->belongsTo(School::class);
    }
}
