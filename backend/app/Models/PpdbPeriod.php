<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PpdbPeriod extends Model
{
    use HasFactory, SoftDeletes, AuditLogTrait, HasTenantScope;

    protected $fillable = [
        'school_id',
        'academic_year',
        'wave_name',
        'description',
        'start_date',
        'end_date',
        'announcement_date',
        'reregistration_end_date',
        'quota',
        'is_active',
        'available_tracks',
        'required_documents',
    ];

    protected function casts(): array
    {
        return [
            'start_date'              => 'date',
            'end_date'                => 'date',
            'announcement_date'       => 'date',
            'reregistration_end_date' => 'date',
            'is_active'               => 'boolean',
            'quota'                   => 'integer',
            'available_tracks'        => 'array',
            'required_documents'      => 'array',
        ];
    }

    // ── Relationships ──

    public function school()
    {
        return $this->belongsTo(School::class);
    }

    public function registrations()
    {
        return $this->hasMany(PpdbRegistration::class, 'period_id');
    }

    // ── Scopes ──

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForSchool($query, $schoolId)
    {
        return $query->where(function ($q) use ($schoolId) {
            $q->where('school_id', $schoolId)
              ->orWhereNull('school_id');
        });
    }

    public function scopeOpenNow($query)
    {
        $today = now()->toDateString();
        return $query->where('is_active', true)
                     ->where('start_date', '<=', $today)
                     ->where('end_date', '>=', $today);
    }
}
