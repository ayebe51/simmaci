<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Teacher extends Model
{
    use SoftDeletes, AuditLogTrait, HasTenantScope;

    protected $fillable = [
        'nuptk', 'nomor_induk_maarif', 'nama', 'nip',
        'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir',
        'pendidikan_terakhir', 'mapel', 'unit_kerja', 'school_id',
        'provinsi', 'kabupaten', 'kecamatan', 'kelurahan',
        'status', 'tmt', 'is_certified', 'phone_number', 'email',
        'is_active', 'is_verified', 'is_sk_generated',
        'pdpkpnu', 'photo_id', 'surat_permohonan_url',
        'nomor_surat_permohonan', 'tanggal_surat_permohonan', 'kta_number',
    ];

    protected function casts(): array
    {
        return [
            'is_certified' => 'boolean',
            'is_active' => 'boolean',
            'is_verified' => 'boolean',
            'is_sk_generated' => 'boolean',
        ];
    }

    // ── Relationships ──

    public function school()
    {
        return $this->belongsTo(School::class);
    }

    public function skDocuments()
    {
        return $this->hasMany(SkDocument::class);
    }

    public function headmasterTenures()
    {
        return $this->hasMany(HeadmasterTenure::class);
    }

    public function nuptkSubmissions()
    {
        return $this->hasMany(NuptkSubmission::class);
    }

    public function mutations()
    {
        return $this->hasMany(TeacherMutation::class);
    }

    public function attendances()
    {
        return $this->hasMany(TeacherAttendance::class);
    }

    // ── Scopes ──

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForSchool($query, $schoolId)
    {
        return $query->where('school_id', $schoolId);
    }

    public function scopeVerified($query)
    {
        return $query->where('is_verified', true);
    }
}
