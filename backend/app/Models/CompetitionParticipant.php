<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CompetitionParticipant extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'competition_id',
        'name',
        'institution',
        'jenjang',
        'school_id',
        'teacher_id',
        'group_name',
        'member_count',
        'members',
        'gender_category',
        'contact_person',
        'contact_phone',
        'video_url',
        'video_filename',
        'video_status',
        'surat_keterangan_aktif_url',
        'sertifikat_pkpnu_url',
        'surat_rekomendasi_url',
        'surat_keterangan_integritas_url',
        'bukti_prestasi_url',
        'esai_reflektif_url',
        'karya_ilmiah_url',
        'dokumen_pdca_url',
        'portofolio_branding_url',
        'rekap_prestasi_url',
        'dokumen_admin_url',
        'sinopsis_url',
        'registration_status',
    ];

    public function competition()
    {
        return $this->belongsTo(Competition::class);
    }

    public function result()
    {
        return $this->hasOne(CompetitionResult::class, 'participant_id');
    }

    public function school()
    {
        return $this->belongsTo(School::class);
    }

    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }
}

