<?php
namespace App\Models;
use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;

class AttendanceSetting extends Model
{
    use HasTenantScope, AuditLogTrait;

    protected $fillable = ['school_id','absensi_guru_aktif','absensi_siswa_aktif','scanner_pin','qr_scan_aktif','gowa_url','gowa_device_id'];
    protected function casts(): array { return ['absensi_guru_aktif'=>'boolean','absensi_siswa_aktif'=>'boolean','qr_scan_aktif'=>'boolean']; }
    public function school() { return $this->belongsTo(School::class); }
}
