<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SkTemplate extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'sk_type',
        'original_filename',
        'file_path',
        'disk',
        'is_active',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    // ── Scopes ──

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForType($query, string $skType)
    {
        return $query->where('sk_type', $skType);
    }
}
