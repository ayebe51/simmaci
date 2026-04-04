<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'unit',
        'school_id',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    // ── Relationships ──

    public function school()
    {
        return $this->belongsTo(School::class);
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    // ── Scopes ──

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeSuperAdmin($query)
    {
        return $query->whereIn('role', ['super_admin', 'admin_yayasan', 'admin']);
    }

    // ── Helpers ──

    public function isSuperAdmin(): bool
    {
        return in_array($this->role, ['super_admin', 'admin_yayasan', 'admin']);
    }

    public function isOperator(): bool
    {
        return $this->role === 'operator';
    }
}
