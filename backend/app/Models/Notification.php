<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasTenantScope, AuditLogTrait;

    protected $fillable = [
        'school_id', 'user_id', 'type', 'title', 'message', 'is_read', 'metadata',
    ];

    protected function casts(): array
    {
        return ['is_read' => 'boolean', 'metadata' => 'array'];
    }

    public function user() { return $this->belongsTo(User::class); }
    public function scopeUnread($query) { return $query->where('is_read', false); }
}
