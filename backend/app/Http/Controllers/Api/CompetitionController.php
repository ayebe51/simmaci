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
use Illuminate\Support\Facades\DB;

class CompetitionController extends Controller
{
    use ApiResponse;

    // ── List competitions for an event ─────────────────────────────────────────
    public function index(Event $event): JsonResponse
    {
        $competitions = $event->competitions()
            ->withCount('participants')
            ->withCount('results')
            ->orderBy('name')
            ->get();

        return $this->success($competitions);
    }

    // ── Create competition ─────────────────────────────────────────────────────
    public function store(Request $request, Event $event): JsonResponse
    {
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
            $competition->loadCount(['participants', 'results']),
            'Cabang lomba berhasil dibuat',
            201
        );
    }

    // ── Show competition detail ────────────────────────────────────────────────
    public function show(Competition $competition): JsonResponse
    {
        $competition->load([
            'event',
            'participants' => fn ($q) => $q->with('result')->orderBy('institution')->orderBy('name'),
            'results.participant',
        ]);

        return $this->success($competition);
    }

    // ── Update competition ─────────────────────────────────────────────────────
    public function update(Request $request, Competition $competition): JsonResponse
    {
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
        return $this->success($competition->loadCount(['participants', 'results']));
    }

    // ── Delete competition ─────────────────────────────────────────────────────
    public function destroy(Competition $competition): JsonResponse
    {
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
            'name'                => 'required|string|max:255',
            'institution'         => 'required|string|max:255',
            'school_id'           => 'nullable|integer|exists:schools,id',
            'teacher_id'          => 'nullable|integer|exists:teachers,id',
            'group_name'          => 'nullable|string|max:255',
            'member_count'        => 'nullable|integer|min:1',
            'gender_category'     => 'nullable|string|in:pa,pi,campuran',
            'contact_person'      => 'nullable|string|max:100',
            'contact_phone'       => 'nullable|string|max:30',
            'video_url'           => 'nullable|url|max:500',
            'video_filename'      => 'nullable|string|max:255',
            'registration_status' => 'nullable|string|in:pending,verified,rejected',
        ]);

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

        $participant->update($data);
        return $this->success($participant->load('result'));
    }

    public function participantsDestroy(CompetitionParticipant $participant): JsonResponse
    {
        $participant->delete();
        return $this->success(null, 'Peserta berhasil dihapus');
    }

    // ─────────────────────────── RESULTS ──────────────────────────────────────

    public function resultsStore(Request $request, Competition $competition): JsonResponse
    {
        $data = $request->validate([
            'participant_id'  => 'required|integer|exists:competition_participants,id',
            'rank'            => 'nullable|integer|min:1',
            'score'           => 'nullable|numeric|min:0',
            'notes'           => 'nullable|string',
            'score_breakdown' => 'nullable|array',
        ]);

        $result = CompetitionResult::updateOrCreate(
            [
                'competition_id' => $competition->id,
                'participant_id' => $data['participant_id'],
            ],
            [
                'rank'            => $data['rank'] ?? null,
                'score'           => $data['score'] ?? null,
                'notes'           => $data['notes'] ?? null,
                'score_breakdown' => $data['score_breakdown'] ?? null,
            ]
        );

        return $this->success($result->load('participant'), 'Nilai berhasil disimpan');
    }

    public function resultsBulkStore(Request $request, Competition $competition): JsonResponse
    {
        $request->validate([
            'results'                   => 'required|array',
            'results.*.participant_id'  => 'required|integer|exists:competition_participants,id',
            'results.*.rank'            => 'nullable|integer|min:1',
            'results.*.score'           => 'nullable|numeric|min:0',
            'results.*.notes'           => 'nullable|string',
        ]);

        DB::transaction(function () use ($request, $competition) {
            foreach ($request->results as $item) {
                CompetitionResult::updateOrCreate(
                    [
                        'competition_id' => $competition->id,
                        'participant_id' => $item['participant_id'],
                    ],
                    [
                        'rank'  => $item['rank'] ?? null,
                        'score' => $item['score'] ?? null,
                        'notes' => $item['notes'] ?? null,
                    ]
                );
            }
        });

        return $this->success(null, 'Semua nilai berhasil disimpan');
    }

    public function resultsImport(Request $request, Competition $competition): JsonResponse
    {
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

            return $this->success(['imported' => $saved], "{$saved} hasil berhasil diimport");
        } catch (\Throwable $e) {
            return $this->error('Gagal mengimport file: ' . $e->getMessage(), 422);
        }
    }

    // ─────────────────────── JURY PIN ─────────────────────────────────────────

    /**
     * GET  /competitions/{competition}/jury-pin
     * POST /competitions/{competition}/jury-pin  { pin }
     */
    public function getJuryPin(Competition $competition): JsonResponse
    {
        $value = \App\Models\Setting::getValue("jury_pin_{$competition->id}");
        return $this->success(['pin' => $value, 'competition_id' => $competition->id]);
    }

    public function setJuryPin(Request $request, Competition $competition): JsonResponse
    {
        $data = $request->validate([
            'pin' => 'required|string|min:4|max:50',
        ]);

        \App\Models\Setting::setValue("jury_pin_{$competition->id}", $data['pin']);

        return $this->success(
            ['pin' => $data['pin'], 'competition_id' => $competition->id],
            'PIN Juri berhasil disimpan'
        );
    }
}
