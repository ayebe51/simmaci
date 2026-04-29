<?php

namespace App\Models;

use App\Traits\AuditLogTrait;
use App\Traits\HasTenantScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class HeadmasterTenure extends Model
{
    use SoftDeletes, HasTenantScope, AuditLogTrait;

    protected $fillable = [
        'teacher_id', 'teacher_name', 'school_id', 'school_name',
        'periode', 'start_date', 'end_date', 'status',
        'nomor_sk', 'sk_url', 'surat_permohonan_number', 'surat_permohonan_date',
        'nomor_surat_rekomendasi', 'tanggal_surat_rekomendasi',
        'keterangan', 'approved_by', 'approved_at', 'created_by',
    ];

    protected function casts(): array
    {
        return ['approved_at' => 'datetime'];
    }

    public function teacher() { return $this->belongsTo(Teacher::class); }
    public function school() { return $this->belongsTo(School::class); }

    public function scopeByStatus($query, string $s) { return $query->where('status', $s); }
}
