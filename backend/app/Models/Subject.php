<?php
namespace App\Models;
use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;

class Subject extends Model
{
    use HasTenantScope, AuditLogTrait;

    protected $fillable = ['nama', 'kode', 'school_id', 'is_active'];
    protected function casts(): array { return ['is_active' => 'boolean']; }
    public function school() { return $this->belongsTo(School::class); }
    public function scopeActive($q) { return $q->where('is_active', true); }
}
