<?php
namespace App\Models;
use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;

class SchoolClass extends Model
{
    use HasTenantScope, AuditLogTrait;

    protected $table = 'classes';
    protected $fillable = ['nama', 'tingkat', 'tahun_ajaran', 'wali_kelas_id', 'school_id', 'is_active'];
    protected function casts(): array { return ['is_active' => 'boolean']; }
    public function school() { return $this->belongsTo(School::class); }
    public function waliKelas() { return $this->belongsTo(Teacher::class, 'wali_kelas_id'); }
    public function scopeActive($q) { return $q->where('is_active', true); }
}
