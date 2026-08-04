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
        $isVideoBased = in_array($competition->lomba_type, ['mars_maarif', 'mtq', 'puji_pujian', 'film_dokumenter']);

        $data = $request->validate([
            'name'            => 'required|string|max:255',
            'jenjang'         => 'required|string|in:MI/SD,MTs/SMP,MA/SMA/SMK',
            'institution'     => 'required|string|max:255',
            'gender_category' => 'nullable|string|in:pa,pi,campuran',
            'group_name'      => 'nullable|string|max:255',
            'member_count'    => 'nullable|integer|min:1',
            'members'         => 'nullable|array',
            'members.*.name'  => 'required_with:members|string|max:255',
            'members.*.nim'   => 'nullable|string|max:50',
            'contact_person'  => 'nullable|string|max:100',
            'contact_phone'   => 'nullable|string|max:30',
            'video_url'       => $isVideoBased ? 'required|url|max:500' : 'nullable|url|max:500',
            'video_filename'  => 'nullable|string|max:255',
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
            'video_status'        => $data['video_url'] ? 'submitted' : 'pending',
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
            'category'        => 'required|string|in:guru,madrasah',
            'jenjang'         => 'required|string|in:MI/SD,MTs/SMP,MA/SMA/SMK',
            'applicant_name'  => 'required|string|max:255',
            'applicant_nuptk' => 'nullable|string|max:30',
            'school_name'     => 'required|string|max:255',
            'kecamatan'       => 'nullable|string|max:100',
            'masa_bakti_tahun'=> 'nullable|integer|min:0',
            'mulai_bertugas'  => 'nullable|date',
            'contact_phone'   => 'nullable|string|max:30',
        ]);

        $registration = AnugerahRegistration::create(array_merge($data, [
            'event_id'       => $event->id,
            'competition_id' => $competition->id,
            'status'         => 'draft',
        ]));

        return $this->success([
            'id'             => $registration->id,
            'applicant_name' => $registration->applicant_name,
            'school_name'    => $registration->school_name,
            'category'       => $registration->category,
            'jenjang'        => $registration->jenjang,
            'status'         => $registration->status,
        ], 'Pendaftaran berhasil dikirim. Silakan lengkapi berkas via SIMMACI. Nomor registrasi: #' . $registration->id, 201);
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
            'competition_id' => 'required|integer|exists:competitions,id',
            'pin'            => 'required|string',
        ]);

        $competition = Competition::findOrFail($request->competition_id);

        // PIN stored as "jury_pin_event_{event_id}" in settings, or use a default "maarif2026"
        // We must use Setting::getValue() to bypass TenantScope on public routes
        $stored = \App\Models\Setting::getValue("jury_pin_event_{$competition->event_id}")
            ?? config('app.default_jury_pin', 'maarif2026');

        if ($request->pin !== $stored) {
            return $this->error('PIN juri tidak valid.', 401);
        }

        // Issue a short-lived signed token (24h) via Cache
        $token = bin2hex(random_bytes(20));
        Cache::put("jury_token_{$token}", $competition->id, now()->addHours(24));

        return $this->success([
            'token'       => $token,
            'competition' => [
                'id'         => $competition->id,
                'name'       => $competition->name,
                'lomba_type' => $competition->lomba_type,
                'event'      => $competition->event?->name,
            ],
        ], 'PIN valid. Selamat datang, Dewan Juri.');
    }

    /**
     * Get participants + existing scores for jury scoring.
     * GET /public/jury/{token}/participants
     */
    public function juryParticipants(string $token): JsonResponse
    {
        $competitionId = $this->resolveJuryToken($token);
        if (! $competitionId) return $this->error('Token juri tidak valid atau sudah kadaluarsa.', 401);

        $competition = Competition::with([
            'participants' => fn ($q) => $q->with('result')->orderBy('institution')->orderBy('name'),
            'event:id,name',
        ])->findOrFail($competitionId);

        $lombaType = $competition->lomba_type;
        $criteria  = $this->getCriteria($lombaType);

        // For anugerah types, merge from anugerah_registrations
        $isAnugerah = in_array($lombaType, ['guru_berprestasi', 'madrasah_berprestasi']);
        $participants = collect();

        if ($isAnugerah) {
            $registrations = \App\Models\AnugerahRegistration::where('competition_id', $competitionId)
                ->whereIn('status', ['submitted', 'under_review', 'finalis', 'winner', 'draft'])
                ->orderBy('school_name')
                ->orderBy('applicant_name')
                ->get();

            $participants = $registrations->map(fn ($r) => [
                'id'          => 'reg_' . $r->id,
                'name'        => $r->applicant_name,
                'institution' => $r->school_name,
                'jenjang'     => $r->jenjang,
                'kecamatan'   => $r->kecamatan,
                'status'      => $r->status,
                'total_score' => $r->total_score,
                'video_url'   => null,
                'result'      => $r->rank ? ['rank' => $r->rank, 'score' => $r->total_score, 'notes' => $r->reviewer_notes] : null,
                'type'        => 'anugerah',
                'reg_id'      => $r->id,
            ]);
        } else {
            $participants = $competition->participants->map(fn ($p) => [
                'id'          => $p->id,
                'name'        => $p->name,
                'jenjang'     => $p->jenjang,
                'institution' => $p->institution,
                'gender_category' => $p->gender_category,
                'video_url'   => $p->video_url,
                'result'      => $p->result ? [
                    'rank'            => $p->result->rank,
                    'score'           => $p->result->score,
                    'notes'           => $p->result->notes,
                    'score_breakdown' => $p->result->score_breakdown,
                ] : null,
                'type' => 'competition',
            ]);
        }

        return $this->success([
            'competition' => [
                'id'         => $competition->id,
                'name'       => $competition->name,
                'lomba_type' => $lombaType,
                'jenjang'    => $competition->jenjang,
                'event'      => $competition->event?->name,
                'criteria'   => $criteria,
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
        $competitionId = $this->resolveJuryToken($token);
        if (! $competitionId) return $this->error('Token juri tidak valid atau sudah kadaluarsa.', 401);

        $data = $request->validate([
            'participant_id'  => 'required|string',
            'rank'            => 'nullable|integer|min:1',
            'score'           => 'nullable|numeric|min:0|max:100',
            'notes'           => 'nullable|string|max:1000',
            'score_breakdown' => 'nullable|array',
        ]);

        // Anugerah registration (id prefixed with "reg_")
        if (str_starts_with((string) $data['participant_id'], 'reg_')) {
            $regId = (int) substr($data['participant_id'], 4);
            $reg   = \App\Models\AnugerahRegistration::where('id', $regId)
                ->where('competition_id', $competitionId)
                ->firstOrFail();

            $reg->update([
                'rank'           => $data['rank'] ?? $reg->rank,
                'reviewer_notes' => $data['notes'] ?? $reg->reviewer_notes,
                'total_score'    => $data['score'] !== null ? (int) $data['score'] : $reg->total_score,
            ]);

            return $this->success([
                'participant_id' => $data['participant_id'],
                'name'           => $reg->applicant_name,
                'rank'           => $reg->rank,
                'score'          => $reg->total_score,
            ], 'Nilai berhasil disimpan.');
        }

        // Regular competition participant
        $participant = CompetitionParticipant::where('id', (int) $data['participant_id'])
            ->where('competition_id', $competitionId)
            ->firstOrFail();

        $result = CompetitionResult::updateOrCreate(
            ['competition_id' => $competitionId, 'participant_id' => $participant->id],
            [
                'rank'            => $data['rank'] ?? null,
                'score'           => $data['score'] ?? null,
                'notes'           => $data['notes'] ?? null,
                'score_breakdown' => $data['score_breakdown'] ?? null,
            ]
        );

        return $this->success([
            'participant_id' => $participant->id,
            'name'           => $participant->name,
            'rank'           => $result->rank,
            'score'          => $result->score,
        ], 'Nilai berhasil disimpan.');
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

        $results = CompetitionResult::where('competition_id', $competition->id)
            ->with('participant:id,name,institution,gender_category')
            ->whereNotNull('rank')
            ->orderBy('rank')
            ->get()
            ->map(fn ($r) => [
                'rank'        => $r->rank,
                'name'        => $r->participant?->name,
                'institution' => $r->participant?->institution,
                'score'       => $r->score,
                'notes'       => $r->notes,
            ]);

        return $this->success([
            'event'       => $event->name,
            'competition' => $competition->name,
            'jenjang'     => $competition->jenjang,
            'results'     => $results,
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function resolveJuryToken(string $token): ?int
    {
        return Cache::get("jury_token_{$token}");
    }

    private function getCriteria(string $lombaType): array
    {
        $map = [
            'mars_maarif'     => [['component'=>'Teknik Vokal','weight'=>35],['component'=>'Harmonisasi & Keselarasan','weight'=>35],['component'=>'Penjiwaan & Ekspresi','weight'=>30]],
            'mtq_pa'          => [['component'=>'Tajwid','weight'=>45],['component'=>'Lagu & Irama','weight'=>35],['component'=>'Adab & Penampilan','weight'=>20]],
            'mtq_pi'          => [['component'=>'Tajwid','weight'=>45],['component'=>'Lagu & Irama','weight'=>35],['component'=>'Adab & Penampilan','weight'=>20]],
            'puji_pujian'     => [['component'=>'Makhraj & Artikulasi','weight'=>35],['component'=>'Penjiwaan & Penghayatan','weight'=>30],['component'=>'Harmonisasi','weight'=>25],['component'=>'Adab & Penampilan','weight'=>10]],
            'film_dokumenter' => [['component'=>'Kesesuaian Tema & Konten','weight'=>35],['component'=>'Alur Cerita & Narasi','weight'=>25],['component'=>'Sinematografi & Editing','weight'=>25],['component'=>'Kreativitas & Estetika','weight'=>15]],
        ];
        return $map[$lombaType] ?? [];
    }
}
