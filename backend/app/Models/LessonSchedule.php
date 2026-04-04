<?php
namespace App\Models;
use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;

class LessonSchedule extends Model
{
    use HasTenantScope, AuditLogTrait;

    protected $fillable = ['jam_ke', 'jam_mulai', 'jam_selesai', 'school_id'];
    public function school() { return $this->belongsTo(School::class); }
}
