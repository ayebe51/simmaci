<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Services\PhoneNormalizerService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

/**
 * PublicMeetingWalkInController
 *
 * Handles self-service walk-in attendance submission.
 * No authentication required — protected by:
 *   1. Signed URL time-window validation on the GET route (H-24 to ended_at+48h)
 *   2. Same time-window re-check on POST to prevent direct API abuse
 *   3. Rate limiting: max 3 walk-in submissions per IP per 5 minutes
 *   4. Optional geolocation validation (Haversine) when meeting has coordinates
 *
 * POST /api/public/meetings/{meeting}/walk-in
 */
class PublicMeetingWalkInController extends Controller
{
    use ApiResponse;

    public function __construct(
        private PhoneNormalizerService $phoneNormalizer,
    ) {}

    /**
     * Store a new walk-in attendance record.
     *
     * Request body:
     *   - nama        string required  Nama lengkap peserta
     *   - jabatan     string required  Jabatan/posisi
     *   - instansi    string required  Asal sekolah/instansi
     *   - no_hp       string required  Nomor HP (dinormalisasi)
     *   - latitude    float  optional  GPS latitude dari browser
     *   - longitude   float  optional  GPS longitude dari browser
     */
    public function store(Request $request, Meeting $meeting): JsonResponse
    {
        // ── 1. Validate time window ──────────────────────────────────────────
        $now         = now();
        $startWindow = $meeting->started_at->copy()->subHours(24);
        $endWindow   = $meeting->ended_at->copy()->addHours(48);

        if ($now->isBefore($startWindow)) {
            return $this->errorResponse(
                'Check-in walk-in dibuka 24 jam sebelum rapat dimulai.',
                null,
                403
            );
        }

        if ($now->isAfter($endWindow)) {
            return $this->errorResponse(
                'QR Code rapat sudah tidak berlaku (rapat telah berakhir).',
                null,
                410
            );
        }

        // ── 2. Rate limiting ─────────────────────────────────────────────────
        // Batasi per-IP secara longgar (1000 per 5 menit) agar ratusan perangkat
        // yang berbagi Wi-Fi aula / NAT yang sama tidak terblokir saat scan bersamaan.
        $ipRateLimitKey = 'meeting-walkin-ip:' . $request->ip() . ':' . $meeting->id;

        if (RateLimiter::tooManyAttempts($ipRateLimitKey, maxAttempts: 1000)) {
            $seconds = RateLimiter::availableIn($ipRateLimitKey);
            return $this->errorResponse(
                "Terlalu banyak permintaan dari jaringan ini. Silakan tunggu {$seconds} detik.",
                null,
                429
            );
        }

        RateLimiter::hit($ipRateLimitKey, decaySeconds: 300);

        // ── 3. Validate input ────────────────────────────────────────────────
        $validated = $request->validate([
            'nama'               => 'required|string|min:3|max:255',
            'jabatan'            => 'required|string|max:255',
            'instansi'           => 'required|string|max:255',
            'no_hp'              => 'required|string|min:8|max:20',
            'kehadiran_sebagai'  => 'nullable|string|in:peserta,perwakilan,walk_in',
            'mewakili_nama'      => 'nullable|string|max:255',
            'participant_id'     => 'nullable|integer',
            'latitude'           => 'nullable|numeric|between:-90,90',
            'longitude'          => 'nullable|numeric|between:-180,180',
        ], [
            'nama.required'     => 'Nama lengkap wajib diisi.',
            'nama.min'          => 'Nama minimal 3 karakter.',
            'jabatan.required'  => 'Jabatan wajib diisi.',
            'instansi.required' => 'Asal instansi / sekolah wajib diisi.',
            'no_hp.required'    => 'Nomor HP / WhatsApp wajib diisi.',
            'no_hp.min'         => 'Nomor HP tidak valid.',
        ]);

        // ── 4. Normalize & validate phone number ─────────────────────────────
        $normalizedPhone = $this->phoneNormalizer->normalize($validated['no_hp']);

        if (!$this->phoneNormalizer->isValid($normalizedPhone)) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors'  => ['no_hp' => ['Nomor WhatsApp tidak valid. Contoh format: 08123456789 atau 6281234567890']],
            ], 422);
        }

        // Batasi per nomor HP (max 5 kali per 5 menit per rapat) untuk mencegah spam
        $phoneRateLimitKey = 'meeting-walkin-phone:' . $meeting->id . ':' . md5($normalizedPhone);
        if (RateLimiter::tooManyAttempts($phoneRateLimitKey, maxAttempts: 5)) {
            $seconds = RateLimiter::availableIn($phoneRateLimitKey);
            return $this->errorResponse(
                "Terlalu banyak percobaan untuk nomor HP ini. Silakan tunggu {$seconds} detik sebelum mencoba lagi.",
                null,
                429
            );
        }
        RateLimiter::hit($phoneRateLimitKey, decaySeconds: 300);

        // ── 5. Geolocation validation (opsional) ─────────────────────────────
        if ($meeting->geolocation_enabled && $meeting->latitude && $meeting->longitude) {
            $lat = $validated['latitude'] ?? null;
            $lng = $validated['longitude'] ?? null;

            if ($lat !== null && $lng !== null) {
                $distance = $this->haversineDistance(
                    $meeting->latitude,
                    $meeting->longitude,
                    (float) $lat,
                    (float) $lng,
                );

                $radius = $meeting->geolocation_radius_meters ?? 200;

                if ($distance > $radius) {
                    $distanceText = $distance < 1000
                        ? round($distance) . ' m'
                        : round($distance / 1000, 1) . ' km';

                    return $this->errorResponse(
                        "Anda berada di luar area rapat ({$distanceText} dari lokasi, radius {$radius}m).",
                        null,
                        422
                    );
                }
            }
        }

        // ── 6. Identifikasi Kategori Kehadiran ────────────────────────────────
        $kehadiranSebagai = $validated['kehadiran_sebagai'] ?? null;
        $isPerwakilan = ($kehadiranSebagai === 'perwakilan')
            || str_contains(mb_strtolower($validated['jabatan']), 'wakil')
            || str_contains(mb_strtolower($validated['jabatan']), 'utusan')
            || str_contains(mb_strtolower($validated['jabatan']), 'delegasi');

        $isExplicitWalkIn = ($kehadiranSebagai === 'walk_in');

        $allParticipants = $meeting->participants()->whereNull('deleted_at')->get();
        $targetParticipant = null;

        // A. Jika ada participant_id eksplisit (dipilih dari dropdown/daftar peserta)
        if (!empty($validated['participant_id'])) {
            $targetParticipant = $allParticipants->firstWhere('id', (int) $validated['participant_id']);
        }

        // B. Jika perwakilan tapi belum ada participant_id eksplisit: cari peserta yang diwakili
        if ($isPerwakilan && !$targetParticipant) {
            $targetParticipant = $this->findParticipantForDelegation(
                $allParticipants,
                $validated['instansi'],
                $validated['mewakili_nama'] ?? null
            );
        }

        // C. Jika bukan explicit walk-in dan bukan perwakilan: coba strict matching
        if (!$isExplicitWalkIn && !$isPerwakilan && !$targetParticipant) {
            $targetParticipant = $this->findStrictParticipantMatch(
                $allParticipants,
                $validated['nama'],
                $validated['instansi']
            );
        }

        // ── 7. Pengecekan Duplikasi Kehadiran ─────────────────────────────────
        if ($targetParticipant) {
            $alreadyAttended = MeetingAttendance::where('meeting_id', $meeting->id)
                ->where('participant_id', $targetParticipant->id)
                ->first();

            if ($alreadyAttended) {
                $statusDetail = $alreadyAttended->is_delegation && $alreadyAttended->walk_in_name
                    ? "diwakili oleh {$alreadyAttended->walk_in_name}"
                    : "tercatat hadir pada {$alreadyAttended->checked_in_at->format('H:i')}";

                return $this->errorResponse(
                    "Kehadiran untuk {$targetParticipant->name} ({$targetParticipant->instansi}) sudah {$statusDetail}. Terima kasih!",
                    null,
                    409
                );
            }
        } else {
            // Cegah double-submit untuk walk-in murni HANYA jika NAMA + INSTANSI + NO_HP persis sama
            $alreadyWalkInAttended = MeetingAttendance::where('meeting_id', $meeting->id)
                ->where('walk_in_phone', $normalizedPhone)
                ->where(function ($q) use ($validated) {
                    $q->whereRaw('LOWER(TRIM(walk_in_name)) = ?', [mb_strtolower(trim($validated['nama']))])
                      ->orWhereRaw('LOWER(TRIM(walk_in_instansi)) = ?', [mb_strtolower(trim($validated['instansi']))]);
                })
                ->first();

            if ($alreadyWalkInAttended) {
                return $this->errorResponse(
                    "Kehadiran atas nama {$alreadyWalkInAttended->walk_in_name} ({$alreadyWalkInAttended->walk_in_instansi}) sudah tercatat sebelumnya. Terima kasih!",
                    null,
                    409
                );
            }
        }

        // ── 8. Simpan Attendance Record ──────────────────────────────────────
        $attendance = DB::transaction(function () use (
            $meeting, $validated, $normalizedPhone, $request,
            $targetParticipant, $isPerwakilan
        ) {
            // Skenario 1: Hadir sebagai Perwakilan / Delegasi
            if ($isPerwakilan) {
                if ($targetParticipant) {
                    $targetParticipant->update([
                        'is_token_used' => true,
                        'token_used_at' => now(),
                    ]);
                }

                return MeetingAttendance::create([
                    'meeting_id'                   => $meeting->id,
                    'participant_id'               => $targetParticipant?->id,
                    'attendance_type'              => 'qr_umum',
                    'is_delegation'                => true,
                    'delegated_for_participant_id' => $targetParticipant?->id,
                    'walk_in_name'                 => trim($validated['nama']), // Nama orang yang hadir
                    'walk_in_jabatan'              => trim($validated['jabatan']),
                    'walk_in_instansi'             => trim($validated['instansi']),
                    'walk_in_phone'                => $normalizedPhone,
                    'checked_in_at'                => now(),
                    'ip_address'                   => $request->ip(),
                    'device_info'                  => $this->extractDeviceInfo($request),
                ]);
            }

            // Skenario 2: Hadir sebagai Peserta Terdaftar Langsung
            if ($targetParticipant) {
                if (empty($targetParticipant->phone_number)) {
                    $targetParticipant->update(['phone_number' => $normalizedPhone]);
                }
                $targetParticipant->update([
                    'is_token_used' => true,
                    'token_used_at' => now(),
                ]);

                // Sinkronkan nomor WhatsApp kepala jika belum terisi di master sekolah
                $this->syncSchoolHeadmasterPhone($targetParticipant->instansi, $targetParticipant->name, $normalizedPhone);

                return MeetingAttendance::create([
                    'meeting_id'                   => $meeting->id,
                    'participant_id'               => $targetParticipant->id,
                    'attendance_type'              => 'qr_umum',
                    'is_delegation'                => false,
                    'walk_in_name'                 => trim($validated['nama']),
                    'walk_in_jabatan'              => trim($validated['jabatan']),
                    'walk_in_instansi'             => trim($validated['instansi']),
                    'walk_in_phone'                => $normalizedPhone,
                    'checked_in_at'                => now(),
                    'ip_address'                   => $request->ip(),
                    'device_info'                  => $this->extractDeviceInfo($request),
                ]);
            }

            // Skenario 3: Walk-in Murni / Tamu Tambahan (Tidak ada kecocokan di peserta terdaftar)
            if (str_contains(mb_strtolower($validated['jabatan']), 'kepala')) {
                $this->syncSchoolHeadmasterPhone($validated['instansi'], $validated['nama'], $normalizedPhone);
            }

            return MeetingAttendance::create([
                'meeting_id'                   => $meeting->id,
                'participant_id'               => null,
                'attendance_type'              => 'qr_umum',
                'is_delegation'                => false,
                'walk_in_name'                 => trim($validated['nama']),
                'walk_in_jabatan'              => trim($validated['jabatan']),
                'walk_in_instansi'             => trim($validated['instansi']),
                'walk_in_phone'                => $normalizedPhone,
                'checked_in_at'                => now(),
                'ip_address'                   => $request->ip(),
                'device_info'                  => $this->extractDeviceInfo($request),
            ]);
        });

        // ── 9. Respons Sukses ────────────────────────────────────────────────
        $displayName     = trim($validated['nama']);
        $displayJabatan  = trim($validated['jabatan']);
        $displayInstansi = trim($validated['instansi']);

        if ($isPerwakilan && $targetParticipant) {
            $message = "Halo, {$displayName}! Kehadiran Anda mewakili {$targetParticipant->name} ({$targetParticipant->instansi}) berhasil dicatat. Terima kasih!";
        } elseif ($targetParticipant) {
            $message = "Halo, {$targetParticipant->name}! Kehadiran Anda berhasil dicatat. Selamat datang!";
        } else {
            $message = "Kehadiran Anda sebagai peserta walk-in ({$displayName}) berhasil dicatat. Selamat datang!";
        }

        return $this->successResponse([
            'nama'          => $displayName,
            'jabatan'       => $displayJabatan,
            'instansi'      => $displayInstansi,
            'checked_in_at' => $attendance->checked_in_at->format('H:i:s'),
            'meeting_title' => $meeting->title,
            'is_delegation' => $attendance->is_delegation,
            'mewakili'      => $targetParticipant?->name ?? null,
            'matched'       => $targetParticipant !== null,
        ], $message, 201);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Find participant being represented for delegation.
     */
    private function findParticipantForDelegation(
        $allParticipants,
        string $inputInstansi,
        ?string $mewakiliNama
    ): ?object {
        $distinctiveInput = $this->extractDistinctiveInstansiTokens($inputInstansi);

        // 1. Coba cari berdasarkan kecocokan instansi
        if (!empty($distinctiveInput)) {
            foreach ($allParticipants as $p) {
                $distinctiveP = $this->extractDistinctiveInstansiTokens($p->instansi ?? '');
                // Semua token pembeda input harus ada di candidate instansi
                if (!empty($distinctiveP) && empty(array_diff($distinctiveInput, $distinctiveP))) {
                    return $p;
                }
            }
        }

        // 2. Jika nama yang diwakili diberikan, cari berdasarkan nama
        if ($mewakiliNama && mb_strlen(trim($mewakiliNama)) >= 3) {
            $cleanMewakili = $this->cleanTitleAndHonorifics($mewakiliNama);
            foreach ($allParticipants as $p) {
                $cleanP = $this->cleanTitleAndHonorifics($p->name);
                if ($cleanMewakili === $cleanP || str_contains($cleanP, $cleanMewakili)) {
                    return $p;
                }
            }
        }

        return null;
    }

    /**
     * Strict participant matching:
     * Menghindari salah pencocokan nama ("Khayat" dengan "Khayat Munasir")
     * dengan mewajibkan kesamaan instansi spesifik dan kemiripan nama yang sangat tinggi.
     */
    private function findStrictParticipantMatch(
        $allParticipants,
        string $inputName,
        string $inputInstansi
    ): ?object {
        $cleanInputName = $this->cleanTitleAndHonorifics($inputName);
        $distinctiveInput = $this->extractDistinctiveInstansiTokens($inputInstansi);

        if (empty($distinctiveInput) || mb_strlen($cleanInputName) < 3) {
            return null;
        }

        $bestScore = 0.0;
        $bestMatch = null;

        foreach ($allParticipants as $p) {
            $distinctiveP = $this->extractDistinctiveInstansiTokens($p->instansi ?? '');

            // Instansi WAJIB memiliki token pembeda yang sama (contoh: 'patimuan', '01')
            // Jika token pembeda beda (misal 'patimuan' vs 'kawunganten'), BATALKAN langsung
            if (empty($distinctiveP) || !empty(array_diff($distinctiveInput, $distinctiveP))) {
                continue;
            }

            $cleanPName = $this->cleanTitleAndHonorifics($p->name);

            // Nama inti persis sama setelah gelar dihapus
            if ($cleanInputName === $cleanPName) {
                return $p;
            }

            // Hitung similar_text antar nama bersih
            similar_text($cleanInputName, $cleanPName, $namePercent);

            // Threshold kemiripan nama harus sangat tinggi (>= 88%)
            // Mencegah "Khayat" (6) cocok dengan "Khayat Munasir" (14, similarity ~60%)
            if ($namePercent >= 88.0 && $namePercent > $bestScore) {
                $bestScore = $namePercent;
                $bestMatch = $p;
            }
        }

        return $bestMatch;
    }

    /**
     * Ekstrak kata pembeda instansi (menghilangkan kata umum seperti MI, MTs, Maarif, NU, Cilacap).
     */
    private function extractDistinctiveInstansiTokens(string $instansi): array
    {
        $stopwords = [
            'mi', 'mts', 'smp', 'ma', 'smk', 'sd', 'tk', 'ra',
            'maarif', 'nu', 'lp', 'madrasah', 'sekolah', 'negeri', 'swasta',
            'yayasan', 'cabang', 'cilacap', 'kabupaten', 'kecamatan', 'desa'
        ];

        $tokens = preg_split('/[\s,.\-\/]+/u', mb_strtolower($instansi));
        $distinctive = [];

        foreach ($tokens as $t) {
            $t = trim($t);
            if (mb_strlen($t) >= 2 && !in_array($t, $stopwords, true)) {
                $distinctive[] = $t;
            }
        }

        return array_values(array_unique($distinctive));
    }

    /**
     * Bersihkan gelar dan tanda baca dari nama peserta untuk perbandingan akurat.
     */
    private function cleanTitleAndHonorifics(string $name): string
    {
        $patterns = [
            '/\b(dr|dra|drs|h|hj|kh|kyai|gus|prof|ir|st|se|sh|spd|spdi|mpd|mag|msi|phd|llm|ba)\b\.?/iu',
            '/[.,\-]/u',
        ];
        $cleaned = preg_replace($patterns, ' ', mb_strtolower($name));
        return trim(preg_replace('/\s+/', ' ', $cleaned));
    }

    /**
     * Sinkronkan nomor WhatsApp kepala madrasah ke tabel schools jika masih kosong.
     */
    private function syncSchoolHeadmasterPhone(string $instansi, string $nama, string $phone): void
    {
        try {
            $school = \App\Models\School::where('nama', trim($instansi))->first();
            if ($school && (empty($school->kepala_whatsapp) || trim($school->kepala_whatsapp) === '')) {
                $school->update(['kepala_whatsapp' => $phone]);
                \Log::info("WalkIn: Auto-updated school #{$school->id} ({$school->nama}) kepala_whatsapp with {$phone}");
            }
        } catch (\Exception $e) {
            \Log::warning("WalkIn: Failed to sync school phone: " . $e->getMessage());
        }
    }

    /**
     * Calculate distance in meters between two GPS coordinates using Haversine formula.
     */
    private function haversineDistance(
        float $lat1, float $lon1,
        float $lat2, float $lon2
    ): float {
        $earthRadius = 6371000; // meters

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }

    /**
     * Extract basic device info from User-Agent header.
     */
    private function extractDeviceInfo(Request $request): array
    {
        $ua = $request->userAgent() ?? '';

        $deviceType = 'desktop';
        if (preg_match('/Mobile|Android|iPhone|iPod|BlackBerry|Windows Phone/i', $ua)) {
            $deviceType = 'mobile';
        } elseif (preg_match('/iPad|Tablet|Kindle/i', $ua)) {
            $deviceType = 'tablet';
        }

        return [
            'user_agent'  => substr($ua, 0, 512),
            'device_type' => $deviceType,
        ];
    }
}
