<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\SkDocument;
use App\Models\TeacherMutation;
use App\Models\User;

class SkPemberhentianService
{
    /**
     * Dipanggil setelah SK Pemberhentian berstatus 'approved'.
     * Menandai guru sebagai non-aktif dan membuat record TeacherMutation.
     */
    public function onApproved(SkDocument $sk, User $approver): void
    {
        if (! $sk->teacher_id || ! $sk->teacher) {
            return;
        }

        $teacher = $sk->teacher;

        // 1. Nonaktifkan guru
        $teacher->update(['is_active' => false]);

        // 2. Buat record TeacherMutation sebagai riwayat pemberhentian
        TeacherMutation::create([
            'teacher_id'     => $teacher->id,
            'school_id'      => $sk->school_id,
            'from_unit'      => $sk->unit_kerja,
            'to_unit'        => null,
            'reason'         => $this->formatAlasan($sk->alasan_pemberhentian),
            'sk_number'      => $sk->nomor_sk,
            'effective_date' => $sk->tanggal_efektif_pemberhentian,
            'performed_by'   => $approver->id,
        ]);

        // 3. Activity log
        $keterangan = $sk->alasan_pemberhentian === 'meninggal_dunia'
            ? "Guru {$teacher->nama} dinyatakan meninggal dunia berdasarkan SK {$sk->nomor_sk}."
            : "Guru {$teacher->nama} diberhentikan berdasarkan SK {$sk->nomor_sk} (alasan: {$sk->alasan_pemberhentian}).";

        ActivityLog::log(
            description: $keterangan,
            event: 'deactivate_teacher_pemberhentian',
            logName: 'sk',
            subject: $teacher,
            causer: $approver,
            schoolId: $sk->school_id
        );
    }

    /**
     * Format nilai enum alasan pemberhentian menjadi label yang readable.
     */
    private function formatAlasan(?string $alasan): string
    {
        $labels = [
            'pengunduran_diri'    => 'Pengunduran Diri',
            'pensiun'             => 'Pensiun',
            'meninggal_dunia'     => 'Meninggal Dunia',
            'pelanggaran_disiplin' => 'Pelanggaran Disiplin',
            'habis_kontrak'       => 'Habis Kontrak',
            'lainnya'             => 'Lainnya',
        ];

        return $labels[$alasan] ?? ($alasan ?? 'Pemberhentian');
    }
}
