<?php
namespace App\Models;
use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TeacherAttendance extends Model
{
    use HasFactory, HasTenantScope, AuditLogTrait;
    protected $fillable = ['teacher_id','school_id','tanggal','jam_masuk','jam_pulang','status','keterangan','scanned_by','latitude','longitude','location_verified'];
    protected function casts(): array { return ['location_verified' => 'boolean', 'latitude' => 'float', 'longitude' => 'float']; }
    public function teacher() { return $this->belongsTo(Teacher::class); }
    public function school() { return $this->belongsTo(School::class); }
}
