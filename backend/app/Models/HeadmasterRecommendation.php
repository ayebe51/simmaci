<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HeadmasterRecommendation extends Model
{
    use HasTenantScope, AuditLogTrait;

    protected $fillable = [
        'school_id',
        'teacher_id',
        'status',
        'documents',
        'submitted_at',
        'approved_at',
        'approver_id',
        'rejection_reason',
        'is_reappointment',
    ];

    protected function casts(): array
    {
        return [
            'documents' => 'array',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
            'is_reappointment' => 'boolean',
        ];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }

    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }
}
