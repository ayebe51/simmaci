<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SkDocument extends Model
{
    use HasFactory, SoftDeletes, AuditLogTrait, HasTenantScope;

    protected $fillable = [
        'nomor_sk', 'jenis_sk', 'teacher_id', 'nama',
        'jabatan', 'unit_kerja', 'school_id', 'tanggal_penetapan',
        'status', 'file_url', 'surat_permohonan_url', 'qr_code',
        'tahun_ajaran', 'revision_status', 'revision_reason', 'revision_data',
        'created_by', 'archived_at', 'archived_by', 'archive_reason',
        'nomor_permohonan', 'tanggal_permohonan'
    ];

    protected function casts(): array
    {
        return [
            'revision_data' => 'array',
            'archived_at' => 'datetime',
        ];
    }

    // ── Relationships ──

    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }

    public function school()
    {
        return $this->belongsTo(School::class);
    }

    // ── Scopes ──

    public function scopeByStatus($query, string $status)
    {
        if ($status === 'approved') {
            return $query->whereIn('status', ['approved', 'Approved', 'active', 'Active']);
        }
        if ($status === 'rejected') {
            return $query->whereIn('status', ['rejected', 'Rejected']);
        }
        return $query->where('status', $status);
    }

    public function scopeByJenis($query, string $jenis)
    {
        return $query->where('jenis_sk', $jenis);
    }

    public function scopeForSchool($query, $schoolId)
    {
        return $query->where('school_id', $schoolId);
    }

    public function scopeNotArchived($query)
    {
        return $query->whereNull('archived_at');
    }

    public function scopeWithRevisions($query)
    {
        return $query->whereNotNull('revision_status');
    }
}
