<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Competition;
use App\Models\CompetitionParticipant;
use App\Models\CompetitionResult;
use App\Models\Event;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class CompetitionController extends Controller
{
    use ApiResponse;

    // ── List competitions for an event ─────────────────────────────────────────
    public function index(Event $event): JsonResponse
    {
        $competitions = $event->competitions()
            ->withCount(['participants', 'anugerahRegistrations'])
            ->withCount('results')
            ->orderBy('name')
            ->get();

        return $this->success($competitions);
    }

    // ── Create competition ─────────────────────────────────────────────────────
    public function store(Request $request, Event $event): JsonResponse
    {
        if (! in_array(Auth::user()?->role, ['super_admin', 'admin_yayasan', 'admin'])) {
            abort(403, 'Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat menambah cabang lomba.');
        }

        $data = $request->validate([
            'name'             => 'required|string|max:255',
            'category'         => 'required|string|max:100',
            'type'             => 'nullable|string|in:Individual,Beregu',
            'jenjang'          => 'nullable|string|max:100',
            'lomba_type'       => 'nullable|string|max:50',
            'date'             => 'nullable|date',
            'location'         => 'nullable|string|max:255',
            'status'           => 'nullable|string|in:OPEN,CLOSED,FINISHED',
            'deadline'         => 'nullable|date',
            'scoring_criteria' => 'nullable|array',
            'max_per_school'   => 'nullable|integer|min:1',
        ]);

        $data['event_id'] = $event->id;
        $competition = Competition::create($data);

        return $this->success(
            $competition->loadCount(['participants', 'anugerahRegistrations', 'results']),
            'Cabang lomba berhasil dibuat',
            201
        );
    }

    // ── Show competition detail ────────────────────────────────────────────────
    public function show(Competition $competition): JsonResponse
    {
        $competition->load([
            'event',
            'participants' => fn ($q) => $q->with(['result', 'juryScores'])->orderBy('institution')->orderBy('name'),
            'results.participant',
        ]);

        $needsAutoRank = false;

        // For anugerah types, also load registrations with jury scores
        $anugerahRegistrations = [];
        if (in_array($competition->lomba_type, ['guru_berprestasi', 'madrasah_berprestasi'])) {
            $anugerahQuery = \App\Models\AnugerahRegistration::where('competition_id', $competition->id)
                ->with('juryScores')
                ->orderBy('school_name')->orderBy('applicant_name')
                ->get();

            foreach ($anugerahQuery as $reg) {
                if ($reg->juryScores && $reg->juryScores->isNotEmpty()) {
                    $expectedAvg = round((float) $reg->juryScores->avg('score'), 2);
                    if ($reg->total_score === null || abs((float) $reg->total_score - $expectedAvg) >= 0.01) {
                        $reg->update(['total_score' => $expectedAvg]);
                        $needsAutoRank = true;
                    }
                }
            }

            if ($needsAutoRank) {
                \App\Services\CompetitionRankingService::autoRank($competition);
                $anugerahQuery = \App\Models\AnugerahRegistration::where('competition_id', $competition->id)
                    ->with('juryScores')
                    ->orderBy('school_name')->orderBy('applicant_name')
                    ->get();
            }

            $anugerahRegistrations = $anugerahQuery->toArray();
        } else {
            // For festival / regular competitions, ensure results match multi-jury average
            foreach ($competition->participants as $p) {
                if ($p->juryScores && $p->juryScores->isNotEmpty()) {
                    $expectedAvg = round((float) $p->juryScores->avg('score'), 2);
                    $curScore = $p->result ? (float) $p->result->score : null;
                    if ($curScore === null || abs($curScore - $expectedAvg) >= 0.01) {
                        \App\Models\CompetitionResult::updateOrCreate(
                            ['competition_id' => $competition->id, 'participant_id' => $p->id],
                            ['score' => $expectedAvg]
                        );
                        $needsAutoRank = true;
                    }
                }
            }

            if ($needsAutoRank) {
                \App\Services\CompetitionRankingService::autoRank($competition);
                $competition->load([
                    'event',
                    'participants' => fn ($q) => $q->with(['result', 'juryScores'])->orderBy('institution')->orderBy('name'),
                    'results.participant',
                ]);
            }
        }

        $data = $competition->toArray();
        $data['is_locked'] = $competition->isScoresLocked();
        $data['anugerah_registrations'] = $anugerahRegistrations;

        return $this->success($data);
    }

    // ── Update competition ─────────────────────────────────────────────────────
    public function update(Request $request, Competition $competition): JsonResponse
    {
        if (! in_array(Auth::user()?->role, ['super_admin', 'admin_yayasan', 'admin'])) {
            return $this->error('Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat mengubah cabang lomba.', 403);
        }

        $data = $request->validate([
            'name'             => 'nullable|string|max:255',
            'category'         => 'nullable|string|max:100',
            'type'             => 'nullable|string|in:Individual,Beregu',
            'jenjang'          => 'nullable|string|max:100',
            'lomba_type'       => 'nullable|string|max:50',
            'date'             => 'nullable|date',
            'location'         => 'nullable|string|max:255',
            'status'           => 'nullable|string|in:OPEN,CLOSED,FINISHED',
            'deadline'         => 'nullable|date',
            'scoring_criteria' => 'nullable|array',
            'max_per_school'   => 'nullable|integer|min:1',
        ]);

        $competition->update($data);
        return $this->success($competition->loadCount(['participants', 'anugerahRegistrations', 'results']));
    }

    // ── Delete competition ────────────────────────────────────────────────
    public function destroy(Competition $competition): JsonResponse
    {
        if (! in_array(Auth::user()?->role, ['super_admin', 'admin_yayasan', 'admin'])) {
            return $this->error('Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat menghapus cabang lomba.', 403);
        }

        $competition->delete();
        return $this->success(null, 'Cabang lomba berhasil dihapus');
    }

    // ─────────────────────────── PARTICIPANTS ─────────────────────────────────

    public function participantsIndex(Competition $competition): JsonResponse
    {
        $participants = $competition->participants()
            ->with('result')
            ->orderBy('institution')
            ->orderBy('name')
            ->get();

        return $this->success($participants);
    }

    public function participantsStore(Request $request, Competition $competition): JsonResponse
    {
        $data = $request->validate([
            'name'                            => 'required|string|max:255',
            'institution'                     => 'required|string|max:255',
            'jenjang'                         => 'nullable|string|max:50',
            'school_id'                       => 'nullable|integer|exists:schools,id',
            'teacher_id'                      => 'nullable|integer|exists:teachers,id',
            'group_name'                      => 'nullable|string|max:255',
            'member_count'                    => 'nullable|integer|min:1',
            'gender_category'                 => 'nullable|string|in:pa,pi,campuran',
            'contact_person'                  => 'nullable|string|max:100',
            'contact_phone'                   => 'nullable|string|max:30',
            'video_url'                       => 'nullable|string|max:1000',
            'video_filename'                  => 'nullable|string|max:255',
            'registration_status'             => 'nullable|string|in:pending,verified,rejected',
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
            'sinopsis_url'                    => 'nullable|string|max:1000',
        ]);

        $user = $request->user();
        if ($user?->isOperator()) {
            $data['school_id'] = $user->school_id;
            unset($data['registration_status'], $data['video_status']);
            $data['registration_status'] = 'pending';
        }

        // Enforce max_per_school limit if set
        if ($competition->max_per_school && isset($data['school_id'])) {
            $existing = $competition->countFromSchool((int) $data['school_id']);
            if ($existing >= $competition->max_per_school) {
                return $this->error(
                    "Sekolah ini sudah mencapai batas maksimal peserta ({$competition->max_per_school}) untuk lomba ini.",
                    422
                );
            }
        }

        $data['competition_id'] = $competition->id;
        $participant = CompetitionParticipant::create($data);

        return $this->success($participant, 'Peserta berhasil ditambahkan', 201);
    }

    public function participantsUpdate(Request $request, CompetitionParticipant $participant): JsonResponse
    {
        $user = $request->user();
        if ($user && ! in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            if ((int) $participant->school_id !== (int) $user->school_id) {
                abort(403, 'Akses ditolak: Anda tidak dapat mengubah data peserta madrasah lain.');
            }
        }

        $data = $request->validate([
            'name'                          => 'nullable|string|max:255',
            'institution'                   => 'nullable|string|max:255',
            'school_id'                     => 'nullable|integer|exists:schools,id',
            'group_name'                    => 'nullable|string|max:255',
            'member_count'                  => 'nullable|integer|min:1',
            'gender_category'               => 'nullable|string|in:pa,pi,campuran',
            'contact_person'                => 'nullable|string|max:100',
            'contact_phone'                 => 'nullable|string|max:30',
            'video_url'                     => 'nullable|url|max:500',
            'video_filename'                => 'nullable|string|max:255',
            'video_status'                  => 'nullable|string|in:pending,submitted,reviewed',
            'registration_status'           => 'nullable|string|in:pending,verified,rejected',
            'surat_keterangan_aktif_url'    => 'nullable|string|max:500',
            'sertifikat_pkpnu_url'          => 'nullable|string|max:500',
            'surat_rekomendasi_url'         => 'nullable|string|max:500',
            'surat_keterangan_integritas_url' => 'nullable|string|max:500',
            'bukti_prestasi_url'            => 'nullable|string|max:500',
            'esai_reflektif_url'            => 'nullable|string|max:500',
            'karya_ilmiah_url'              => 'nullable|string|max:500',
            'dokumen_pdca_url'              => 'nullable|string|max:500',
            'portofolio_branding_url'       => 'nullable|string|max:500',
            'rekap_prestasi_url'            => 'nullable|string|max:500',
            'dokumen_admin_url'             => 'nullable|string|max:500',
            'sinopsis_url'                  => 'nullable|string|max:500',
        ]);

        if ($user && ! in_array($user->role, ['super_admin', 'admin_yayasan'], true)) {
            // Operators cannot verify or transfer school of participant
            unset($data['registration_status'], $data['video_status'], $data['school_id']);
        }

        $participant->update($data);
        return $this->success($participant->load('result'));
    }

    public function participantsDestroy(Request $request, CompetitionParticipant $participant): JsonResponse
    {
        if (! in_array($request->user()?->role, ['super_admin', 'admin_yayasan'], true)) {
            abort(403, 'Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat menghapus peserta lomba.');
        }

        $participant->delete();
        return $this->success(null, 'Peserta berhasil dihapus');
    }

    // ─────────────────────────── RESULTS ──────────────────────────────────────

    public function resultsStore(Request $request, Competition $competition): JsonResponse
    {
        if (! in_array($request->user()?->role, ['super_admin', 'admin_yayasan'], true)) {
            abort(403, 'Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat menyimpan hasil lomba.');
        }

        if ($competition->isScoresLocked() && ! in_array($request->user()?->role, ['super_admin'], true)) {
            return $this->error('Nilai cabang lomba ini telah dikunci/final. Perubahan nilai tidak diizinkan.', null, 403);
        }

        $data = $request->validate([
            'participant_id'  => 'required', // Can be integer or string (reg_X)
            'rank'            => 'nullable|integer|min:1',
            'score'           => 'nullable|numeric|min:0',
            'notes'           => 'nullable|string',
            'score_breakdown' => 'nullable|array',
        ]);

        $pId = $data['participant_id'];
        if (is_string($pId) && str_starts_with($pId, 'reg_')) {
            $regId = (int) substr($pId, 4);
            $reg = \App\Models\AnugerahRegistration::where('id', $regId)
                ->where('competition_id', $competition->id)
                ->firstOrFail();

            $juryScores = \App\Models\CompetitionJuryScore::where('competition_id', $competition->id)
                ->where('anugerah_registration_id', $regId)->get();

            $finalScore = $juryScores->isNotEmpty()
                ? round((float) $juryScores->avg('score'), 2)
                : ($data['score'] !== null ? (float) $data['score'] : null);

            $reg->update([
                'rank'            => $data['rank'] ?? null,
                'total_score'     => $finalScore,
                'reviewer_notes'  => $data['notes'] ?? null,
                'score_breakdown' => $data['score_breakdown'] ?? null,
            ]);

            \App\Services\CompetitionRankingService::autoRank($competition);
            $reg->refresh();

            return $this->success([
                'id'             => 'reg_' . $reg->id,
                'participant_id' => 'reg_' . $reg->id,
                'name'           => $reg->applicant_name,
                'rank'           => $reg->rank,
                'score'          => $reg->total_score,
                'notes'          => $reg->reviewer_notes,
            ], 'Nilai berhasil disimpan & juara otomatis diperbarui');
        }

        $partId = (int) $data['participant_id'];
        $juryScores = \App\Models\CompetitionJuryScore::where('competition_id', $competition->id)
            ->where('participant_id', $partId)->get();

        $finalScore = $juryScores->isNotEmpty()
            ? round((float) $juryScores->avg('score'), 2)
            : ($data['score'] !== null ? (float) $data['score'] : null);

        $result = CompetitionResult::updateOrCreate(
            [
                'competition_id' => $competition->id,
                'participant_id' => $partId,
            ],
            [
                'rank'            => $data['rank'] ?? null,
                'score'           => $finalScore,
                'notes'           => $data['notes'] ?? null,
                'score_breakdown' => $data['score_breakdown'] ?? null,
            ]
        );

        \App\Services\CompetitionRankingService::autoRank($competition);
        $result->refresh();

        return $this->success($result->load('participant'), 'Nilai berhasil disimpan & juara otomatis diperbarui');
    }

    public function resultsBulkStore(Request $request, Competition $competition): JsonResponse
    {
        if (! in_array($request->user()?->role, ['super_admin', 'admin_yayasan'], true)) {
            abort(403, 'Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat menyimpan hasil lomba.');
        }

        if ($competition->isScoresLocked() && ! in_array($request->user()?->role, ['super_admin'], true)) {
            return $this->error('Nilai cabang lomba ini telah dikunci/final. Perubahan nilai tidak diizinkan.', null, 403);
        }

        $request->validate([
            'results'                           => 'required|array',
            'results.*.participant_id'          => 'required', // Can be integer or string (reg_X)
            'results.*.rank'                    => 'nullable|integer|min:1',
            'results.*.score'                   => 'nullable|numeric|min:0',
            'results.*.notes'                   => 'nullable|string',
            'results.*.score_breakdown'         => 'nullable|array',
        ]);

        DB::transaction(function () use ($request, $competition) {
            foreach ($request->results as $item) {
                $pId = $item['participant_id'];
                if (is_string($pId) && str_starts_with($pId, 'reg_')) {
                    $regId = (int) substr($pId, 4);
                    \App\Models\AnugerahRegistration::where('id', $regId)
                        ->where('competition_id', $competition->id)
                        ->update([
                            'rank'            => $item['rank'] ?? null,
                            'total_score'     => isset($item['score']) && $item['score'] !== null ? (float) $item['score'] : null,
                            'reviewer_notes'  => $item['notes'] ?? null,
                            'score_breakdown' => $item['score_breakdown'] ?? null,
                        ]);
                } else {
                    CompetitionResult::updateOrCreate(
                        [
                            'competition_id' => $competition->id,
                            'participant_id' => (int) $pId,
                        ],
                        [
                            'rank'            => $item['rank'] ?? null,
                            'score'           => isset($item['score']) && $item['score'] !== null ? (float) $item['score'] : null,
                            'notes'           => $item['notes'] ?? null,
                            'score_breakdown' => $item['score_breakdown'] ?? null,
                        ]
                    );
                }
            }
        });

        \App\Services\CompetitionRankingService::autoRank($competition);

        return $this->success(null, 'Semua nilai berhasil disimpan & juara otomatis diperbarui');
    }

    public function resultsImport(Request $request, Competition $competition): JsonResponse
    {
        if (! in_array($request->user()?->role, ['super_admin', 'admin_yayasan'], true)) {
            abort(403, 'Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat mengimport hasil lomba.');
        }

        if ($competition->isScoresLocked() && ! in_array($request->user()?->role, ['super_admin'], true)) {
            return $this->error('Nilai cabang lomba ini telah dikunci/final. Perubahan nilai tidak diizinkan.', null, 403);
        }

        $request->validate(['file' => 'required|file|mimes:xlsx,csv|max:5120']);

        // Basic Excel import — reads rows as [rank, name, institution, score]
        try {
            $file  = $request->file('file');
            $rows  = \Maatwebsite\Excel\Facades\Excel::toArray([], $file)[0] ?? [];
            $saved = 0;

            foreach (array_slice($rows, 1) as $row) { // skip header
                if (empty($row[1])) continue;

                $rank        = isset($row[0]) ? (int) $row[0] : null;
                $name        = trim((string) ($row[1] ?? ''));
                $institution = trim((string) ($row[2] ?? ''));
                $score       = isset($row[3]) ? (float) $row[3] : null;

                if (! $name) continue;

                $participant = CompetitionParticipant::firstOrCreate(
                    ['competition_id' => $competition->id, 'name' => $name],
                    ['institution'    => $institution]
                );

                CompetitionResult::updateOrCreate(
                    ['competition_id' => $competition->id, 'participant_id' => $participant->id],
                    ['rank' => $rank, 'score' => $score]
                );

                $saved++;
            }

            \App\Services\CompetitionRankingService::autoRank($competition);

            return $this->success(['imported' => $saved], "{$saved} hasil berhasil diimport & juara otomatis diperbarui");
        } catch (\Throwable $e) {
            return $this->error('Gagal mengimport file: ' . $e->getMessage(), 422);
        }
    }

    // ─────────────────────── PROMOTE FINALISTS ──────────────────────────────

    /**
     * POST /competitions/{competition}/promote-finalists
     * Promote top 3 participants from Phase 1 per jenjang to 'finalis' status.
     */
    public function promoteFinalists(Competition $competition): JsonResponse
    {
        if (! in_array(Auth::user()?->role, ['super_admin', 'admin_yayasan'], true)) {
            return $this->error('Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat menetapkan finalis.', 403);
        }

        $lombaType = $competition->lomba_type;
        if (! in_array($lombaType, ['guru_berprestasi', 'madrasah_berprestasi'], true)) {
            return $this->error('Fitur finalis 3 besar hanya berlaku untuk Anugerah Guru & Madrasah Berprestasi.', 422);
        }

        $registrations = \App\Models\AnugerahRegistration::where('competition_id', $competition->id)
            ->whereNotIn('status', ['rejected'])
            ->with('juryScores')
            ->get();

        if ($registrations->isEmpty()) {
            return $this->error('Belum ada pendaftar pada cabang lomba ini.', 422);
        }

        // Calculate Phase 1 average score for each registration
        $scoredRegistrations = $registrations->map(function ($reg) use ($lombaType) {
            $scores = $reg->juryScores;
            if ($scores->isEmpty()) {
                $phase1Score = 0.0;
            } else {
                $p1Scores = $scores->map(function ($s) use ($lombaType) {
                    $breakdown = $s->score_breakdown;
                    if (!empty($breakdown) && is_array($breakdown)) {
                        $p1Sum = 0.0;
                        foreach ($breakdown as $idx => $item) {
                            $isP1 = ($lombaType === 'guru_berprestasi') ? ($idx < 2) : ($idx < 3);
                            $name = strtolower($item['component'] ?? '');
                            if ($lombaType === 'guru_berprestasi' && (str_contains($name, 'aswaja') || str_contains($name, 'wawancara') || str_contains($name, 'interview'))) {
                                $isP1 = false;
                            } elseif ($lombaType === 'madrasah_berprestasi' && (str_contains($name, 'presentasi') || str_contains($name, 'visitasi') || str_contains($name, 'fact checking'))) {
                                $isP1 = false;
                            }
                            if ($isP1) {
                                $p1Sum += ((float) ($item['value'] ?? 0) * (float) ($item['weight'] ?? 0)) / 100.0;
                            }
                        }
                        return $p1Sum;
                    }
                    return (float) $s->score;
                });
                $phase1Score = round((float) $p1Scores->avg(), 2);
            }

            return [
                'registration' => $reg,
                'phase1_score' => $phase1Score,
                'jenjang'      => $reg->jenjang ?: 'Umum',
            ];
        });

        // Group by jenjang and take top 3 in each jenjang
        $grouped = $scoredRegistrations->groupBy('jenjang');
        $promotedFinalists = [];
        $demotedCount = 0;

        DB::transaction(function () use ($grouped, &$promotedFinalists, &$demotedCount) {
            foreach ($grouped as $jenjang => $items) {
                // Sort descending by Phase 1 score
                $sorted = $items->sortByDesc('phase1_score')->values();

                foreach ($sorted as $index => $item) {
                    $reg = $item['registration'];
                    if ($index < 3) { // Top 3
                        $reg->update(['status' => 'finalis']);
                        $promotedFinalists[] = [
                            'id'             => $reg->id,
                            'applicant_name' => $reg->applicant_name,
                            'school_name'    => $reg->school_name,
                            'jenjang'        => $reg->jenjang,
                            'phase1_score'   => $item['phase1_score'],
                            'rank_in_phase1' => $index + 1,
                        ];
                    } else {
                        // If previously finalis, revert to under_review
                        if ($reg->status === 'finalis') {
                            $reg->update(['status' => 'under_review']);
                            $demotedCount++;
                        }
                    }
                }
            }
        });

        \App\Models\Setting::setValue("phase1_locked_competition_{$competition->id}", 'true');
        \App\Services\CompetitionRankingService::autoRank($competition);

        $count = count($promotedFinalists);
        return $this->success([
            'total_finalists' => $count,
            'finalists'       => $promotedFinalists,
        ], "Berhasil menetapkan {$count} finalis 3 besar per jenjang untuk Fase 2.");
    }

    /**
     * POST /competitions/{competition}/reset-scores
     * Reset all jury scores and ranks for this competition.
     */
    public function resetScores(Competition $competition): JsonResponse
    {
        if (! in_array(Auth::user()?->role, ['super_admin', 'admin_yayasan', 'admin'], true)) {
            return $this->error('Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat mereset nilai lomba.', 403);
        }

        if ($competition->isScoresLocked() && ! in_array(Auth::user()?->role, ['super_admin'], true)) {
            return $this->error('Nilai cabang lomba ini telah dikunci/final. Tidak dapat direset.', null, 403);
        }

        \App\Models\Setting::setValue("phase1_locked_competition_{$competition->id}", 'false');

        $deletedCount = 0;
        DB::transaction(function () use ($competition, &$deletedCount) {
            // 1. Delete all jury scores for this competition
            $deletedCount = \App\Models\CompetitionJuryScore::where('competition_id', $competition->id)->delete();

            // 2. If anugerah, reset scores, ranks, and revert finalists back to submitted
            if (in_array($competition->lomba_type, ['guru_berprestasi', 'madrasah_berprestasi'], true)) {
                \App\Models\AnugerahRegistration::where('competition_id', $competition->id)->update([
                    'total_score'     => null,
                    'rank'            => null,
                    'reviewer_notes'  => null,
                    'score_breakdown' => null,
                    'status'          => 'submitted',
                ]);
            } else {
                // 3. For regular competitions, delete results
                \App\Models\CompetitionResult::where('competition_id', $competition->id)->delete();
            }
        });

        return $this->success([
            'competition_id'      => $competition->id,
            'name'                => $competition->name,
            'deleted_jury_scores' => $deletedCount,
        ], "Semua nilai juri dan peringkat untuk lomba '{$competition->name}' berhasil direset bersih.");
    }

    // ─────────────────────── SEED HARLAH 97 ──────────────────────────────────

    /**
     * POST /events/{event}/seed-harlah97
     * Buat semua cabang lomba Anugerah Pendidikan & Festival Aswaja
     * sesuai Juknis LP Ma'arif NU Cilacap Harlah ke-97 Tahun 2026.
     * Idempotent — lomba yang sudah ada (berdasarkan lomba_type) dilewati.
     */
    public function seedHarlah97(Event $event): JsonResponse
    {
        if (! in_array(Auth::user()?->role, ['super_admin', 'admin_yayasan', 'admin'])) {
            return $this->error('Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat melakukan seed lomba.', 403);
        }

        $VIDEO_DEADLINE = '2026-09-13 23:59:00';
        $REG_DEADLINE   = '2026-09-13 23:59:00';

        $template = [
            // ── Festival Aswaja Siswa ──────────────────────────────────────
            [
                'name'             => 'Mars Ma\'arif NU',
                'category'         => 'Keagamaan',
                'type'             => 'Beregu',
                'jenjang'          => 'MTs/SMP, MA/SMA/SMK',
                'lomba_type'       => 'mars_maarif',
                'deadline'         => $VIDEO_DEADLINE,
                'max_per_school'   => 1,
                'scoring_criteria' => [
                    ['component' => 'Teknik Vokal',             'weight' => 35],
                    ['component' => 'Harmonisasi & Keselarasan','weight' => 35],
                    ['component' => 'Penjiwaan & Ekspresi',     'weight' => 30],
                ],
            ],
            [
                'name'             => 'MTQ (Musabaqah Tilawatil Qur\'an)',
                'category'         => 'Keagamaan',
                'type'             => 'Individual',
                'jenjang'          => 'MI/SD, MTs/SMP, MA/SMA/SMK',
                'lomba_type'       => 'mtq',
                'deadline'         => $VIDEO_DEADLINE,
                'max_per_school'   => 2,
                'scoring_criteria' => [
                    ['component' => 'Tajwid',            'weight' => 45],
                    ['component' => 'Lagu & Irama',      'weight' => 35],
                    ['component' => 'Adab & Penampilan', 'weight' => 20],
                ],
            ],
            [
                'name'             => 'Puji-Pujian Jawa',
                'category'         => 'Keagamaan',
                'type'             => 'Beregu',
                'jenjang'          => 'MI/SD',
                'lomba_type'       => 'puji_pujian',
                'deadline'         => $VIDEO_DEADLINE,
                'max_per_school'   => 1,
                'scoring_criteria' => [
                    ['component' => 'Makhraj & Artikulasi Bahasa Jawa', 'weight' => 35],
                    ['component' => 'Penjiwaan & Penghayatan',          'weight' => 30],
                    ['component' => 'Harmonisasi Suara & Irama',        'weight' => 25],
                    ['component' => 'Adab & Penampilan',                'weight' => 10],
                ],
            ],
            [
                'name'             => 'Film Dokumenter NU',
                'category'         => 'Keagamaan',
                'type'             => 'Beregu',
                'jenjang'          => 'MTs/SMP, MA/SMA/SMK',
                'lomba_type'       => 'film_dokumenter',
                'deadline'         => $VIDEO_DEADLINE,
                'max_per_school'   => 1,
                'scoring_criteria' => [
                    ['component' => 'Kesesuaian Tema & Kedalaman Konten', 'weight' => 35],
                    ['component' => 'Alur Cerita & Struktur Narasi',      'weight' => 25],
                    ['component' => 'Sinematografi & Editing',            'weight' => 25],
                    ['component' => 'Kreativitas & Estetika',             'weight' => 15],
                ],
            ],
            // ── Anugerah Pendidikan ────────────────────────────────────────
            [
                'name'             => 'Anugerah Guru Berprestasi',
                'category'         => 'Akademik',
                'type'             => 'Individual',
                'jenjang'          => 'MI/SD, MTs/SMP, MA/SMA/SMK',
                'lomba_type'       => 'guru_berprestasi',
                'deadline'         => $REG_DEADLINE,
                'max_per_school'   => null,
                'scoring_criteria' => [
                    ['component' => 'Akumulasi Skor Kejuaraan / Prestasi',              'weight' => 40],
                    ['component' => 'Naskah Praktik Baik / Karya Inovasi Pembelajaran', 'weight' => 30],
                    ['component' => 'Pemahaman & Pengamalan Nilai Aswaja An-Nahdliyah', 'weight' => 15],
                    ['component' => 'Presentasi, Wawancara, & Deep Interview',          'weight' => 15],
                ],
            ],
            [
                'name'             => 'Anugerah Madrasah/Sekolah Berprestasi',
                'category'         => 'Akademik',
                'type'             => 'Individual',
                'jenjang'          => 'MI/SD, MTs/SMP, MA/SMA/SMK',
                'lomba_type'       => 'madrasah_berprestasi',
                'deadline'         => $REG_DEADLINE,
                'max_per_school'   => null,
                'scoring_criteria' => [
                    ['component' => 'Akumulasi Skor Kejuaraan Lembaga',                        'weight' => 45],
                    ['component' => 'Tata Kelola Institusi & Penguatan Karakter Aswaja',       'weight' => 25],
                    ['component' => 'Kemitraan, Keaktifan SIMNU & SIMMACI, Kontribusi Sosial', 'weight' => 15],
                    ['component' => 'Presentasi Kepala Madrasah & Visitasi / Fact Checking',   'weight' => 15],
                ],
            ],
            // ── OSKANU ────────────────────────────────────────────────────
            [
                'name'             => 'OSKANU Lolos Provinsi',
                'category'         => 'Akademik',
                'type'             => 'Individual',
                'jenjang'          => 'MI/SD, MTs/SMP, MA/SMA/SMK',
                'lomba_type'       => 'oskanu',
                'deadline'         => $REG_DEADLINE,
                'max_per_school'   => null,
                'scoring_criteria' => [],
            ],
        ];

        $created = [];
        $skipped = [];

        foreach ($template as $item) {
            // Idempotent: skip jika lomba_type sudah ada di event ini
            $exists = Competition::where('event_id', $event->id)
                ->where('lomba_type', $item['lomba_type'])
                ->exists();

            if ($exists) {
                // Pastikan cabang lomba yang sudah ada tetap OPEN dan batas waktu diperbarui
                Competition::where('event_id', $event->id)
                    ->where('lomba_type', $item['lomba_type'])
                    ->update([
                        'deadline' => $item['deadline'],
                        'status'   => 'OPEN',
                    ]);
                $skipped[] = $item['name'];
                continue;
            }

            $comp = Competition::create(array_merge($item, [
                'event_id' => $event->id,
                'status'   => 'OPEN',
            ]));

            $created[] = [
                'id'         => $comp->id,
                'name'       => $comp->name,
                'lomba_type' => $comp->lomba_type,
            ];
        }

        return $this->success(
            ['created' => $created, 'skipped' => $skipped],
            count($created) . ' cabang lomba berhasil dibuat' .
                (count($skipped) ? ', ' . count($skipped) . ' dilewati (sudah ada).' : '.')
        );
    }

    // ─────────────────────── JURY PIN ─────────────────────────────────────────

    /**
     * GET  /competitions/{competition}/jury-pin
     * POST /competitions/{competition}/jury-pin  { pin }
     */
    public function getJuryPin(Request $request, Competition $competition): JsonResponse
    {
        $user = $request->user() ?? Auth::user();
        if (! in_array($user?->role, ['super_admin', 'admin_yayasan', 'admin'], true)) {
            return $this->error('Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat melihat PIN Juri.', 403);
        }

        $value = \App\Models\Setting::getValue("jury_pin_event_{$competition->event_id}");

        \App\Models\ActivityLog::log(
            description: "Melihat PIN Juri untuk event ID: {$competition->event_id}",
            event: 'view_jury_pin',
            logName: 'competition',
            causer: $user
        );

        return $this->success(['pin' => $value, 'competition_id' => $competition->id]);
    }

    public function setJuryPin(Request $request, Competition $competition): JsonResponse
    {
        if (! in_array(Auth::user()?->role, ['super_admin', 'admin_yayasan', 'admin'])) {
            return $this->error('Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat mengatur PIN Juri.', 403);
        }

        $data = $request->validate([
            'pin' => 'required|string|min:4|max:50',
        ]);

        \App\Models\Setting::setValue("jury_pin_event_{$competition->event_id}", $data['pin']);

        return $this->success(
            ['pin' => $data['pin'], 'competition_id' => $competition->id],
            'PIN Juri berhasil disimpan dan berlaku untuk semua cabang lomba pada event ini.'
        );
    }

    public function lockScores(Request $request, Competition $competition): JsonResponse
    {
        if (! in_array(Auth::user()?->role, ['super_admin', 'admin_yayasan', 'admin'], true)) {
            return $this->error('Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat mengunci nilai lomba.', null, 403);
        }

        $competition->lockScores();

        return $this->success([
            'competition_id' => $competition->id,
            'name'           => $competition->name,
            'is_locked'      => true,
            'status'         => $competition->status,
        ], "Nilai cabang lomba '{$competition->name}' berhasil dikunci/final.");
    }

    public function unlockScores(Request $request, Competition $competition): JsonResponse
    {
        if (! in_array(Auth::user()?->role, ['super_admin', 'admin_yayasan'], true)) {
            return $this->error('Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat membuka kunci nilai lomba.', null, 403);
        }

        $competition->unlockScores();

        return $this->success([
            'competition_id' => $competition->id,
            'name'           => $competition->name,
            'is_locked'      => false,
            'status'         => $competition->status,
        ], "Kunci nilai cabang lomba '{$competition->name}' berhasil dibuka.");
    }

    public function lockAllScores(Request $request): JsonResponse
    {
        if (! in_array(Auth::user()?->role, ['super_admin', 'admin_yayasan'], true)) {
            return $this->error('Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat mengunci semua nilai lomba.', null, 403);
        }

        Competition::lockAllScores();

        return $this->success(null, 'Semua nilai cabang lomba berhasil dikunci secara global.');
    }

    public function unlockAllScores(Request $request): JsonResponse
    {
        if (! in_array(Auth::user()?->role, ['super_admin', 'admin_yayasan'], true)) {
            return $this->error('Akses ditolak: Hanya Super Admin / Admin Yayasan yang dapat membuka kunci semua nilai lomba.', null, 403);
        }

        Competition::unlockAllScores();

        return $this->success(null, 'Kunci semua nilai cabang lomba berhasil dibuka secara global.');
    }
}
