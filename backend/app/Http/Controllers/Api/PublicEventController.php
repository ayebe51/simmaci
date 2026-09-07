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
                  ->withCount('participants')
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
     * Verify jury PIN and return a short-lived token.
     * PIN is stored in Settings table: key = "jury_pin_{competition_id}"
     *
     * POST /public/jury/verify-pin
     * Body: { competition_id, pin }
     */
    public function juryVerifyPin(Request $request): JsonResponse
    {
        $request->validate([
            'competition_id' => 'required|integer|exists:competitions,id,deleted_at,NULL',
            'pin'            => 'required|string',
            'jury_name'      => 'required|string|min:2|max:100',
        ]);

        $competition = Competition::findOrFail($request->competition_id);

        // PIN stored as "jury_pin_event_{event_id}" in settings, or use a default "maarif2026"
        // We must use Setting::getValue() to bypass TenantScope on public routes
        $stored = \App\Models\Setting::getValue("jury_pin_event_{$competition->event_id}")
            ?? config('app.default_jury_pin', 'maarif2026');

        if ($request->pin !== $stored) {
            return $this->error('PIN juri tidak valid.', 401);
        }

        $juryName = trim($request->jury_name);

        // Issue a short-lived signed token (24h) via Cache containing competition ID & jury name
        $token = bin2hex(random_bytes(20));
        Cache::put("jury_token_{$token}", [
            'competition_id' => $competition->id,
            'jury_name'      => $juryName,
        ], now()->addHours(24));

        return $this->success([
            'token'       => $token,
            'jury_name'   => $juryName,
            'competition' => [
                'id'         => $competition->id,
                'name'       => $competition->name,
                'lomba_type' => $competition->lomba_type,
                'event'      => $competition->event?->name,
            ],
        ], "PIN valid. Selamat datang, Dewan Juri {$juryName}.");
    }

    /**
     * Get participants + existing scores for jury scoring.
     * GET /public/jury/{token}/participants
     */
    public function juryParticipants(string $token): JsonResponse
    {
        $session = $this->resolveJurySession($token);
        if (! $session) return $this->error('Token juri tidak valid atau sudah kadaluarsa.', 401);

        $competitionId = $session['competition_id'];
        $juryName      = $session['jury_name'];

        $competition = Competition::with([
            'participants' => fn ($q) => $q->with(['result', 'juryScores'])->orderBy('institution')->orderBy('name'),
            'event:id,name',
        ])->findOrFail($competitionId);

        $lombaType = $competition->lomba_type;
        $criteria  = $competition->scoring_criteria ?? [];

        // For anugerah types, merge from anugerah_registrations
        $isAnugerah = in_array($lombaType, ['guru_berprestasi', 'madrasah_berprestasi']);
        $participants = collect();

        if ($isAnugerah) {
            $registrations = \App\Models\AnugerahRegistration::where('competition_id', $competitionId)
                ->whereIn('status', ['submitted', 'under_review', 'finalis', 'winner', 'draft'])
                ->with('juryScores')
                ->orderBy('school_name')
                ->orderBy('applicant_name')
                ->get();

            $participants = $registrations->map(function ($r) use ($juryName) {
                $myScore   = $r->juryScores->firstWhere('jury_name', $juryName);
                $allScores = $r->juryScores;
                $jCount    = $allScores->count();
                $avgScore  = $jCount > 0 ? round((float) $allScores->avg('score'), 2) : (float) $r->total_score;

                return [
                    'id'            => 'reg_' . $r->id,
                    'name'          => $r->applicant_name,
                    'institution'   => $r->school_name,
                    'jenjang'       => $r->jenjang,
                    'kecamatan'     => $r->kecamatan,
                    'contact_phone' => $r->contact_phone,
                    'status'        => $r->status,
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
                        'rank'             => $r->rank,
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
                'id'          => $competition->id,
                'name'        => $competition->name,
                'lomba_type'  => $lombaType,
                'jenjang'     => $competition->jenjang,
                'event'       => $competition->event?->name,
                'criteria'    => $criteria,
                'is_anugerah' => $isAnugerah,
            ],
            'participants' => $participants,
        ]);
    }

    /**
     * Jury saves score for a single participant.
     * POST /public/jury/{token}/score
     * Body: { participant_id, rank, score, notes, score_breakdown }
     * participant_id can be numeric (competition_participant) or "reg_{id}" (anugerah_registration)
     */
    public function juryScore(Request $request, string $token): JsonResponse
    {
        $session = $this->resolveJurySession($token);
        if (! $session) return $this->error('Token juri tidak valid atau sudah kadaluarsa.', 401);

        $competitionId = $session['competition_id'];
        $juryName      = $session['jury_name'];

        $competition = Competition::findOrFail($competitionId);

        $data = $request->validate([
            'participant_id'  => 'required|string',
            'rank'            => 'nullable|integer|min:1',
            'score'           => 'required|numeric|min:0|max:100',
            'notes'           => 'nullable|string|max:1000',
            'score_breakdown' => 'nullable|array',
        ]);

        $scoreVal = (float) $data['score'];

        // Anugerah registration (id prefixed with "reg_")
        if (str_starts_with((string) $data['participant_id'], 'reg_')) {
            $regId = (int) substr($data['participant_id'], 4);
            $reg   = \App\Models\AnugerahRegistration::where('id', $regId)
                ->where('competition_id', $competitionId)
                ->firstOrFail();

            // 1. Record score specifically for this jury
            \App\Models\CompetitionJuryScore::updateOrCreate(
                [
                    'competition_id'           => $competitionId,
                    'anugerah_registration_id' => $regId,
                    'jury_name'                => $juryName,
                ],
                [
                    'score'           => $scoreVal,
                    'score_breakdown' => $data['score_breakdown'] ?? null,
                    'notes'           => $data['notes'] ?? null,
                ]
            );

            // 2. Aggregate all jury scores for this registration (Average)
            $allJuryScores = \App\Models\CompetitionJuryScore::where('competition_id', $competitionId)
                ->where('anugerah_registration_id', $regId)
                ->get();

            $avgScore = round((float) $allJuryScores->avg('score'), 2);

            // 3. Update main registration record with aggregated average
            $reg->update([
                'total_score'     => $avgScore,
                'reviewer_notes'  => $data['notes'] ?? $reg->reviewer_notes,
                'score_breakdown' => $data['score_breakdown'] ?? $reg->score_breakdown,
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

        // 3. Update competition_results with aggregated average
        $result = CompetitionResult::updateOrCreate(
            ['competition_id' => $competitionId, 'participant_id' => $participant->id],
            [
                'score'           => $avgScore,
                'notes'           => $data['notes'] ?? null,
                'score_breakdown' => $data['score_breakdown'] ?? null,
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
}
