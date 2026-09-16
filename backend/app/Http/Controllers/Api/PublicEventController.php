<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\CompetitionParticipant;
use App\Models\CompetitionResult;
use App\Models\Event;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

/**
 * Public endpoints — no auth token required.
 *
 * Three entry points:
 *  1. /public/events/{event}           — show event info + open competitions
 *  2. /public/events/{event}/daftar    — public registration form (POST)
 *  3. /public/jury/{token}             — jury scoring panel (PIN-protected)
 */
class PublicEventController extends Controller
{
    use ApiResponse;

    // ── 1. Public event info ───────────────────────────────────────────────────

    public function show(Event $event): JsonResponse
    {
        $event->load([
            'competitions' => function ($q) {
                $q->where('status', 'OPEN')
                  ->withCount(['participants', 'anugerahRegistrations'])
                  ->orderBy('name');
            },
        ]);

        // Only return safe public fields
        return $this->success([
            'id'                 => $event->id,
            'name'               => $event->name,
            'slug'               => $event->slug,
            'category'           => $event->category,
            'date'               => $event->date,
            'location'           => $event->location,
            'description'        => $event->description,
            'status'             => $event->status,
            'registration_start' => $event->registration_start,
            'registration_end'   => $event->registration_end,
            'video_deadline'     => $event->video_deadline,
            'announcement_date'  => $event->announcement_date,
            'announcement_place' => $event->announcement_place,
            'contact_name'       => $event->contact_name,
            'contact_phone'      => $event->contact_phone,
            'competitions'       => $event->competitions,
        ]);
    }

    /**
     * Resolve event by slug (redirect-compatible).
     * GET /public/events/by-slug/{slug}
     */
    public function showBySlug(string $slug): JsonResponse
    {
        $event = Event::where('slug', $slug)->firstOrFail();
        return $this->show($event);
    }

    // ── 2. Public registration ─────────────────────────────────────────────────

    /**
     * Wrapper that resolves event by ID or slug before calling register().
     * POST /public/events/{idOrSlug}/daftar
     */
    public function registerByIdOrSlug(Request $request, string $idOrSlug): JsonResponse
    {
        $event = is_numeric($idOrSlug)
            ? Event::findOrFail($idOrSlug)
            : Event::where('slug', $idOrSlug)->firstOrFail();

        return $this->register($request, $event);
    }

    public function register(Request $request, Event $event): JsonResponse
    {
        if ($event->status !== 'OPEN') {
            return $this->error('Pendaftaran event ini sudah ditutup.', 422);
        }

        $competition = Competition::where('event_id', $event->id)
            ->where('id', $request->competition_id)
            ->where('status', 'OPEN')
            ->first();

        if (! $competition) {
            return $this->error('Cabang lomba tidak ditemukan atau sudah ditutup.', 404);
        }

        // Check registration deadline
        if ($competition->deadline && now()->gt($competition->deadline)) {
            return $this->error('Batas waktu pendaftaran cabang lomba ini sudah lewat.', 422);
        }

        $isAnugerah = in_array($competition->lomba_type, ['guru_berprestasi', 'madrasah_berprestasi']);

        if ($isAnugerah) {
            return $this->registerAnugerah($request, $event, $competition);
        }

        return $this->registerFestival($request, $event, $competition);
    }

    private function registerFestival(Request $request, Event $event, Competition $competition): JsonResponse
    {
        $isVideoBased = in_array($competition->lomba_type, ['mars_maarif', 'mtq', 'mtq_pa', 'mtq_pi', 'puji_pujian', 'film_dokumenter']);

        $data = $request->validate([
            'name'                            => 'required|string|max:255',
            'jenjang'                         => 'required|string|in:MI/SD,MTs/SMP,MA/SMA/SMK',
            'institution'                     => 'required|string|max:255',
            'gender_category'                 => 'nullable|string|in:pa,pi,campuran',
            'group_name'                      => 'nullable|string|max:255',
            'member_count'                    => 'nullable|integer|min:1',
            'members'                         => 'nullable|array',
            'members.*.name'                  => 'required_with:members|string|max:255',
            'members.*.nim'                   => 'nullable|string|max:50',
            'contact_person'                  => 'nullable|string|max:100',
            'contact_phone'                   => 'nullable|string|max:30',
            'video_url'                       => 'nullable|string|max:1000',
            'video_filename'                  => 'nullable|string|max:255',
            'sinopsis_url'                    => 'nullable|string|max:1000',
            'surat_keterangan_aktif_url'      => 'nullable|string|max:1000',
            'sertifikat_pkpnu_url'            => 'nullable|string|max:1000',
            'surat_rekomendasi_url'           => 'nullable|string|max:1000',
            'surat_keterangan_integritas_url' => 'nullable|string|max:1000',
            'bukti_prestasi_url'              => 'nullable|string|max:1000',
            'dokumen_admin_url'               => 'nullable|string|max:1000',
        ]);

        // Enforce max_per_school if institution-based limit set
        if ($competition->max_per_school) {
            $existing = CompetitionParticipant::where('competition_id', $competition->id)
                ->where('institution', $data['institution'])
                ->count();
            if ($existing >= $competition->max_per_school) {
                return $this->error(
                    "Sekolah '{$data['institution']}' sudah mencapai batas maksimal peserta ({$competition->max_per_school}) untuk lomba ini.",
                    422
                );
            }
        }

        $participant = CompetitionParticipant::create(array_merge($data, [
            'competition_id'      => $competition->id,
            'registration_status' => 'pending',
            'video_status'        => !empty($data['video_url']) ? 'submitted' : 'pending',
        ]));

        return $this->success([
            'id'          => $participant->id,
            'name'        => $participant->name,
            'institution' => $participant->institution,
            'competition' => $competition->name,
            'event'       => $event->name,
        ], 'Pendaftaran berhasil! Nomor registrasi: #' . $participant->id, 201);
    }

