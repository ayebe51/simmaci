<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PpdbRegistration extends Model
{
    use HasFactory, SoftDeletes, AuditLogTrait, HasTenantScope;

    protected $fillable = [
        'registration_number',
        'school_id',
        'period_id',
        'track',
        'nisn',
        'nik',
        'nama_lengkap',
        'jenis_kelamin',
        'tempat_lahir',
        'tanggal_lahir',
        'asal_sekolah',
        'no_whatsapp',
        'email',
        'alamat',
        'provinsi',
        'kabupaten',
        'kecamatan',
        'kelurahan',
        'rt_rw',
        'kode_pos',
        'nama_ayah',
        'pekerjaan_ayah',
        'nama_ibu',
        'pekerjaan_ibu',
        'nama_wali',
        'no_whatsapp_wali',
        'foto_url',
        'kk_url',
        'akta_url',
        'ijazah_url',
        'prestasi_url',
        'additional_documents',
        'status',
        'verification_notes',
        'verified_by',
        'verified_at',
        'test_score',
        'interview_score',
        'achievement_score',
        'final_score',
        'rank',
        'selection_notes',
        'is_reregistered',
        'reregistered_at',
        'student_id',
    ];

    protected function casts(): array
    {
        return [
            'tanggal_lahir'        => 'date',
            'verified_at'          => 'datetime',
            'reregistered_at'      => 'datetime',
            'is_reregistered'      => 'boolean',
            'additional_documents' => 'array',
            'test_score'           => 'decimal:2',
            'interview_score'      => 'decimal:2',
            'achievement_score'    => 'decimal:2',
            'final_score'          => 'decimal:2',
            'rank'                 => 'integer',
        ];
    }

    // ── Relationships ──

    public function school()
    {
        return $this->belongsTo(School::class);
    }

    public function period()
    {
        return $this->belongsTo(PpdbPeriod::class, 'period_id');
    }

    public function verifiedByUser()
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    // ── Scopes ──

    public function scopeForSchool($query, $schoolId)
    {
        return $query->where('school_id', $schoolId);
    }

    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function scopeByPeriod($query, $periodId)
    {
        return $query->where('period_id', $periodId);
    }
}
