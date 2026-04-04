<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;

class AttendanceArchive extends Model
{
    use HasTenantScope, AuditLogTrait;

    protected $fillable = [
        'school_id', 'type', 'year', 'month',
        'storage_id', 'file_url', 'total_records', 'summary_data', 'archived_by',
    ];

    protected $casts = [
        'summary_data' => 'array',
    ];

    public function school() { return $this->belongsTo(School::class); }
    public function archiver() { return $this->belongsTo(User::class, 'archived_by'); }
}
