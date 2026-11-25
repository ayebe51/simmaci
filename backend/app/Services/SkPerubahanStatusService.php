<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\SkDocument;
use App\Models\TeacherMutation;
use App\Models\User;
use Carbon\Carbon;

class SkPerubahanStatusService
{
    /**
     * Dipanggil setelah SK Perubahan Status berstatus 'approved'.
     *
     * 1. Mencabut dan mengarsipkan SK Tendik lama.
     * 2. Menghitung status baru (GTY jika masa kerja >= 2 tahun, GTT jika < 2 tahun).
     * 3. Memperbarui master data Teacher (nama bergelar, pendidikan S1, status baru).
     * 4. Mencatat riwayat ke TeacherMutation dan ActivityLog.
     */
    public function onApproved(SkDocument $sk, User $approver): void
    {
        // 1. Cabut SK Tendik sebelumnya
        $oldSk = null;
        if ($sk->sk_lama_id) {
            $oldSk = SkDocument::withoutTenantScope()->find($sk->sk_lama_id);
        }

        if (! $oldSk && $sk->teacher_id) {
            $oldSk = SkDocument::withoutTenantScope()
                ->where('teacher_id', $sk->teacher_id)
                ->where('id', '!=', $sk->id)
                ->whereIn('status', ['approved', 'Approved', 'active', 'Active'])
                ->latest('id')
                ->first();
        }

        if ($oldSk) {
            $oldSk->update([
                'status'         => 'archived',
                'archived_at'    => now(),
                'archived_by'    => $approver->id,
                'archive_reason' => "Dicabut dan digantikan oleh SK Perubahan Status No. {$sk->nomor_sk}",
            ]);

            // Pastikan relasi tersimpan pada sk baru jika awalnya belum terisi
            if (! $sk->sk_lama_id) {
                $sk->update([
                    'sk_lama_id'    => $oldSk->id,
                    'nomor_sk_lama' => $sk->nomor_sk_lama ?: $oldSk->nomor_sk,
                ]);
            }
        }

        // 2. Evaluasi dan Perbarui Master Guru
        if (! $sk->teacher_id || ! $sk->teacher) {
            return;
        }

        $teacher = $sk->teacher;

        // Hitung masa kerja dari TMT: >= 2 tahun -> GTY, < 2 tahun -> GTT
        $tmt = $teacher->tmt ? Carbon::parse($teacher->tmt) : null;
        $diffYears = $tmt ? $tmt->diffInYears(Carbon::now()) : 0;
        $statusBaru = ($diffYears >= 2) ? 'GTY' : 'GTT';

        // Update data master guru
        $teacher->update([
            'nama'                => $sk->nama,
            'pendidikan_terakhir' => 'S1',
            'status'              => $statusBaru,
            'is_sk_generated'     => true,
        ]);

        // 3. Catat riwayat mutasi / karir
        TeacherMutation::create([
            'teacher_id'     => $teacher->id,
            'school_id'      => $sk->school_id,
            'from_unit'      => 'Tenaga Kependidikan',
            'to_unit'        => $statusBaru,
            'reason'         => "Perubahan Status (Tendik ke {$statusBaru})",
            'sk_number'      => $sk->nomor_sk,
            'effective_date' => $sk->tanggal_penetapan ?? now(),
            'performed_by'   => $approver->id,
        ]);

        // 4. Catat ke ActivityLog
        ActivityLog::log(
            description: "Perubahan status guru {$teacher->nama} dari Tendik menjadi {$statusBaru} berdasarkan SK {$sk->nomor_sk}.",
            event: 'perubahan_status_tendik',
            logName: 'sk',
            subject: $teacher,
            causer: $approver,
            schoolId: $sk->school_id
        );
    }
}
