<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class WaBlast extends Model
{
    use HasFactory, SoftDeletes, AuditLogTrait;

    protected $fillable = [
        'title',
        'recipient_category',
        'school_ids',
        'jenjang_filter',
        'message_body',
        'attachment_path',
        'attachment_name',
        'blast_status',
        'scheduled_at',
        'sent_at',
        'completed_at',
        'total_recipients',
        'sent_count',
        'failed_count',
        'invalid_count',
        'parent_blast_id',
        'created_by',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'school_ids'    => 'array',
            'jenjang_filter' => 'array',
            'scheduled_at'  => 'datetime',
            'sent_at'       => 'datetime',
            'completed_at'  => 'datetime',
        ];
    }

    // ── Relationships ──

    public function recipients(): HasMany
    {
        return $this->hasMany(WaBlastRecipient::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function parentBlast(): BelongsTo
    {
        return $this->belongsTo(WaBlast::class, 'parent_blast_id');
    }

    public function retryBlasts(): HasMany
    {
        return $this->hasMany(WaBlast::class, 'parent_blast_id');
    }

    // ── Scopes ──

    public function scopeByStatus($query, string $status)
    {
        return $query->where('blast_status', $status);
    }

    public function scopeScheduledAndDue($query)
    {
        return $query->where('blast_status', 'scheduled')
            ->where('scheduled_at', '<=', now());
    }
}
