<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class WaBlastRecipient extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'wa_blast_id',
        'recipient_name',
        'school_name',
        'phone_number',
        'recipient_type',
        'delivery_status',
        'error_message',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
        ];
    }

    // ── Relationships ──

    public function blast(): BelongsTo
    {
        return $this->belongsTo(WaBlast::class, 'wa_blast_id');
    }

    // ── Scopes ──

    public function scopePending($query)
    {
        return $query->where('delivery_status', 'pending');
    }

    public function scopeFailed($query)
    {
        return $query->where('delivery_status', 'failed');
    }

    public function scopeSent($query)
    {
        return $query->where('delivery_status', 'sent');
    }

    public function scopeInvalidNumber($query)
    {
        return $query->where('delivery_status', 'invalid_number');
    }
}
