<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class School extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'nsm', 'npsn', 'nama', 'alamat',
        'provinsi', 'kabupaten', 'kecamatan', 'kelurahan',
        'telepon', 'email', 'kepala_madrasah',
        'akreditasi', 'status', 'status_jamiyyah', 'npsm_nu', 'jenjang',
        'kepala_nim', 'kepala_nuptk', 'kepala_whatsapp',
        'kepala_jabatan_mulai', 'kepala_jabatan_selesai',
    ];

    // ── Relationships ──

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function teachers()
    {
        return $this->hasMany(Teacher::class);
    }

    public function students()
    {
        return $this->hasMany(Student::class);
    }

    public function skDocuments()
    {
        return $this->hasMany(SkDocument::class);
    }

    public function headmasterTenures()
    {
        return $this->hasMany(HeadmasterTenure::class);
    }

    public function subjects()
    {
        return $this->hasMany(Subject::class);
    }

    public function classes()
    {
        return $this->hasMany(SchoolClass::class);
    }

    public function attendanceSettings()
    {
        return $this->hasOne(AttendanceSetting::class);
    }

    public function settings()
    {
        return $this->hasMany(Setting::class);
    }

    public function skArchives()
    {
        return $this->hasMany(SkArchive::class);
    }

    // ── Scopes ──

    public function scopeByKecamatan($query, string $kecamatan)
    {
        return $query->where('kecamatan', $kecamatan);
    }
}
