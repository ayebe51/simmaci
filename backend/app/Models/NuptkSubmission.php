<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;

class NuptkSubmission extends Model
{
    use HasTenantScope, AuditLogTrait;

    protected $fillable = [
        'teacher_id', 'school_id', 'status',
        'dokumen_ktp_id', 'dokumen_ijazah_id',
        'dokumen_pengangkatan_id', 'dokumen_penugasan_id',
        'nomor_surat_rekomendasi', 'tanggal_surat_rekomendasi',
        'submitted_at', 'approved_at', 'approver_id', 'rejection_reason',
    ];

    protected function casts(): array
    {
        return ['submitted_at' => 'datetime', 'approved_at' => 'datetime'];
    }

    public function teacher() { return $this->belongsTo(Teacher::class); }
    public function school() { return $this->belongsTo(School::class); }

    public function scopeByStatus($query, string $s) { return $query->where('status', $s); }
}
