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

class PublicPpdbController extends Controller
{
    use ApiResponse;

    protected PpdbService $ppdbService;

    public function __construct(PpdbService $ppdbService)
    {
        $this->ppdbService = $ppdbService;
    }

    /**
     * Get list of schools with PPDB information
     */
    public function getSchools(Request $request): JsonResponse
    {
        $query = School::query();

        if ($request->filled('jenjang')) {
            $query->where('jenjang', $request->jenjang);
        }

        if ($request->filled('kecamatan')) {
            $query->where('kecamatan', $request->kecamatan);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('nama', 'ILIKE', "%{$search}%")
                  ->orWhere('npsn', 'ILIKE', "%{$search}%")
                  ->orWhere('kecamatan', 'ILIKE', "%{$search}%");
            });
        }

        $schools = $query->with(['ppdbPeriods' => function ($q) {
            $q->where('is_active', true)
              ->where('start_date', '<=', now()->toDateString())
              ->where('end_date', '>=', now()->toDateString());
        }])
        ->orderBy('kecamatan')
        ->orderBy('nama')
        ->paginate($request->input('per_page', 20));

        return $this->paginatedResponse($schools);
    }

    /**
     * Get details of a single school & its active PPDB periods
     */
    public function getSchoolDetail(int $id): JsonResponse
    {
        $school = School::with(['ppdbPeriods' => function ($q) {
            $q->where('is_active', true);
        }])->findOrFail($id);

        return $this->successResponse($school);
    }

    /**
     * Public Student Online Registration
     */
    public function register(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'school_id'     => 'required|exists:schools,id',
            'period_id'     => 'required|exists:ppdb_periods,id',
            'track'         => 'required|string|in:reguler,prestasi,afirmasi,tahfidz',
            'nisn'          => 'nullable|string|max:20',
            'nik'           => 'required|string|max:20',
            'nama_lengkap'  => 'required|string|max:255',
            'jenis_kelamin' => 'required|string|in:L,P,Laki-laki,Perempuan',
            'tempat_lahir'  => 'required|string|max:100',
            'tanggal_lahir' => 'required|date',
            'asal_sekolah'  => 'required|string|max:255',
            'no_whatsapp'   => 'required|string|max:30',
            'email'         => 'nullable|email|max:100',
            'alamat'        => 'required|string',
            'provinsi'      => 'nullable|string|max:100',
            'kabupaten'     => 'nullable|string|max:100',
            'kecamatan'     => 'required|string|max:100',
            'kelurahan'     => 'required|string|max:100',
            'nama_ayah'     => 'nullable|string|max:255',
            'nama_ibu'      => 'nullable|string|max:255',
            'nama_wali'     => 'nullable|string|max:255',
            'foto'          => 'nullable|file|mimes:jpeg,jpg,png|max:3072',
            'kk'            => 'nullable|file|mimes:jpeg,jpg,png,pdf|max:5120',
            'akta'          => 'nullable|file|mimes:jpeg,jpg,png,pdf|max:5120',
            'ijazah'        => 'nullable|file|mimes:jpeg,jpg,png,pdf|max:5120',
            'prestasi'      => 'nullable|file|mimes:jpeg,jpg,png,pdf|max:5120',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors()->toArray());
        }

        try {
            $files = $request->only(['foto', 'kk', 'akta', 'ijazah', 'prestasi']);
            $registration = $this->ppdbService->createRegistration($validator->validated(), $files);

            return $this->successResponse([
                'registration_number' => $registration->registration_number,
                'nama_lengkap'        => $registration->nama_lengkap,
                'school_name'         => $registration->school->nama,
                'track'               => $registration->track,
                'status'              => $registration->status,
                'created_at'          => $registration->created_at->toIso8601String(),
            ], 'Pendaftaran berhasil dikirim! Simpan Nomor Registrasi Anda.', 201);
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage(), null, 422);
        } catch (\Throwable $e) {
            return $this->errorResponse('Terjadi kesalahan saat memproses pendaftaran: ' . $e->getMessage(), null, 500);
        }
    }

    /**
     * Check Registration Status
     */
    public function checkStatus(Request $request): JsonResponse
    {
        $query = $request->input('q') ?? $request->input('reg');
        if (empty($query)) {
            return $this->errorResponse('Masukkan Nomor Registrasi, NISN, atau NIK untuk melacak status.', null, 400);
        }

        $registration = PpdbRegistration::withoutTenantScope()
            ->with(['school:id,nama,npsn,jenjang,kecamatan,telepon,alamat', 'period:id,wave_name,academic_year,announcement_date'])
            ->where(function ($q) use ($query) {
                $q->where('registration_number', $query)
                  ->orWhere('nisn', $query)
                  ->orWhere('nik', $query);
            })
            ->latest()
            ->first();

        if (!$registration) {
            return $this->errorResponse('Data pendaftaran tidak ditemukan. Pastikan nomor yang dimasukkan sudah benar.', null, 404);
        }

        return $this->successResponse([
            'registration_number' => $registration->registration_number,
            'nama_lengkap'        => $registration->nama_lengkap,
            'nisn'                => $registration->nisn,
            'asal_sekolah'        => $registration->asal_sekolah,
            'school'              => $registration->school,
            'period'              => $registration->period,
            'track'               => $registration->track,
            'status'              => $registration->status,
            'verification_notes'  => $registration->verification_notes,
            'final_score'         => $registration->final_score,
            'is_reregistered'     => $registration->is_reregistered,
            'submitted_at'        => $registration->created_at->format('d M Y H:i'),
        ]);
    }
}
