<?php
namespace App\Models;
use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentAttendanceLog extends Model
{
    use HasFactory, HasTenantScope, AuditLogTrait;

    protected $fillable = ['school_id','class_id','subject_id','tanggal','jam_ke','logs','latitude','longitude','location_verified'];
    protected function casts(): array { return ['logs' => 'array']; }
    public function school() { return $this->belongsTo(School::class); }
    public function schoolClass() { return $this->belongsTo(SchoolClass::class, 'class_id'); }
    public function subject() { return $this->belongsTo(Subject::class); }
}
