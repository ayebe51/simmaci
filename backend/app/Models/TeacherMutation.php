<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;

class TeacherMutation extends Model
{
    use HasTenantScope, AuditLogTrait;

    protected $fillable = [
        'teacher_id', 'school_id', 'from_unit', 'to_unit',
        'reason', 'sk_number', 'effective_date', 'performed_by',
    ];

    public function teacher() { return $this->belongsTo(Teacher::class); }
    public function school() { return $this->belongsTo(School::class); }
}
