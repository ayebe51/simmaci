<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PpdbPeriod;
use App\Models\PpdbRegistration;
use App\Models\School;
use App\Services\PpdbService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PpdbManagementController extends Controller
{
    use ApiResponse;

    protected PpdbService $ppdbService;

    public function __construct(PpdbService $ppdbService)
    {
        $this->ppdbService = $ppdbService;
    }

    /**
     * PPDB Statistical Dashboard
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = PpdbRegistration::query();

        if (!in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            $query->where('school_id', $user->school_id);
        } elseif ($request->filled('school_id')) {
            $query->where('school_id', $request->school_id);
        }

        if ($request->filled('period_id')) {
            $query->where('period_id', $request->period_id);
        }

        $totalRegistrations = (clone $query)->count();
        $submittedCount     = (clone $query)->where('status', 'submitted')->count();
        $verifiedCount      = (clone $query)->where('status', 'verified')->count();
        $revisionCount      = (clone $query)->where('status', 'revision_needed')->count();
        $acceptedCount      = (clone $query)->where('status', 'accepted')->count();
        $reregisteredCount  = (clone $query)->where('status', 'reregistered')->count();
        $rejectedCount      = (clone $query)->where('status', 'rejected')->count();

        // Total Quota
        $periodQuery = PpdbPeriod::query();
        if (!in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            $periodQuery->where('school_id', $user->school_id);
        } elseif ($request->filled('school_id')) {
            $periodQuery->where('school_id', $request->school_id);
        }
        $totalQuota = $periodQuery->where('is_active', true)->sum('quota');

        return $this->successResponse([
            'total_registrations' => $totalRegistrations,
            'submitted'           => $submittedCount,
            'verified'            => $verifiedCount,
            'revision_needed'     => $revisionCount,
            'accepted'            => $acceptedCount,
            'reregistered'        => $reregisteredCount,
            'rejected'            => $rejectedCount,
            'total_quota'         => (int) $totalQuota,
        ]);
    }

    /**
     * List all registrations with rich filters
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = PpdbRegistration::with([
            'school:id,nama,npsn,jenjang,kecamatan',
            'period:id,wave_name,academic_year',
            'verifiedByUser:id,name',
            'student:id,nomor_induk_maarif,status,kelas'
        ]);

        if (!in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            $query->where('school_id', $user->school_id);
        } elseif ($request->filled('school_id')) {
            $query->where('school_id', $request->school_id);
        }

        if ($request->filled('period_id')) {
            $query->where('period_id', $request->period_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('track')) {
            $query->where('track', $request->track);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('nama_lengkap', 'ILIKE', "%{$search}%")
                  ->orWhere('registration_number', 'ILIKE', "%{$search}%")
                  ->orWhere('nisn', 'ILIKE', "%{$search}%")
                  ->orWhere('nik', 'ILIKE', "%{$search}%")
                  ->orWhere('asal_sekolah', 'ILIKE', "%{$search}%");
            });
        }

        $registrations = $query->orderBy('created_at', 'desc')->paginate($request->input('per_page', 15));

        return $this->paginatedResponse($registrations);
    }

    /**
     * Get single registration detail
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $registration = PpdbRegistration::withoutTenantScope()->with([
            'school',
            'period',
            'verifiedByUser:id,name,role',
            'student'
        ])->findOrFail($id);

        $user = $request->user();
        if ($user && !in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            if ($registration->school_id !== $user->school_id) {
                return $this->errorResponse('Anda tidak memiliki hak akses untuk melihat data calon siswa madrasah lain.', null, 403);
            }
        }

        return $this->successResponse($registration);
    }

    /**
     * Verify documents by operator
     */
    public function verify(Request $request, int $id): JsonResponse
    {
        $registration = PpdbRegistration::withoutTenantScope()->findOrFail($id);

        $user = $request->user();
        if (!in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            if ($registration->school_id !== $user->school_id) {
                return $this->errorResponse('Anda tidak memiliki hak akses untuk memproses calon siswa madrasah lain.', null, 403);
            }
        }

        $validator = Validator::make($request->all(), [
            'status'             => 'required|string|in:verified,revision_needed,rejected,submitted',
            'verification_notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors()->toArray());
        }

        try {
            $updated = $this->ppdbService->verifyRegistration(
                $registration,
                $request->status,
                $request->verification_notes,
                $request->user()
            );

            return $this->successResponse($updated, 'Status verifikasi berkas berhasil diperbarui.');
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage(), null, 422);
        }
    }

    /**
     * Record selection score and make decision (accepted / reserved / rejected)
     */
    public function score(Request $request, int $id): JsonResponse
    {
        $registration = PpdbRegistration::withoutTenantScope()->findOrFail($id);

        $user = $request->user();
        if (!in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            if ($registration->school_id !== $user->school_id) {
                return $this->errorResponse('Anda tidak memiliki hak akses untuk memproses calon siswa madrasah lain.', null, 403);
            }
        }

        $validator = Validator::make($request->all(), [
            'test_score'        => 'nullable|numeric|min:0|max:100',
            'interview_score'   => 'nullable|numeric|min:0|max:100',
            'achievement_score' => 'nullable|numeric|min:0|max:100',
            'decision'          => 'required|string|in:accepted,reserved,rejected',
            'selection_notes'   => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors()->toArray());
        }

        try {
            $updated = $this->ppdbService->recordSelectionScore(
                $registration,
                $request->only(['test_score', 'interview_score', 'achievement_score']),
                $request->decision,
                $request->selection_notes
            );

            return $this->successResponse($updated, 'Hasil seleksi dan nilai berhasil disimpan.');
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage(), null, 422);
        }
    }

    /**
     * Confirm Re-registration (Daftar Ulang) & AUTO-SYNC to Student Master Data
     */
    public function reregister(Request $request, int $id): JsonResponse
    {
        $registration = PpdbRegistration::withoutTenantScope()->findOrFail($id);

        $user = $request->user();
        if (!in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            if ($registration->school_id !== $user->school_id) {
                return $this->errorResponse('Anda tidak memiliki hak akses untuk memproses calon siswa madrasah lain.', null, 403);
            }
        }

        try {
            $student = $this->ppdbService->confirmReregistration($registration);

            return $this->successResponse([
                'registration' => $registration->fresh(['school', 'student']),
                'student'      => $student,
            ], 'Daftar ulang berhasil dikonfirmasi! Data siswa otomatis disinkronisasi ke Data Induk Siswa SIMMACI.');
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage(), null, 422);
        } catch (\Throwable $e) {
            return $this->errorResponse('Gagal melakukan sinkronisasi data siswa: ' . $e->getMessage(), null, 500);
        }
    }

    /**
     * Export PPDB data to Excel-compatible structure
     */
    public function export(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = PpdbRegistration::with(['school:id,nama,npsn,jenjang', 'period:id,wave_name,academic_year', 'student:id,nisn,nik,status,kelas']);

        if (!in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            $query->where('school_id', $user->school_id);
        } elseif ($request->filled('school_id')) {
            $query->where('school_id', $request->school_id);
        }

        if ($request->filled('period_id')) {
            $query->where('period_id', $request->period_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $records = $query->orderBy('created_at', 'desc')->get()->map(function ($reg) {
            return [
                'no_registrasi'       => $reg->registration_number,
                'sekolah'             => $reg->school?->nama,
                'jenjang'             => $reg->school?->jenjang,
                'gelombang'           => $reg->period?->wave_name,
                'tahun_ajaran'        => $reg->period?->academic_year,
                'jalur'               => strtoupper($reg->track),
                'nisn'                => $reg->nisn,
                'nik'                 => $reg->nik,
                'nama_lengkap'        => $reg->nama_lengkap,
                'jenis_kelamin'       => $reg->jenis_kelamin,
                'tempat_lahir'        => $reg->tempat_lahir,
                'tanggal_lahir'       => $reg->tanggal_lahir?->format('Y-m-d'),
                'asal_sekolah'        => $reg->asal_sekolah,
                'no_whatsapp'         => $reg->no_whatsapp,
                'alamat'              => $reg->alamat,
                'kecamatan'           => $reg->kecamatan,
                'kelurahan'           => $reg->kelurahan,
                'nama_ayah'           => $reg->nama_ayah,
                'nama_ibu'            => $reg->nama_ibu,
                'status'              => $reg->status,
                'nilai_akhir'         => $reg->final_score,
                'sudah_daftar_ulang'  => $reg->is_reregistered ? 'YA' : 'TIDAK',
                'status_siswa'        => $reg->student ? "Aktif (Kelas {$reg->student->kelas})" : '-',
                'tanggal_daftar'      => $reg->created_at->format('Y-m-d H:i'),
            ];
        });

        return $this->successResponse($records, 'Data ekspor PPDB berhasil digenerate.');
    }
}
