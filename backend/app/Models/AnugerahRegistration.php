<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AnugerahRegistration extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'event_id',
        'competition_id',
        'category',
        'jenjang',
        'applicant_name',
        'applicant_nuptk',
        'school_id',
        'school_name',
        'kecamatan',
        'contact_phone',
        'masa_bakti_tahun',
        'mulai_bertugas',
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
        'prestasi_list',
        'status',
        'rejection_reason',
        'total_score',
        'rank',
        'reviewer_notes',
        'score_breakdown',
        'submitted_at',
        'reviewed_at',
    ];

    protected $casts = [
        'prestasi_list'   => 'array',
        'score_breakdown' => 'array',
        'mulai_bertugas'  => 'date',
        'submitted_at'    => 'datetime',
        'reviewed_at'     => 'datetime',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function competition()
    {
        return $this->belongsTo(Competition::class);
    }

    public function school()
    {
        return $this->belongsTo(School::class);
    }

    /**
     * Calculate total score based on prestasi_list using the Juknis scoring matrix.
     * Juknis scoring per level:
     *   Internasional:  100 / 85 / 70 / 50
     *   Nasional:        80 / 65 / 50 / 35
     *   Provinsi:        60 / 45 / 30 / 20
     *   Kabupaten:       40 / 30 / 20 / 10
     *   Kecamatan:       20 / 15 / 10 /  5
     * LP Ma'arif official competitions get +5 bonus.
     */
    public function calculateScore(): int
    {
        $matrix = [
            'internasional' => [100, 85, 70, 50],
            'nasional'      => [80, 65, 50, 35],
            'provinsi'      => [60, 45, 30, 20],
            'kabupaten'     => [40, 30, 20, 10],
            'kecamatan'     => [20, 15, 10,  5],
        ];

        $total = 0;
        foreach ($this->prestasi_list ?? [] as $item) {
            $level   = strtolower($item['tingkat'] ?? '');
            $juara   = (int) ($item['juara'] ?? 4); // 1=Juara1, 2=Juara2, 3=Juara3, else=Harapan
            $isLpMaarif = (bool) ($item['is_lp_maarif'] ?? false);

            $scores = $matrix[$level] ?? [0, 0, 0, 0];
            $idx    = min(max($juara - 1, 0), 3);
            $pts    = $scores[$idx] ?? 0;

            if ($isLpMaarif) {
                $pts += 5;
            }

            $total += $pts;
        }

        return $total;
    }
}
