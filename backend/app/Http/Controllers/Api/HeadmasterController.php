<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HeadmasterTenure;
use App\Models\Notification;
use App\Models\School;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HeadmasterController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = HeadmasterTenure::with(['teacher', 'school'])
            ->whereNull('deleted_at'); // Explicit filter — safety net di atas SoftDeletes global scope

        if ($request->status) {
            $query->byStatus($request->status);
        }
        if ($request->user()->isOperator()) {
            $query->where('school_id', $request->user()->school_id);
        }

        return response()->json(
            $query->orderByDesc('created_at')->paginate($request->integer('per_page', 25))
        );
    }

    public function show(HeadmasterTenure $headmasterTenure): JsonResponse
    {
        return response()->json($headmasterTenure->load('teacher', 'school'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'teacher_id' => 'required|exists:teachers,id',
            'teacher_name' => 'required|string',
            'school_id' => 'required|exists:schools,id',
            'school_name' => 'required|string',
            'periode' => 'required|string',
            'start_date' => 'required|string',
            'end_date' => 'required|string',
            'nomor_sk' => 'nullable|string',
            'sk_url' => 'nullable|string',
            'surat_permohonan_url' => 'nullable|string',
            'surat_permohonan_number' => 'nullable|string',
            'surat_permohonan_date' => 'nullable|string',
            'nomor_surat_rekomendasi' => 'nullable|string',
            'tanggal_surat_rekomendasi' => 'nullable|string',
            'keterangan' => 'nullable|string',
            'golongan' => 'nullable|string|max:10',
        ]);

        // Pastikan surat_permohonan_url terisi dari surat_permohonan_url atau sk_url
        if (empty($data['surat_permohonan_url']) && !empty($data['sk_url'])) {
            $data['surat_permohonan_url'] = $data['sk_url'];
        }
        if (empty($data['sk_url']) && !empty($data['surat_permohonan_url'])) {
            $data['sk_url'] = $data['surat_permohonan_url'];
        }

        $user = $request->user();
        if ($user?->isOperator()) {
            $data['school_id'] = $user->school_id;
            $school = School::find($user->school_id);
            if ($school) {
                $data['school_name'] = $school->nama;
            }
        }

        $data['status'] = 'pending';
        $data['created_by'] = $user?->email;

        return response()->json(HeadmasterTenure::create($data), 201);
    }

    public function approve(Request $request, HeadmasterTenure $headmasterTenure): JsonResponse
    {
        if (! in_array($request->user()?->role, ['super_admin', 'admin_yayasan'], true)) {
            abort(403, 'Hanya Super Admin / Admin Yayasan yang berwenang menyetujui pengangkatan kepala madrasah.');
        }

        $tanggalPenetapan = $request->tanggal_penetapan ?: ($headmasterTenure->tanggal_penetapan ?: now()->toDateString());

        $headmasterTenure->update([
            'status' => 'active',
            'approved_by' => $request->user()->name,
            'approved_at' => now(),
            'nomor_sk' => $request->nomor_sk ?: $headmasterTenure->nomor_sk,
            'tanggal_penetapan' => $tanggalPenetapan,
            'sk_url' => $request->sk_url ?: $headmasterTenure->sk_url,
        ]);

        // 1. Nonaktifkan masa jabatan aktif sebelumnya pada sekolah ini (tandai completed)
        if ($headmasterTenure->school_id) {
            HeadmasterTenure::where('school_id', $headmasterTenure->school_id)
                ->where('id', '!=', $headmasterTenure->id)
                ->where('status', 'active')
                ->update(['status' => 'completed']);
        }

        // 2. Auto-sync profil kepala madrasah ke tabel schools
        $school = $headmasterTenure->school ?: School::find($headmasterTenure->school_id);
        $teacher = $headmasterTenure->teacher ?: \App\Models\Teacher::find($headmasterTenure->teacher_id);

        if ($school) {
            $startDate = $headmasterTenure->start_date ?: $tanggalPenetapan;
            $endDate = $headmasterTenure->end_date;

            if (!$endDate && $startDate) {
                try {
                    $endDate = \Carbon\Carbon::parse($startDate)->addYears(4)->toDateString();
                } catch (\Throwable) {
                    $endDate = null;
                }
            }

            $schoolUpdateData = [
                'kepala_madrasah' => $headmasterTenure->teacher_name ?: ($teacher?->nama ?? $school->kepala_madrasah),
            ];

            if ($teacher?->nomor_induk_maarif) {
                $schoolUpdateData['kepala_nim'] = $teacher->nomor_induk_maarif;
            }
            if ($teacher?->nuptk) {
                $schoolUpdateData['kepala_nuptk'] = $teacher->nuptk;
            }
            if ($teacher?->phone_number) {
                $schoolUpdateData['kepala_whatsapp'] = $teacher->phone_number;
            }
            if ($startDate) {
                $schoolUpdateData['kepala_jabatan_mulai'] = $startDate;
            }
            if ($endDate) {
                $schoolUpdateData['kepala_jabatan_selesai'] = $endDate;
            }

            $school->update($schoolUpdateData);
        }

        // 3. Catat Activity Log
        \App\Models\ActivityLog::log(
            description: "Menyetujui pengangkatan kepala madrasah: {$headmasterTenure->teacher_name} — " . ($school?->nama ?? $headmasterTenure->school_name) . " (Periode {$headmasterTenure->periode})",
            event: 'approve_headmaster_tenure',
            logName: 'headmaster',
            causer: $request->user(),
            schoolId: $headmasterTenure->school_id,
        );

        return response()->json($headmasterTenure->fresh()->load('teacher', 'school'));
    }

    public function reject(Request $request, HeadmasterTenure $headmasterTenure): JsonResponse
    {
        if (! in_array($request->user()?->role, ['super_admin', 'admin_yayasan'], true)) {
            abort(403, 'Hanya Super Admin / Admin Yayasan yang berwenang menolak pengangkatan kepala madrasah.');
        }

        $headmasterTenure->update([
            'status' => 'rejected',
            'keterangan' => $request->rejection_reason,
        ]);

        return response()->json($headmasterTenure->fresh());
    }

    public function update(Request $request, HeadmasterTenure $headmasterTenure): JsonResponse
    {
        if (! in_array($request->user()?->role, ['super_admin', 'admin_yayasan'], true)) {
            abort(403, 'Hanya Super Admin / Admin Yayasan yang berwenang memperbarui data penetapan kepala madrasah.');
        }

        $data = $request->validate([
            'status'               => 'sometimes|string',
            'nomor_sk'             => 'sometimes|nullable|string',
            'tanggal_penetapan'    => 'sometimes|nullable|date',
            'sk_url'               => 'sometimes|nullable|string',
            'surat_permohonan_url' => 'sometimes|nullable|string',
            'keterangan'           => 'sometimes|nullable|string',
        ]);

        $headmasterTenure->update($data);

        return response()->json($headmasterTenure->fresh());
    }

    public function destroy(Request $request, HeadmasterTenure $headmasterTenure): JsonResponse
    {
        // Hanya super_admin yang boleh hapus
        if ($request->user()->role !== 'super_admin') {
            return response()->json(['message' => 'Hanya super admin yang dapat menghapus pengajuan kepala madrasah.'], 403);
        }

        $info = "Pengajuan Kepala: {$headmasterTenure->teacher_name} — {$headmasterTenure->school_name} (Periode {$headmasterTenure->periode})";

        \App\Models\ActivityLog::log(
            description: "Hapus pengajuan SK Kepala: {$info}",
            event: 'delete_headmaster_tenure',
            logName: 'headmaster',
            causer: $request->user(),
            schoolId: $headmasterTenure->school_id,
        );

        $headmasterTenure->forceDelete(); // Hard delete — tidak perlu restore untuk pengajuan kamad

        return response()->json(['message' => 'Pengajuan kepala madrasah berhasil dihapus.']);
    }

    public function expiring(Request $request): JsonResponse
    {
        $limit = strtotime('+180 days'); // 6 bulan sebelum berakhir
        $user = $request->user();
        $now = time();

        // 1. Data from formal tenures (SK yang sudah disetujui)
        $tenureQuery = HeadmasterTenure::where('status', 'active')->with(['teacher', 'school']);
        if ($user->isOperator()) {
            $tenureQuery->where('school_id', $user->school_id);
        }

        $tenures = $tenureQuery->get()->filter(function ($t) use ($limit) {
            $endStr = $t->end_date;
            if (!$endStr && $t->tanggal_penetapan) {
                $endStr = date('Y-m-d', strtotime($t->tanggal_penetapan . ' +4 years'));
            }
            $end = strtotime($endStr);
            return $end && $end <= $limit;
        })->map(function ($t) use ($now) {
            $endDate = $t->end_date;
            if (!$endDate && $t->tanggal_penetapan) {
                $endDate = date('Y-m-d', strtotime($t->tanggal_penetapan . ' +4 years'));
            }
            $endTs = strtotime($endDate ?: 'now');
            $daysRemaining = (int) ceil(($endTs - $now) / 86400);

            $calculatedStatus = 'expiring';
            if ($daysRemaining < 0) {
                $calculatedStatus = 'expired';
            }

            return [
                'id' => $t->id,
                'nama' => $t->teacher ? $t->teacher->nama : ($t->teacher_name ?? 'Tanpa Nama'),
                'teacher_name' => $t->teacher ? $t->teacher->nama : ($t->teacher_name ?? 'Tanpa Nama'),
                'unit_kerja' => $t->school ? $t->school->nama : ($t->school_name ?? 'Tanpa Unit Kerja'),
                'school_name' => $t->school ? $t->school->nama : ($t->school_name ?? 'Tanpa Unit Kerja'),
                'period_number' => $t->period_number ?? 1,
                'start_date' => $t->start_date,
                'end_date' => $endDate,
                'end_date_effective' => $endDate,
                'days_remaining' => $daysRemaining,
                'status' => ($t->period_number && $t->period_number >= 3) ? 'limit_exceeded' : $calculatedStatus,
                'source' => 'tenure',
            ];
        });

        // 2. Data from School Profiles (legacy)
        $schoolQuery = School::whereNotNull('kepala_jabatan_selesai');
        if ($user->isOperator()) {
            $schoolQuery->where('id', $user->school_id);
        }

        $schoolStats = $schoolQuery->get()->filter(function ($s) use ($limit) {
            $end = strtotime($s->kepala_jabatan_selesai);
            return $end && $end <= $limit;
        })->map(function ($s) use ($now) {
            $endTs = strtotime($s->kepala_jabatan_selesai);
            $daysRemaining = (int) ceil(($endTs - $now) / 86400);
            $calculatedStatus = $daysRemaining < 0 ? 'expired' : 'expiring';

            return [
                'id' => 'legacy-' . $s->id,
                'nama' => $s->kepala_madrasah ?: 'Profil Lembaga',
                'teacher_name' => $s->kepala_madrasah ?: 'Profil Lembaga',
                'unit_kerja' => $s->nama,
                'school_name' => $s->nama,
                'period_number' => 1,
                'periode' => 'Masa Jabatan Aktif',
                'start_date' => $s->kepala_jabatan_mulai,
                'end_date' => $s->kepala_jabatan_selesai,
                'end_date_effective' => $s->kepala_jabatan_selesai,
                'days_remaining' => $daysRemaining,
                'status' => $calculatedStatus,
                'source' => 'profile',
            ];
        });

        $getEnd = fn($t) => is_array($t) ? strtotime($t['end_date'] ?? '') : 0;

        $combined = collect($tenures)->concat($schoolStats)
            ->sortBy($getEnd)
            ->values();

        return response()->json($combined);
    }
}
