<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Teacher;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

class TeacherVerificationController extends Controller
{
    use ApiResponse;

    /**
     * Verify a Teacher by NIM (nomor_induk_maarif).
     *
     * Public endpoint — no authentication required.
     */
    public function verifyByNim(string $nim): JsonResponse
    {
        // Bypass tenant scope since it's a public verification endpoint
        $teacher = Teacher::withoutTenantScope()
            ->with('school:id,nama')
            ->where('nomor_induk_maarif', $nim)
            ->where('is_active', true)
            ->first();

        if (! $teacher) {
            return $this->errorResponse(
                'Data guru/tenaga kependidikan tidak ditemukan atau tidak aktif.',
                null,
                404
            );
        }

        $data = [
            'id'             => $teacher->id,
            'nama'           => $teacher->nama,
            'nuptk'          => $teacher->nuptk,
            'nim_maarif'     => $teacher->nomor_induk_maarif,
            'unit_kerja'     => $teacher->unit_kerja,
            'status_pegawai' => $teacher->status,
            'school'         => $teacher->school ? ['nama' => $teacher->school->nama] : null,
        ];

        return $this->successResponse($data, 'Data guru terverifikasi.');
    }
}
