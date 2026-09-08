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

        // ── 2. Rate limiting — max 3 per IP per 5 menit ──────────────────────
        $rateLimitKey = 'meeting-walkin:' . $request->ip() . ':' . $meeting->id;

        if (RateLimiter::tooManyAttempts($rateLimitKey, maxAttempts: 3)) {
            $seconds = RateLimiter::availableIn($rateLimitKey);
            return $this->errorResponse(
                "Terlalu banyak percobaan. Silakan tunggu {$seconds} detik sebelum mencoba lagi.",
                null,
                429
            );
        }

        RateLimiter::hit($rateLimitKey, decaySeconds: 300);

        // ── 3. Validate input ────────────────────────────────────────────────
        $validated = $request->validate([
            'nama'      => 'required|string|min:3|max:255',
            'jabatan'   => 'required|string|max:255',
            'instansi'  => 'required|string|max:255',
            'no_hp'     => 'required|string|min:8|max:20',
            'latitude'  => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
        ], [
            'nama.required'     => 'Nama lengkap wajib diisi.',
            'nama.min'          => 'Nama minimal 3 karakter.',
            'jabatan.required'  => 'Jabatan wajib diisi.',
            'instansi.required' => 'Asal instansi wajib diisi.',
            'no_hp.required'    => 'Nomor HP wajib diisi.',
            'no_hp.min'         => 'Nomor HP tidak valid.',
        ]);

        // ── 4. Normalize & validate phone number ─────────────────────────────
        $normalizedPhone = $this->phoneNormalizer->normalize($validated['no_hp']);

        if (!$this->phoneNormalizer->isValid($normalizedPhone)) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors'  => ['no_hp' => ['Nomor HP tidak valid. Contoh format: 08123456789 atau 6281234567890']],
            ], 422);
        }

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
            // Jika lat/lng tidak dikirim padahal geolokasi aktif → tetap diizinkan (opsional)
        }

        // ── 6. Smart Fuzzy Auto-Match: Nama + Instansi ──────────────────────────
        //
        // Tiga strategi pencocokan (diambil nilai tertinggi):
        //   1. Contains-check : menangani singkatan ("Luluk" ada dalam "Luluk Imtihanah")
        //   2. Word-level     : tiap kata input dibandingkan ("neg" cocok "negeri")
        //   3. Character-level: similar_text() sebagai fallback umum
        //
        // Threshold: nama >= 60%, instansi >= 50%.
        // Jika peserta sudah hadir -> tolak agar tidak double-checkin.
        $inputName     = mb_strtolower(trim($validated['nama']));
        $inputInstansi = mb_strtolower(trim($validated['instansi']));

        $allParticipants    = $meeting->participants()->whereNull('deleted_at')->get();
        $matchedParticipant = null;
        $bestScore          = 0.0;

        foreach ($allParticipants as $p) {
            $nameScore     = $this->fuzzyScore($inputName, mb_strtolower($p->name));
            $instansiScore = $this->fuzzyScore($inputInstansi, mb_strtolower($p->instansi ?? ''));

            // Kedua field harus memenuhi threshold masing-masing
            if ($nameScore < 60.0 || $instansiScore < 50.0) {
                continue;
            }

            // Nama diberi bobot lebih besar (60%) dari instansi (40%)
            $combined = ($nameScore * 0.6) + ($instansiScore * 0.4);

            if ($combined > $bestScore) {
                $bestScore          = $combined;
                $matchedParticipant = $p;
            }
        }

        if ($matchedParticipant) {
            $alreadyAttended = MeetingAttendance::where('meeting_id', $meeting->id)
                ->where('participant_id', $matchedParticipant->id)
                ->exists();

            if ($alreadyAttended) {
                return $this->errorResponse(
                    "Kehadiran Anda ({$matchedParticipant->name}) sudah tercatat sebelumnya. Terima kasih!",
                    null,
                    409
                );
            }
        }


        // ── 7. Simpan attendance record ───────────────────────────────────────
        $attendance = DB::transaction(function () use ($meeting, $validated, $normalizedPhone, $request, $matchedParticipant) {
            if ($matchedParticipant) {
                // Peserta terdaftar yang scan walk-in QR → hubungkan ke participant record
                return MeetingAttendance::create([
                    'meeting_id'       => $meeting->id,
                    'participant_id'   => $matchedParticipant->id,     // terhubung ke peserta terdaftar
                    'attendance_type'  => 'qr_umum',                   // tetap dicatat via QR umum
                    'is_delegation'    => false,
                    'walk_in_name'     => null,                        // tidak perlu, sudah ada di participant
                    'walk_in_jabatan'  => null,
                    'walk_in_instansi' => null,
                    'walk_in_phone'    => null,
                    'checked_in_at'    => now(),
                    'ip_address'       => $request->ip(),
                    'device_info'      => $this->extractDeviceInfo($request),
                ]);
            }

            // Walk-in murni (tidak ada peserta terdaftar yang cocok)
            return MeetingAttendance::create([
                'meeting_id'       => $meeting->id,
                'participant_id'   => null,
                'attendance_type'  => 'qr_umum',
                'is_delegation'    => false,
                'walk_in_name'     => trim($validated['nama']),
                'walk_in_jabatan'  => trim($validated['jabatan']),
                'walk_in_instansi' => trim($validated['instansi']),
                'walk_in_phone'    => $normalizedPhone,
                'checked_in_at'    => now(),
                'ip_address'       => $request->ip(),
                'device_info'      => $this->extractDeviceInfo($request),
            ]);
        });

        // Tentukan nama yang akan ditampilkan di respons
        $displayName    = $matchedParticipant?->name    ?? $attendance->walk_in_name;
        $displayJabatan = $matchedParticipant?->jabatan ?? $attendance->walk_in_jabatan;
        $displayInstansi= $matchedParticipant?->instansi?? $attendance->walk_in_instansi;

        $message = $matchedParticipant
            ? "Halo, {$displayName}! Kehadiran Anda berhasil dicatat. Selamat datang!"
            : 'Kehadiran Anda berhasil dicatat. Selamat datang!';

        return $this->successResponse([
            'nama'          => $displayName,
            'jabatan'       => $displayJabatan,
            'instansi'      => $displayInstansi,
            'checked_in_at' => $attendance->checked_in_at->format('H:i:s'),
            'meeting_title' => $meeting->title,
            'matched'       => $matchedParticipant !== null, // flag apakah auto-match berhasil
        ], $message, 201);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

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

        // Simple device type detection
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

    /**
     * Fuzzy similarity score (0-100) antara dua string.
     *
     * Menggabungkan tiga strategi dan mengambil nilai tertinggi:
     *   1. Contains-check  — menangani kasus input merupakan bagian dari kandidat
     *                        atau sebaliknya (misal singkatan nama "Luluk" ada di
     *                        "Luluk Imtihanah, S.Pd.I").
     *   2. Word-level score — membandingkan tiap kata input dengan tiap kata
     *                        kandidat (toleran terhadap singkatan per kata).
     *   3. Character-level — similar_text() sebagai fallback umum.
     */
    private function fuzzyScore(string $input, string $candidate): float
    {
        if ($input === '' || $candidate === '') {
            return $input === $candidate ? 100.0 : 0.0;
        }

        if ($input === $candidate) {
            return 100.0;
        }

        // ── Strategi 1: Contains-check (singkatan / nama pendek) ─────────────
        $shorter = mb_strlen($input) <= mb_strlen($candidate) ? $input : $candidate;
        $longer  = mb_strlen($input) <= mb_strlen($candidate) ? $candidate : $input;

        if (str_contains($longer, $shorter)) {
            $ratio = mb_strlen($shorter) / mb_strlen($longer);
            if ($ratio >= 0.35) {
                return max(75.0, $ratio * 100);
            }
        }

        // ── Strategi 2: Word-level matching ──────────────────────────────────
        $wordScore = $this->wordLevelScore($input, $candidate);

        // ── Strategi 3: Character-level (similar_text) ───────────────────────
        similar_text($input, $candidate, $charScore);

        return max($wordScore, (float) $charScore);
    }

    /**
     * Word-level fuzzy score (0-100).
     *
     * Memecah kedua string menjadi token kata, lalu menghitung berapa persen
     * kata-kata dari input yang punya pasangan di kandidat dengan similar_text >= 75%.
     *
     * Contoh: "sd neg 1 cilacap" vs "sd negeri 1 cilacap"
     *   kata "neg" vs "negeri" = ~75% -> match
     *   kata "cilacap" vs "cilacap" = 100% -> match
     *   => skor tinggi
     */
    private function wordLevelScore(string $input, string $candidate): float
    {
        $tokenize = static function (string $s): array {
            return array_values(array_filter(
                preg_split('/[\s,.\\/\-]+/u', $s),
                static fn ($w) => mb_strlen($w) >= 2
            ));
        };

        $inputWords     = $tokenize($input);
        $candidateWords = $tokenize($candidate);

        if (empty($inputWords) || empty($candidateWords)) {
            return 0.0;
        }

        $matched = 0;
        foreach ($inputWords as $iw) {
            foreach ($candidateWords as $cw) {
                similar_text($iw, $cw, $pct);
                if ($pct >= 75.0) {
                    $matched++;
                    break;
                }
            }
        }

        return ($matched / count($inputWords)) * 100.0;
    }
}
