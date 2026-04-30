<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;

class ApprovalHistory extends Model
{
    use HasTenantScope, AuditLogTrait;

    protected $fillable = [
        'school_id', 'document_id', 'document_type', 'action',
        'from_status', 'to_status', 'performed_by',
        'performed_at', 'comment', 'metadata',
    ];

    public function school()
    {
        return $this->belongsTo(\App\Models\School::class);
    }

    protected function casts(): array
    {
        return ['performed_at' => 'datetime', 'metadata' => 'array'];
    }
}
