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

        // For anugerah types, also load registrations
        $anugerahRegistrations = [];
        if (in_array($competition->lomba_type, ['guru_berprestasi', 'madrasah_berprestasi'])) {
            $anugerahRegistrations = \App\Models\AnugerahRegistration::where('competition_id', $competition->id)
                ->orderBy('school_name')->orderBy('applicant_name')
                ->get(['id', 'applicant_name', 'school_name', 'jenjang', 'kecamatan', 'status', 'total_score', 'rank', 'category', 'submitted_at'])
                ->toArray();
        }

        $data = $competition->toArray();
        $data['anugerah_registrations'] = $anugerahRegistrations;

        return $this->success($data);
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

            $reg->update([
                'rank'           => $data['rank'] ?? null,
                'total_score'    => $data['score'] ?? null,
                'reviewer_notes' => $data['notes'] ?? null,
            ]);

            return $this->success([
                'id'             => 'reg_' . $reg->id,
                'participant_id' => 'reg_' . $reg->id,
                'name'           => $reg->applicant_name,
                'rank'           => $reg->rank,
                'score'          => $reg->total_score,
                'notes'          => $reg->reviewer_notes,
            ], 'Nilai berhasil disimpan');
        }

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
            'results.*.participant_id'  => 'required', // Can be integer or string (reg_X)
            'results.*.rank'            => 'nullable|integer|min:1',
            'results.*.score'           => 'nullable|numeric|min:0',
            'results.*.notes'           => 'nullable|string',
        ]);

        DB::transaction(function () use ($request, $competition) {
            foreach ($request->results as $item) {
                $pId = $item['participant_id'];
                if (is_string($pId) && str_starts_with($pId, 'reg_')) {
                    $regId = (int) substr($pId, 4);
                    \App\Models\AnugerahRegistration::where('id', $regId)
                        ->where('competition_id', $competition->id)
                        ->update([
                            'rank'        => $item['rank'] ?? null,
                            'total_score' => $item['score'] ?? null,
                            'reviewer_notes' => $item['notes'] ?? null,
                        ]);
                } else {
                    CompetitionResult::updateOrCreate(
                        [
                            'competition_id' => $competition->id,
                            'participant_id' => (int) $pId,
                        ],
                        [
                            'rank'  => $item['rank'] ?? null,
                            'score' => $item['score'] ?? null,
                            'notes' => $item['notes'] ?? null,
                        ]
                    );
                }
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

    // ─────────────────────── SEED HARLAH 97 ──────────────────────────────────

    /**
     * POST /events/{event}/seed-harlah97
     * Buat semua cabang lomba Anugerah Pendidikan & Festival Aswaja
     * sesuai Juknis LP Ma'arif NU Cilacap Harlah ke-97 Tahun 2026.
     * Idempotent — lomba yang sudah ada (berdasarkan lomba_type) dilewati.
     */
    public function seedHarlah97(Event $event): JsonResponse
    {
        $VIDEO_DEADLINE = '2026-09-11 23:59:00';
        $REG_DEADLINE   = '2026-09-07 23:59:00';

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
