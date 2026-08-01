<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\Event;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AnugerahRegistrationController extends Controller
{
    use ApiResponse;

    // ── List registrations (admin: all; operator: own school) ─────────────────
    public function index(Request $request): JsonResponse
    {
        $user  = Auth::user();
        $query = AnugerahRegistration::with(['event', 'competition', 'school'])
            ->orderByDesc('created_at');

        if ($request->has('event_id')) {
            $query->where('event_id', $request->event_id);
        }
        if ($request->has('competition_id')) {
            $query->where('competition_id', $request->competition_id);
        }
        if ($request->has('category')) {
            $query->where('category', $request->category);
        }
        if ($request->has('jenjang')) {
            $query->where('jenjang', $request->jenjang);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Operators can only see their school's registrations
        if ($user?->role === 'operator' && $user->school_id) {
            $query->where('school_id', $user->school_id);
        }

        $registrations = $query->paginate($request->input('per_page', 20));
        return $this->success($registrations);
    }

    // ── Create / submit registration ──────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'event_id'                       => 'required|integer|exists:events,id',
            'competition_id'                 => 'required|integer|exists:competitions,id',
            'category'                       => 'required|string|in:guru,madrasah',
            'jenjang'                        => 'required|string|max:50',
            'applicant_name'                 => 'required|string|max:255',
            'applicant_nuptk'                => 'nullable|string|max:30',
            'school_id'                      => 'nullable|integer|exists:schools,id',
            'school_name'                    => 'required|string|max:255',
            'kecamatan'                      => 'nullable|string|max:100',
            'masa_bakti_tahun'               => 'nullable|integer|min:0',
            'mulai_bertugas'                 => 'nullable|date',
            'surat_keterangan_aktif_url'     => 'nullable|string|max:500',
            'sertifikat_pkpnu_url'           => 'nullable|string|max:500',
            'surat_rekomendasi_url'          => 'nullable|string|max:500',
            'surat_keterangan_integritas_url' => 'nullable|string|max:500',
            'bukti_prestasi_url'             => 'nullable|string|max:500',
            'esai_reflektif_url'             => 'nullable|string|max:500',
            'karya_ilmiah_url'               => 'nullable|string|max:500',
            'dokumen_pdca_url'               => 'nullable|string|max:500',
            'portofolio_branding_url'        => 'nullable|string|max:500',
            'rekap_prestasi_url'             => 'nullable|string|max:500',
            'dokumen_admin_url'              => 'nullable|string|max:500',
            'prestasi_list'                  => 'nullable|array',
            'prestasi_list.*.nama'           => 'required|string',
            'prestasi_list.*.tingkat'        => 'required|string|in:internasional,nasional,provinsi,kabupaten,kecamatan',
            'prestasi_list.*.juara'          => 'required|integer|min:1',
            'prestasi_list.*.tahun_ajaran'   => 'nullable|string',
            'prestasi_list.*.is_lp_maarif'   => 'nullable|boolean',
        ]);

        $registration = AnugerahRegistration::create($data);

        // Auto-calculate score if prestasi_list provided
        if (! empty($data['prestasi_list'])) {
            $registration->total_score = $registration->calculateScore();
            $registration->save();
        }

        return $this->success($registration, 'Pendaftaran berhasil dibuat', 201);
    }

    // ── Show single registration ───────────────────────────────────────────────
    public function show(AnugerahRegistration $anugerahRegistration): JsonResponse
    {
        $anugerahRegistration->load(['event', 'competition', 'school']);
        return $this->success($anugerahRegistration);
    }

    // ── Update registration ────────────────────────────────────────────────────
    public function update(Request $request, AnugerahRegistration $anugerahRegistration): JsonResponse
    {
        $data = $request->validate([
            'applicant_name'                 => 'nullable|string|max:255',
            'applicant_nuptk'                => 'nullable|string|max:30',
            'school_name'                    => 'nullable|string|max:255',
            'kecamatan'                      => 'nullable|string|max:100',
            'masa_bakti_tahun'               => 'nullable|integer|min:0',
            'mulai_bertugas'                 => 'nullable|date',
            'surat_keterangan_aktif_url'     => 'nullable|string|max:500',
            'sertifikat_pkpnu_url'           => 'nullable|string|max:500',
            'surat_rekomendasi_url'          => 'nullable|string|max:500',
            'surat_keterangan_integritas_url' => 'nullable|string|max:500',
            'bukti_prestasi_url'             => 'nullable|string|max:500',
            'esai_reflektif_url'             => 'nullable|string|max:500',
            'karya_ilmiah_url'               => 'nullable|string|max:500',
            'dokumen_pdca_url'               => 'nullable|string|max:500',
            'portofolio_branding_url'        => 'nullable|string|max:500',
            'rekap_prestasi_url'             => 'nullable|string|max:500',
            'dokumen_admin_url'              => 'nullable|string|max:500',
            'prestasi_list'                  => 'nullable|array',
        ]);

        $anugerahRegistration->update($data);

        // Recalculate score
        if (isset($data['prestasi_list'])) {
            $anugerahRegistration->total_score = $anugerahRegistration->calculateScore();
            $anugerahRegistration->save();
        }

        return $this->success($anugerahRegistration->load(['event', 'competition']));
    }

    // ── Submit (change status from draft → submitted) ─────────────────────────
    public function submit(AnugerahRegistration $anugerahRegistration): JsonResponse
    {
        if ($anugerahRegistration->status !== 'draft') {
            return $this->error('Pendaftaran ini sudah disubmit sebelumnya.', 422);
        }

        $anugerahRegistration->update([
            'status'       => 'submitted',
            'submitted_at' => now(),
        ]);

        return $this->success($anugerahRegistration, 'Pendaftaran berhasil disubmit');
    }

    // ── Review (admin: set to finalis / winner / rejected) ─────────────────────
    public function review(Request $request, AnugerahRegistration $anugerahRegistration): JsonResponse
    {
        $data = $request->validate([
            'status'           => 'required|string|in:under_review,finalis,winner,rejected',
            'reviewer_notes'   => 'nullable|string',
            'rejection_reason' => 'nullable|string|required_if:status,rejected',
            'rank'             => 'nullable|integer|min:1',
            'total_score'      => 'nullable|integer|min:0',
        ]);

        $data['reviewed_at'] = now();
        $anugerahRegistration->update($data);

        return $this->success($anugerahRegistration, 'Status berhasil diperbarui');
    }

    // ── Delete ─────────────────────────────────────────────────────────────────
    public function destroy(AnugerahRegistration $anugerahRegistration): JsonResponse
    {
        $anugerahRegistration->delete();
        return $this->success(null, 'Pendaftaran berhasil dihapus');
    }

    // ── Scoring preview ────────────────────────────────────────────────────────
    public function previewScore(Request $request): JsonResponse
    {
        $request->validate([
            'prestasi_list'                => 'required|array',
            'prestasi_list.*.tingkat'      => 'required|string',
            'prestasi_list.*.juara'        => 'required|integer|min:1',
            'prestasi_list.*.is_lp_maarif' => 'nullable|boolean',
        ]);

        $dummy = new AnugerahRegistration(['prestasi_list' => $request->prestasi_list]);
        $score = $dummy->calculateScore();

        return $this->success(['total_score' => $score]);
    }
}