    private function registerAnugerah(Request $request, Event $event, Competition $competition): JsonResponse
    {
        $isGuru = $competition->lomba_type === 'guru_berprestasi';

        $data = $request->validate([
            'category'                        => 'required|string|in:guru,madrasah',
            'jenjang'                         => 'required|string|in:MI/SD,MTs/SMP,MA/SMA/SMK',
            'applicant_name'                  => 'required|string|max:255',
            'applicant_nuptk'                 => 'nullable|string|max:30',
            'school_name'                     => 'required|string|max:255',
            'kecamatan'                       => 'nullable|string|max:100',
            'masa_bakti_tahun'                => 'nullable|integer|min:0',
            'mulai_bertugas'                  => 'nullable|date',
            'contact_phone'                   => 'nullable|string|max:30',
            'surat_keterangan_aktif_url'      => 'nullable|string|max:1000',
            'sertifikat_pkpnu_url'            => 'nullable|string|max:1000',
            'surat_rekomendasi_url'           => 'nullable|string|max:1000',
            'surat_keterangan_integritas_url' => 'nullable|string|max:1000',
            'bukti_prestasi_url'              => 'nullable|string|max:1000',
            'esai_reflektif_url'              => 'nullable|string|max:1000',
            'karya_ilmiah_url'                => 'nullable|string|max:1000',
            'dokumen_pdca_url'                => 'nullable|string|max:1000',
            'portofolio_branding_url'         => 'nullable|string|max:1000',
            'rekap_prestasi_url'              => 'nullable|string|max:1000',
            'dokumen_admin_url'               => 'nullable|string|max:1000',
        ]);

        $hasDocs = !empty($data['surat_rekomendasi_url']) || !empty($data['esai_reflektif_url']) || !empty($data['bukti_prestasi_url']) || !empty($data['dokumen_pdca_url']);

        $registration = AnugerahRegistration::create(array_merge($data, [
            'event_id'       => $event->id,
            'competition_id' => $competition->id,
            'status'         => $hasDocs ? 'submitted' : 'draft',
            'submitted_at'   => $hasDocs ? now() : null,
        ]));

        return $this->success([
            'id'             => $registration->id,
            'applicant_name' => $registration->applicant_name,
            'school_name'    => $registration->school_name,
            'category'       => $registration->category,
            'jenjang'        => $registration->jenjang,
            'status'         => $registration->status,
        ], 'Pendaftaran berhasil dikirim. Nomor registrasi: #' . $registration->id, 201);
    }

    // ── 3. Jury panel ─────────────────────────────────────────────────────────

    /**
     * GET /public/jury/competitions/{id}/existing-juries
     * Returns list of existing juries who have scored in this competition.
     */
    public function existingJuries(int $id): JsonResponse
    {
        $competition = Competition::findOrFail($id);
        $juries = \App\Models\CompetitionJuryScore::where('competition_id', $id)
            ->whereNotNull('jury_name')
            ->distinct()
            ->pluck('jury_name')
            ->map(fn ($n) => trim((string) $n))
            ->filter(fn ($n) => !empty($n))
            ->values();

        return $this->success([
            'competition_id'   => $competition->id,
            'competition_name' => $competition->name,
            'existing_juries'  => $juries,
        ]);
    }

    /**
     * Resolve canonical jury name to prevent typos and mismatch across sessions.
     */
    protected function resolveCanonicalJuryName(int $competitionId, string $inputName): array
    {
        $cleanInput = trim($inputName);
        if (empty($cleanInput)) {
            return ['name' => $cleanInput, 'matched' => false];
        }

        $existingJuries = \App\Models\CompetitionJuryScore::where('competition_id', $competitionId)
            ->whereNotNull('jury_name')
            ->distinct()
            ->pluck('jury_name')
            ->map(fn ($n) => trim((string) $n))
            ->filter(fn ($n) => !empty($n))
            ->values();

        if ($existingJuries->isEmpty()) {
            return ['name' => $cleanInput, 'matched' => false];
        }

        // 1. Exact match (case-insensitive)
        foreach ($existingJuries as $existing) {
            if (strcasecmp($existing, $cleanInput) === 0) {
                return ['name' => $existing, 'matched' => true];
            }
        }

        // Helper to normalize name (remove honorary / academic titles & non-alphanumeric)
        $normalize = function (string $name): string {
            $name = mb_strtolower(trim($name));
            $titles = [
                'dr.', 'dr', 'drs.', 'drs', 'dra.', 'dra', 'h.', 'h', 'haji', 'hajjah', 'hj.', 'hj',
                'kh.', 'kh', 'kyai', 'k.', 'gus', 'ning', 'prof.', 'prof', 'm.pd', 'm.pd.', 'mpd',
                's.pd', 's.pd.', 'spd', 's.ag', 's.ag.', 'sag', 'm.ag', 'm.ag.', 'mag', 'm.si',
                's.si', 'lc', 'lc.', 's.kom', 'm.kom', 'm.hum', 's.hum', 's.sos', 'm.sos'
            ];
            $clean = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $name);
            $words = preg_split('/\s+/', (string) $clean, -1, PREG_SPLIT_NO_EMPTY);
            $filtered = array_filter($words, fn ($w) => !in_array($w, $titles, true));
            return implode(' ', $filtered);
        };

