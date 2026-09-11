<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use Illuminate\Database\Eloquent\Model;

class TeacherMutation extends Model
{
    use AuditLogTrait;

    protected $fillable = [
        'teacher_id', 'from_unit', 'to_unit',
        'reason', 'sk_number', 'effective_date', 'performed_by',
    ];

    public function teacher() { return $this->belongsTo(Teacher::class); }
}

