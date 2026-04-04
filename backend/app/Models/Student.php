<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Student extends Model
{
    use SoftDeletes, AuditLogTrait, HasTenantScope;

    protected $fillable = [
        'nisn', 'nik', 'nomor_induk_maarif', 'nama',
        'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir',
        'nama_ayah', 'nama_ibu', 'alamat',
        'provinsi', 'kabupaten', 'kecamatan', 'kelurahan',
        'nama_sekolah', 'npsn', 'school_id', 'kelas',
        'nomor_telepon', 'nama_wali', 'photo_id',
        'is_verified', 'qr_code', 'status', 'last_transition_at',
    ];

    protected function casts(): array
    {
        return [
            'is_verified' => 'boolean',
            'last_transition_at' => 'datetime',
        ];
    }

    // ── Relationships ──

    public function school()
    {
        return $this->belongsTo(School::class);
    }

    // ── Scopes ──

    public function scopeActive($query)
    {
        return $query->where('status', 'Aktif');
    }

    public function scopeForSchool($query, $schoolId)
    {
        return $query->where('school_id', $schoolId);
    }

    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }
}