        $normInput = $normalize($cleanInput);

        // 2. Normalized EXACT match (titles removed)
        // E.g. "Ahmad Subhan" exactly matches "Drs. H. Ahmad Subhan, M.Pd"
        if (!empty($normInput)) {
            foreach ($existingJuries as $existing) {
                if ($normalize($existing) === $normInput) {
                    return ['name' => $existing, 'matched' => true];
                }
            }
        }

        // 3. Strict Typo Match ONLY (same word count, similarity >= 88%, Levenshtein <= 2)
        // Never do substring matching! Substring matching causes "Ahmad" to hijack "Ahmad Dahlan" or "Budi" to hijack "Budi Santoso"!
        if (!empty($normInput) && mb_strlen($normInput) >= 4) {
            $inputWordCount = count(explode(' ', $normInput));
            foreach ($existingJuries as $existing) {
                $normExisting = $normalize($existing);
                $existingWordCount = count(explode(' ', $normExisting));

                if ($inputWordCount === $existingWordCount && !empty($normExisting)) {
                    similar_text($normInput, $normExisting, $simNorm);
                    $lev = levenshtein($normInput, $normExisting);
                    if ($simNorm >= 88.0 && $lev <= 2) {
                        return ['name' => $existing, 'matched' => true];
                    }
                }
            }
        }

