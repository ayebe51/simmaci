<?php
namespace App\Models;
use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;

class StudentAttendanceLog extends Model
{
    use HasTenantScope, AuditLogTrait;

    protected $fillable = ['school_id','class_id','subject_id','tanggal','jam_ke','logs'];
    protected function casts(): array { return ['logs' => 'array', 'tanggal' => 'date']; }
    public function school() { return $this->belongsTo(School::class); }
    public function schoolClass() { return $this->belongsTo(SchoolClass::class, 'class_id'); }
    public function subject() { return $this->belongsTo(Subject::class); }
}
