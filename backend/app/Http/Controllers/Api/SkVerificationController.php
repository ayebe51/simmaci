<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SkDocument;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class SkVerificationController extends Controller
{
    use ApiResponse;

    /**
     * Verify an SK document by its nomor_sk.
     *
     * Public endpoint — no authentication required.
     * Only returns SK with status 'approved' or 'active'.
     * Computes tanggal_kadaluarsa = tanggal_penetapan + 1 year at runtime.
     * Returns 200 with is_expired: true for expired SK (not 404).
     * Returns 404 only when SK is not found or status is not approved/active.
     */
    public function verifyBySk(string $nomor): JsonResponse
    {
        // Bypass tenant scope — this is a public endpoint
        $sk = SkDocument::withoutTenantScope()
            ->with('school:id,nama')
            ->whereRaw('LOWER(nomor_sk) = LOWER(?)', [$nomor])
            ->whereIn('status', ['approved', 'Approved', 'active', 'Active'])
            ->first();

        if (! $sk) {
            return $this->errorResponse(
                'Dokumen SK tidak ditemukan atau tidak aktif.',
                null,
                404
            );
        }

        // Compute expiry at runtime — no DB column needed
        $tanggalPenetapan = Carbon::parse($sk->tanggal_penetapan);
        $tanggalKadaluarsa = $tanggalPenetapan->copy()->addYear();
        $isExpired = now()->gt($tanggalKadaluarsa);

        $data = [
            'nomor_sk'           => $sk->nomor_sk,
            'nama'               => $sk->nama,
            'jabatan'            => $sk->jabatan,
            'unit_kerja'         => $sk->unit_kerja,
            'tanggal_penetapan'  => $tanggalPenetapan->translatedFormat('j F Y'),
            'tanggal_kadaluarsa' => $tanggalKadaluarsa->translatedFormat('j F Y'),
            'jenis_sk'           => $sk->jenis_sk,
            'status'             => strtolower($sk->status),
            'is_expired'         => $isExpired,
            'school'             => $sk->school ? ['nama' => $sk->school->nama] : null,
        ];

        return $this->successResponse($data, 'Dokumen SK ditemukan.');
    }
}