        // No safe match found -> respect what the user actually typed!
        return ['name' => $cleanInput, 'matched' => false];
    }

    /**
     * Get criteria split by Phase (1: berkas, 2: wawancara/visitasi).
     */
    public function getPhaseCriteriaInfo(string $lombaType, ?array $criteria): array
    {
        $criteria = $criteria ?? [];
        if (!in_array($lombaType, ['guru_berprestasi', 'madrasah_berprestasi'], true)) {
            return [
                'is_two_phase' => false,
                'phase1'       => $criteria,
                'phase2'       => [],
                'phase1_max'   => 100,
                'phase2_max'   => 0,
            ];
        }

        if ($lombaType === 'guru_berprestasi') {
            // Phase 1: Prestasi (40%) + Naskah (30%) = 70%
            // Phase 2: Aswaja (15%) + Wawancara (15%) = 30%
            return [
                'is_two_phase' => true,
                'phase1'       => array_values(array_slice($criteria, 0, 2)),
                'phase2'       => array_values(array_slice($criteria, 2)),
                'phase1_max'   => 70,
                'phase2_max'   => 30,
            ];
        }

        // madrasah_berprestasi
        // Phase 1: Prestasi (45%) + Tata Kelola (25%) + Kemitraan (15%) = 85%
        // Phase 2: Presentasi Kamad & Visitasi (15%) = 15%
        return [
            'is_two_phase' => true,
            'phase1'       => array_values(array_slice($criteria, 0, 3)),
            'phase2'       => array_values(array_slice($criteria, 3)),
            'phase1_max'   => 85,
            'phase2_max'   => 15,
        ];
    }

    /**
     * Calculate Phase 1, Phase 2, and Total score from score_breakdown array.
     */
    public function calculateBreakdownPhases(string $lombaType, ?array $breakdown): array
    {
        if (empty($breakdown) || !is_array($breakdown)) {
            return ['phase1_score' => 0.0, 'phase2_score' => 0.0, 'total_score' => 0.0];
        }

        $phase1Sum = 0.0;
        $phase2Sum = 0.0;

        foreach ($breakdown as $index => $item) {
            $weight = (float) ($item['weight'] ?? 0);
            $val = (float) ($item['value'] ?? 0);
            $componentScore = ($val * $weight) / 100.0;
            $name = strtolower($item['component'] ?? '');

            $isP1 = true;
            if ($lombaType === 'guru_berprestasi') {
                if (str_contains($name, 'aswaja') || str_contains($name, 'wawancara') || str_contains($name, 'interview')) {
                    $isP1 = false;
                } else {
                    $isP1 = ($index < 2);
                }
            } elseif ($lombaType === 'madrasah_berprestasi') {
                if (str_contains($name, 'presentasi') || str_contains($name, 'visitasi') || str_contains($name, 'fact checking')) {
                    $isP1 = false;
                } else {
                    $isP1 = ($index < 3);
                }
            }

            if ($isP1) {
                $phase1Sum += $componentScore;
            } else {
                $phase2Sum += $componentScore;
            }
        }

        return [
            'phase1_score' => round($phase1Sum, 2),
            'phase2_score' => round($phase2Sum, 2),
            'total_score'  => round($phase1Sum + $phase2Sum, 2),
        ];
    }

    /**
     * Verify jury PIN and return a short-lived token.
     * PIN is stored in Settings table: key = "jury_pin_event_{event_id}"
     *
     * POST /public/jury/verify-pin
     * Body: { competition_id, pin, jury_name }
     */
    public function juryVerifyPin(Request $request): JsonResponse
    {
        $request->validate([
            'competition_id' => 'required|integer|exists:competitions,id,deleted_at,NULL',
            'pin'            => 'required|string',
            'jury_name'      => 'required|string|min:2|max:100',
        ]);

        $competition = Competition::findOrFail($request->competition_id);

        // PIN stored as "jury_pin_event_{event_id}" in settings
        // We must use Setting::getValue() to bypass TenantScope on public routes
        $stored = \App\Models\Setting::getValue("jury_pin_event_{$competition->event_id}")
            ?? config('app.default_jury_pin');

        if (empty($stored)) {
            return $this->error('PIN juri belum dikonfigurasi untuk event ini. Hubungi administrator.', null, 422);
        }

        if (!hash_equals((string) $stored, (string) $request->pin)) {
            return $this->error('PIN juri tidak valid.', null, 401);
        }

        // Smart canonical name resolution
        $resolved = $this->resolveCanonicalJuryName($competition->id, $request->jury_name);
        $juryName = $resolved['name'];
        $wasMatched = $resolved['matched'];

        // Issue a short-lived signed token (24h) via Cache containing competition ID & jury name
        $token = bin2hex(random_bytes(20));
        Cache::put("jury_token_{$token}", [
            'competition_id' => $competition->id,
            'jury_name'      => $juryName,
        ], now()->addHours(24));

        $welcomeMsg = "PIN valid. Selamat datang, Dewan Juri {$juryName}.";
        if ($wasMatched && strcasecmp($juryName, trim($request->jury_name)) !== 0) {
            $welcomeMsg .= " (Nama Anda otomatis dicocokkan dengan data penilaian sebelumnya)";
        }

        return $this->success([
            'token'            => $token,
            'jury_name'        => $juryName,
            'original_input'   => trim($request->jury_name),
            'matched_existing' => $wasMatched,
            'competition' => [
                'id'         => $competition->id,
                'name'       => $competition->name,
                'lomba_type' => $competition->lomba_type,
                'event'      => $competition->event?->name,
            ],
        ], $welcomeMsg);
    }

    /**
     * Get participants + existing scores for jury scoring.
     * GET /public/jury/{token}/participants?phase=1|2
     */
    public function juryParticipants(Request $request, string $token): JsonResponse
    {
        $session = $this->resolveJurySession($token);
        if (! $session) return $this->error('Token juri tidak valid atau sudah kadaluarsa.', 401);

        $competitionId = $session['competition_id'];
        $juryName      = $session['jury_name'];
        $phase         = (int) $request->query('phase', 1);
        if ($phase < 1 || $phase > 2) {
            $phase = 1;
        }

        $competition = Competition::with([
            'participants' => fn ($q) => $q->with(['result', 'juryScores'])->orderBy('institution')->orderBy('name'),
            'event:id,name',
        ])->findOrFail($competitionId);

        $lombaType = $competition->lomba_type;
        $criteria  = $competition->scoring_criteria ?? [];
        $phaseInfo = $this->getPhaseCriteriaInfo($lombaType, $criteria);

        // For anugerah types, merge from anugerah_registrations
        $isAnugerah = in_array($lombaType, ['guru_berprestasi', 'madrasah_berprestasi'], true);
        $participants = collect();

        if ($isAnugerah) {
            $query = \App\Models\AnugerahRegistration::where('competition_id', $competitionId);

            if ($phase === 2) {
                // In Phase 2: only show promoted finalists (or winners)
                $query->whereIn('status', ['finalis', 'winner']);
            } else {
                $query->whereIn('status', ['submitted', 'under_review', 'finalis', 'winner', 'draft']);
            }

            $registrations = $query->with('juryScores')
                ->orderBy('school_name')
                ->orderBy('applicant_name')
                ->get();

            $participants = $registrations->map(function ($r) use ($juryName, $lombaType, $phase, $phaseInfo) {
                $myScore   = $r->juryScores->firstWhere('jury_name', $juryName);
                $allScores = $r->juryScores;
                $jCount    = $allScores->count();
                $avgScore  = $jCount > 0 ? round((float) $allScores->avg('score'), 2) : (float) $r->total_score;

                // Calculate Phase breakdown for the logged-in jury
                $myBreakdownCalc = $this->calculateBreakdownPhases($lombaType, $myScore?->score_breakdown);

                // 1. Calculate Phase 1 scores from all juries who actually evaluated Phase 1 components (> 0)
                $validPhase1Scores = $allScores->map(function ($s) use ($lombaType) {
                    return $this->calculateBreakdownPhases($lombaType, $s->score_breakdown)['phase1_score'];
                })->filter(fn ($score) => (float) $score > 0);

                $avgPhase1 = $validPhase1Scores->count() > 0 ? round((float) $validPhase1Scores->avg(), 2) : 0.0;

                // 2. If no jury scores have Phase 1 > 0, fallback to $r->score_breakdown
                if ($avgPhase1 <= 0 && !empty($r->score_breakdown)) {
                    $regCalc = $this->calculateBreakdownPhases($lombaType, $r->score_breakdown);
                    if ($regCalc['phase1_score'] > 0) {
                        $avgPhase1 = $regCalc['phase1_score'];
                    }
                }

                // 3. If still 0, and participant is promoted finalist or in Phase 2 with total_score <= phase1_max
                if ($avgPhase1 <= 0 && ($phase === 2 || in_array($r->status, ['finalis', 'winner'], true))) {
                    $maxP1 = (float) ($phaseInfo['phase1_max'] ?? 70);
                    if ((float) $r->total_score > 0 && (float) $r->total_score <= $maxP1) {
                        $avgPhase1 = round((float) $r->total_score, 2);
                    }
                }

                // In Phase 2, finalists have an established Phase 1 score.
                // If the logged-in jury gave a Phase 1 score > 0, we can use that,
                // otherwise fallback to the participant's official Phase 1 score ($avgPhase1).
                $effectivePhase1 = ($myBreakdownCalc['phase1_score'] > 0) ? $myBreakdownCalc['phase1_score'] : $avgPhase1;

                return [
                    'id'            => 'reg_' . $r->id,
                    'name'          => $r->applicant_name,
                    'institution'   => $r->school_name,
                    'jenjang'       => $r->jenjang,
                    'kecamatan'     => $r->kecamatan,
                    'contact_phone' => $r->contact_phone,
                    'status'        => $r->status,
                    'is_finalis'    => in_array($r->status, ['finalis', 'winner'], true),
                    'total_score'   => $avgScore,
                    'documents'     => array_filter([
                        'Surat Keterangan Aktif'       => $r->surat_keterangan_aktif_url,
                        'Sertifikat PKPNU'             => $r->sertifikat_pkpnu_url,
                        'Surat Rekomendasi'            => $r->surat_rekomendasi_url,
                        'Surat Keterangan Integritas'  => $r->surat_keterangan_integritas_url,
                        'Bukti Prestasi / Sertifikat'  => $r->bukti_prestasi_url,
                        'Esai Reflektif'               => $r->esai_reflektif_url,
                        'Karya Ilmiah / Publikasi'     => $r->karya_ilmiah_url,
                        'Dokumen PDCA'                 => $r->dokumen_pdca_url,
                        'Portofolio Branding'          => $r->portofolio_branding_url,
                        'Rekap Prestasi'               => $r->rekap_prestasi_url,
                        'Dokumen Administratif'        => $r->dokumen_admin_url,
                    ]),
                    'video_url'     => null,
                    'result'        => [
                        'rank'                   => $r->rank,
                        'score'                  => $myScore ? (float) $myScore->score : null,
                        'notes'                  => $myScore?->notes ?? '',
                        'score_breakdown'        => $myScore?->score_breakdown ?? null,
                        'phase1_score'           => $effectivePhase1,
                        'phase2_score'           => $myBreakdownCalc['phase2_score'],
                        'phase1_avg_score'       => $avgPhase1,
                        'phase1_effective_score' => $effectivePhase1,
                        'final_score'            => $avgScore,
                        'juries_count'           => $jCount,
                        'is_scored_by_me'        => ($myScore !== null),
                        'all_jury_scores'        => $allScores->map(fn ($s) => [
                            'jury_name' => $s->jury_name,
                            'score'     => (float) $s->score,
                        ])->values(),
                    ],
                    'type'          => 'anugerah',
                    'reg_id'        => $r->id,
                ];
            });
        } else {
            $participants = $competition->participants->map(function ($p) use ($juryName) {
                $myScore   = $p->juryScores->firstWhere('jury_name', $juryName);
                $allScores = $p->juryScores;
                $jCount    = $allScores->count();
                $avgScore  = $jCount > 0 ? round((float) $allScores->avg('score'), 2) : ($p->result ? (float) $p->result->score : null);

                return [
                    'id'              => $p->id,
                    'name'            => $p->name,
                    'jenjang'         => $p->jenjang,
                    'institution'     => $p->institution,
                    'gender_category' => $p->gender_category,
                    'contact_phone'   => $p->contact_phone,
                    'video_url'       => $p->video_url,
                    'documents'   => array_filter([
                        'Surat Keterangan Aktif'       => $p->surat_keterangan_aktif_url,
                        'Sertifikat PKPNU'             => $p->sertifikat_pkpnu_url,
                        'Surat Rekomendasi'            => $p->surat_rekomendasi_url,
                        'Surat Keterangan Integritas'  => $p->surat_keterangan_integritas_url,
                        'Bukti Prestasi / Sertifikat'  => $p->bukti_prestasi_url,
                        'Esai Reflektif'               => $p->esai_reflektif_url,
                        'Karya Ilmiah / Publikasi'     => $p->karya_ilmiah_url,
                        'Dokumen PDCA'                 => $p->dokumen_pdca_url,
                        'Portofolio Branding'          => $p->portofolio_branding_url,
                        'Rekap Prestasi'               => $p->rekap_prestasi_url,
                        'Dokumen Administratif'        => $p->dokumen_admin_url,
                        'Sinopsis / Naskah'            => $p->sinopsis_url,
                    ]),
                    'result'      => [
                        'rank'             => $p->result?->rank,
                        'score'            => $myScore ? (float) $myScore->score : null,
                        'notes'            => $myScore?->notes ?? '',
                        'score_breakdown'  => $myScore?->score_breakdown ?? null,
                        'final_score'      => $avgScore,
                        'juries_count'     => $jCount,
                        'is_scored_by_me'  => ($myScore !== null),
                        'all_jury_scores'  => $allScores->map(fn ($s) => [
                            'jury_name' => $s->jury_name,
                            'score'     => (float) $s->score,
                        ])->values(),
                    ],
                    'type' => 'competition',
                ];
            });
        }

        return $this->success([
            'jury_name'   => $juryName,
            'competition' => [
                'id'               => $competition->id,
                'name'             => $competition->name,
                'lomba_type'       => $lombaType,
                'jenjang'          => $competition->jenjang,
                'event'            => $competition->event?->name,
                'criteria'         => $criteria,
                'is_anugerah'      => $isAnugerah,
                'is_two_phase'     => $phaseInfo['is_two_phase'],
                'phase'            => $phase,
                'phase1_criteria'  => $phaseInfo['phase1'],
                'phase2_criteria'  => $phaseInfo['phase2'],
                'phase1_max_score' => $phaseInfo['phase1_max'],
                'phase2_max_score' => $phaseInfo['phase2_max'],
                'is_locked'               => $competition->isScoresLocked(),
                'freeze_submitted_scores' => $competition->isFreezeSubmittedScores(),
                'status'                  => $competition->status,
                'is_phase1_locked'        => $competition->isPhase1Locked(),
                'has_finalists'           => $isAnugerah && \App\Models\AnugerahRegistration::where('competition_id', $competitionId)->whereIn('status', ['finalis', 'winner'])->exists(),
            ],
            'participants' => $participants,
        ]);
    }

    /**
     * Jury saves score for a single participant.
     * POST /public/jury/{token}/score
     * Body: { participant_id, rank, score, notes, score_breakdown, phase }
     * participant_id can be numeric (competition_participant) or "reg_{id}" (anugerah_registration)
     */
    public function juryScore(Request $request, string $token): JsonResponse
    {
        $session = $this->resolveJurySession($token);
        if (! $session) return $this->error('Token juri tidak valid atau sudah kadaluarsa.', 401);

        $competitionId = $session['competition_id'];
        $juryName      = $session['jury_name'];

        $competition = Competition::findOrFail($competitionId);

        if ($competition->isScoresLocked()) {
            return $this->error('Penilaian untuk cabang lomba ini telah dikunci/final. Nilai tidak dapat diubah.', null, 403);
        }

        $data = $request->validate([
            'participant_id'  => 'required', // Can be integer (competition participant) or string ('reg_X' for anugerah)
            'rank'            => 'nullable|integer|min:1',
            'score'           => 'required|numeric|min:0|max:100',
            'notes'           => 'nullable|string|max:1000',
            'score_breakdown' => 'nullable|array',
            'phase'           => 'nullable|integer|in:1,2',
        ]);

        $scoreVal = (float) $data['score'];

        // Anugerah registration (id prefixed with "reg_")
        if (str_starts_with((string) $data['participant_id'], 'reg_')) {
            $regId = (int) substr($data['participant_id'], 4);
            $reg   = \App\Models\AnugerahRegistration::where('id', $regId)
                ->where('competition_id', $competitionId)
                ->firstOrFail();

            $existingJuryScore = \App\Models\CompetitionJuryScore::where([
                'competition_id'           => $competitionId,
                'anugerah_registration_id' => $regId,
                'jury_name'                => $juryName,
            ])->first();

            if ($competition->isFreezeSubmittedScores() && $existingJuryScore !== null) {
                return $this->error('Nilai untuk peserta ini sudah tersimpan dan telah dikunci. Nilai tidak dapat diubah lagi.', null, 403);
            }

            $isTwoPhase = in_array($competition->lomba_type, ['guru_berprestasi', 'madrasah_berprestasi'], true);
            $newBreakdown = $data['score_breakdown'] ?? [];

            // If two-phase competition has Phase 1 locked (finalists already promoted),
            // prevent any modifications to Phase 1 (Seleksi Berkas)
            if ($isTwoPhase && isset($data['phase']) && (int) $data['phase'] === 1 && $competition->isPhase1Locked()) {
                return $this->error('Penilaian seleksi berkas (Fase 1) telah selesai dan dikunci permanen karena tahapan lomba telah memasuki Fase 2 (Wawancara & Visitasi). Nilai Fase 1 tidak dapat diubah lagi.', null, 403);
            }

            // Merge score_breakdown to preserve Phase 1 scores when Phase 2 is submitted (and vice versa)
            $mergedMap = collect();
            if ($existingJuryScore && is_array($existingJuryScore->score_breakdown)) {
                $mergedMap = collect($existingJuryScore->score_breakdown)->keyBy('component');
            }

            // In two-phase competition: If submitting Phase 2 and mergedMap is missing Phase 1 components,
            // inherit Phase 1 components from the registration's existing score_breakdown or other Phase 1 jury scores!
            if ($isTwoPhase && !empty($newBreakdown)) {
                $calcMerged = $this->calculateBreakdownPhases($competition->lomba_type, $mergedMap->values()->toArray());
                if ($calcMerged['phase1_score'] <= 0) {
                    // 1. Try from $reg->score_breakdown
                    if (is_array($reg->score_breakdown)) {
                        foreach ($reg->score_breakdown as $item) {
                            if (isset($item['component']) && !isset($mergedMap[$item['component']])) {
                                $mergedMap[$item['component']] = $item;
                            }
                        }
                    }
                    // 2. If still missing, look for another jury score that evaluated Phase 1
                    $calcMerged2 = $this->calculateBreakdownPhases($competition->lomba_type, $mergedMap->values()->toArray());
                    if ($calcMerged2['phase1_score'] <= 0) {
                        $p1JuryScore = \App\Models\CompetitionJuryScore::where('competition_id', $competitionId)
                            ->where('anugerah_registration_id', $regId)
                            ->whereNotNull('score_breakdown')
                            ->get()
                            ->first(fn ($js) => $this->calculateBreakdownPhases($competition->lomba_type, $js->score_breakdown)['phase1_score'] > 0);
                        if ($p1JuryScore && is_array($p1JuryScore->score_breakdown)) {
                            foreach ($p1JuryScore->score_breakdown as $item) {
                                if (isset($item['component']) && !isset($mergedMap[$item['component']])) {
                                    $mergedMap[$item['component']] = $item;
                                }
                            }
                        }
                    }
                }
            }

            // Overlay the newly submitted breakdown components
            foreach ($newBreakdown as $item) {
                if (isset($item['component'])) {
                    $mergedMap[$item['component']] = $item;
                }
            }
            $finalBreakdown = $mergedMap->isNotEmpty() ? $mergedMap->values()->toArray() : ($existingJuryScore?->score_breakdown ?? null);

            // Recalculate total score for this jury from merged breakdown if available
            if (!empty($finalBreakdown)) {
                $phaseCalc = $this->calculateBreakdownPhases($competition->lomba_type, $finalBreakdown);
                $scoreVal = $phaseCalc['total_score'];
            }

            // 1. Record score specifically for this jury
            \App\Models\CompetitionJuryScore::updateOrCreate(
                [
                    'competition_id'           => $competitionId,
                    'anugerah_registration_id' => $regId,
                    'jury_name'                => $juryName,
                ],
                [
                    'score'           => $scoreVal,
                    'score_breakdown' => $finalBreakdown,
                    'notes'           => $data['notes'] ?? $existingJuryScore?->notes,
                ]
            );

            // 2. Aggregate all jury scores for this registration (Average)
            $allJuryScores = \App\Models\CompetitionJuryScore::where('competition_id', $competitionId)
                ->where('anugerah_registration_id', $regId)
                ->get();

            $aggregatedBreakdown = $this->aggregateJuryBreakdowns($allJuryScores, $finalBreakdown ?? $reg->score_breakdown);

            // In two-phase competitions, the true total score is calculated from the full aggregated breakdown
            if ($isTwoPhase && !empty($aggregatedBreakdown)) {
                $phaseCalc = $this->calculateBreakdownPhases($competition->lomba_type, $aggregatedBreakdown);
                $avgScore = $phaseCalc['total_score'];
            } else {
                $avgScore = round((float) $allJuryScores->avg('score'), 2);
            }

            // 3. Update main registration record with aggregated average
            $reg->update([
                'total_score'     => $avgScore,
                'reviewer_notes'  => $data['notes'] ?? $reg->reviewer_notes,
                'score_breakdown' => $aggregatedBreakdown,
            ]);

            // 4. Automatically recalculate and assign ranks in real-time
            \App\Services\CompetitionRankingService::autoRank($competition);

            $reg->refresh();

            return $this->success([
                'participant_id'  => $data['participant_id'],
                'name'            => $reg->applicant_name,
                'jury_name'       => $juryName,
                'jury_score'      => $scoreVal,
                'final_score'     => (float) $reg->total_score,
                'juries_count'    => $allJuryScores->count(),
                'rank'            => $reg->rank,
                'all_jury_scores' => $allJuryScores->map(fn ($s) => ['jury_name' => $s->jury_name, 'score' => (float) $s->score])->values(),
            ], "Nilai dari {$juryName} berhasil disimpan. Rata-rata: {$reg->total_score} (Juara {$reg->rank}).");
        }

        // Regular competition participant (Festival Aswaja)
        $participant = CompetitionParticipant::where('id', (int) $data['participant_id'])
            ->where('competition_id', $competitionId)
            ->firstOrFail();

        $existingJuryScore = \App\Models\CompetitionJuryScore::where([
            'competition_id' => $competitionId,
            'participant_id' => $participant->id,
            'jury_name'      => $juryName,
        ])->first();

        if ($competition->isFreezeSubmittedScores() && $existingJuryScore !== null) {
            return $this->error('Nilai untuk peserta ini sudah tersimpan dan telah dikunci. Nilai tidak dapat diubah lagi.', null, 403);
        }

        // 1. Record score specifically for this jury
        \App\Models\CompetitionJuryScore::updateOrCreate(
            [
                'competition_id' => $competitionId,
                'participant_id' => $participant->id,
                'jury_name'      => $juryName,
            ],
            [
                'score'           => $scoreVal,
                'score_breakdown' => $data['score_breakdown'] ?? null,
                'notes'           => $data['notes'] ?? null,
            ]
        );


        // 2. Aggregate all jury scores for this participant (Average)
        $allJuryScores = \App\Models\CompetitionJuryScore::where('competition_id', $competitionId)
            ->where('participant_id', $participant->id)
            ->get();

        $avgScore = round((float) $allJuryScores->avg('score'), 2);
        $aggregatedBreakdown = $this->aggregateJuryBreakdowns($allJuryScores, $data['score_breakdown'] ?? null);

        // 3. Update competition_results with aggregated average and aggregated breakdown
        $result = CompetitionResult::updateOrCreate(
            ['competition_id' => $competitionId, 'participant_id' => $participant->id],
            [
                'score'           => $avgScore,
                'notes'           => $data['notes'] ?? null,
                'score_breakdown' => $aggregatedBreakdown,
            ]
        );

        // 4. Automatically recalculate and assign ranks in real-time
        \App\Services\CompetitionRankingService::autoRank($competition);

        $result->refresh();

        return $this->success([
            'participant_id'  => $participant->id,
            'name'            => $participant->name,
            'jury_name'       => $juryName,
            'jury_score'      => $scoreVal,
            'final_score'     => (float) $result->score,
            'juries_count'    => $allJuryScores->count(),
            'rank'            => $result->rank,
            'all_jury_scores' => $allJuryScores->map(fn ($s) => ['jury_name' => $s->jury_name, 'score' => (float) $s->score])->values(),
        ], "Nilai dari {$juryName} berhasil disimpan. Rata-rata: {$result->score} (Juara {$result->rank}).");
    }

    /**
     * Get final scoreboard for a competition (public, no auth).
     * GET /public/events/{event}/scoreboard/{competition}
     */
    public function scoreboard(Event $event, Competition $competition): JsonResponse
    {
        if ($competition->event_id !== $event->id) {
            return $this->error('Kompetisi tidak ditemukan dalam event ini.', 404);
        }

        $isAnugerah = in_array($competition->lomba_type, ['guru_berprestasi', 'madrasah_berprestasi']);

        if ($isAnugerah) {
            $results = \App\Models\AnugerahRegistration::where('competition_id', $competition->id)
                ->with('juryScores')
                ->where(function ($q) {
                    $q->whereNotNull('rank')->orWhere('total_score', '>', 0);
                })
                ->orderByRaw('CASE WHEN rank IS NULL THEN 9999 ELSE rank END ASC')
                ->orderByDesc('total_score')
                ->get()
                ->map(fn ($r) => [
                    'rank'            => $r->rank,
                    'name'            => $r->applicant_name,
                    'institution'     => $r->school_name,
                    'score'           => (float) $r->total_score,
                    'notes'           => $r->reviewer_notes,
                    'juries_count'    => $r->juryScores->count(),
                    'all_jury_scores' => $r->juryScores->map(fn ($s) => ['jury_name' => $s->jury_name, 'score' => (float) $s->score])->values(),
                ]);
        } else {
            $results = CompetitionResult::where('competition_id', $competition->id)
                ->with(['participant:id,name,institution,gender_category', 'participant.juryScores'])
                ->where(function ($q) {
                    $q->whereNotNull('rank')->orWhere('score', '>', 0);
                })
                ->orderByRaw('CASE WHEN rank IS NULL THEN 9999 ELSE rank END ASC')
                ->orderByDesc('score')
                ->get()
                ->map(fn ($r) => [
                    'rank'            => $r->rank,
                    'name'            => $r->participant?->name,
                    'institution'     => $r->participant?->institution,
                    'score'           => (float) $r->score,
                    'notes'           => $r->notes,
                    'juries_count'    => $r->participant?->juryScores ? $r->participant->juryScores->count() : 0,
                    'all_jury_scores' => $r->participant?->juryScores ? $r->participant->juryScores->map(fn ($s) => ['jury_name' => $s->jury_name, 'score' => (float) $s->score])->values() : [],
                ]);
        }

        return $this->success([
            'event'       => $event->name,
            'competition' => $competition->name,
            'jenjang'     => $competition->jenjang,
            'results'     => $results,
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function resolveJurySession(string $token): ?array
    {
        $val = Cache::get("jury_token_{$token}");
        if (! $val) return null;

        if (is_array($val)) {
            return [
                'competition_id' => (int) ($val['competition_id'] ?? 0),
                'jury_name'      => (string) ($val['jury_name'] ?? 'Dewan Juri'),
            ];
        }

        // Backward compatibility if token stores integer competition ID
        return [
            'competition_id' => (int) $val,
            'jury_name'      => 'Dewan Juri',
        ];
    }

    private function resolveJuryToken(string $token): ?int
    {
        $session = $this->resolveJurySession($token);
        return $session ? $session['competition_id'] : null;
    }

    private function getCriteria(string $lombaType): array
    {
        // Legacy fallback method. New competitions should use scoring_criteria column.
        $map = [
            'mars_maarif'     => [['component'=>'Teknik Vokal','weight'=>35],['component'=>'Harmonisasi & Keselarasan','weight'=>35],['component'=>'Penjiwaan & Ekspresi','weight'=>30]],
            'mtq'             => [['component'=>'Tajwid','weight'=>45],['component'=>'Lagu & Irama','weight'=>35],['component'=>'Adab & Penampilan','weight'=>20]],
            'mtq_pa'          => [['component'=>'Tajwid','weight'=>45],['component'=>'Lagu & Irama','weight'=>35],['component'=>'Adab & Penampilan','weight'=>20]],
            'mtq_pi'          => [['component'=>'Tajwid','weight'=>45],['component'=>'Lagu & Irama','weight'=>35],['component'=>'Adab & Penampilan','weight'=>20]],
            'puji_pujian'     => [['component'=>'Makhraj & Artikulasi Bahasa Jawa','weight'=>35],['component'=>'Penjiwaan & Penghayatan','weight'=>30],['component'=>'Harmonisasi Suara & Irama','weight'=>25],['component'=>'Adab & Penampilan','weight'=>10]],
            'film_dokumenter' => [['component'=>'Kesesuaian Tema & Kedalaman Konten','weight'=>35],['component'=>'Alur Cerita & Struktur Narasi','weight'=>25],['component'=>'Sinematografi & Editing','weight'=>25],['component'=>'Kreativitas & Estetika','weight'=>15]],
        ];
        return $map[$lombaType] ?? [];
    }

    /**
     * Compute aggregated score_breakdown across all jury scores.
     */
    private function aggregateJuryBreakdowns($juryScores, ?array $fallbackBreakdown = null): ?array
    {
        $componentSums = [];
        $componentCounts = [];
        $componentWeights = [];

        foreach ($juryScores as $js) {
            $bd = $js->score_breakdown;
            if (is_array($bd)) {
                foreach ($bd as $item) {
                    if (isset($item['component'])) {
                        $comp = $item['component'];
                        $componentSums[$comp] = ($componentSums[$comp] ?? 0) + (float) ($item['value'] ?? 0);
                        $componentCounts[$comp] = ($componentCounts[$comp] ?? 0) + 1;
                        $componentWeights[$comp] = (float) ($item['weight'] ?? 0);
                    }
                }
            }
        }

        if (empty($componentSums)) {
            return $fallbackBreakdown;
        }

        $aggregated = [];
        foreach ($componentSums as $comp => $sum) {
            $count = $componentCounts[$comp] ?: 1;
            $aggregated[] = [
                'component' => $comp,
                'weight'    => $componentWeights[$comp],
                'value'     => round($sum / $count, 2),
            ];
        }

        return $aggregated;
    }
}

