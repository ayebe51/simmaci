<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\NotifyAdminsOfSkSubmission;
use App\Models\ActivityLog;
use App\Models\ApprovalHistory;
use App\Models\Notification;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\User;
use App\Services\DashboardCacheService;
use App\Services\NormalizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SkDocumentController extends Controller
{
    public function __construct(
        private NormalizationService $normalizationService,
        private DashboardCacheService $dashboardCacheService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = SkDocument::select([
                'id', 'nomor_sk', 'nama', 'jenis_sk', 'status',
                'unit_kerja', 'created_at', 'school_id', 'teacher_id',
                'nomor_permohonan', 'tanggal_permohonan', 'surat_permohonan_url', 'file_url',
            ])
            ->with(['teacher' => function ($q) {
                $q->withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
                  ->select(['id', 'nomor_induk_maarif', 'tmt', 'tempat_lahir', 'tanggal_lahir', 'pendidikan_terakhir']);
            }]);

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('nama', 'ilike', "%{$request->search}%")
                  ->orWhere('unit_kerja', 'ilike', "%{$request->search}%")
                  ->orWhere('nomor_sk', 'ilike', "%{$request->search}%");
            });
        }
        if ($request->status && $request->status !== 'all') {
            // For the SK Generator, we source from 'pending' requests
            if ($request->status === 'unverified') {
                $query->whereIn('status', ['pending', 'draft']);
            } else {
                $query->byStatus($request->status);
            }
        }
        if ($request->jenis_sk && $request->jenis_sk !== 'all') {
            $query->byJenis($request->jenis_sk);
        }

        if ($request->boolean('unprinted_only')) {
            $query->where(function($q) {
                $q->whereNull('file_url')
                  ->orWhere('file_url', '')
                  ->orWhere('nomor_sk', 'like', 'REQ/%')
                  ->orWhere('nomor_sk', 'like', 'DRAFT-%');
            });
        }

        if ($request->boolean('exclude_req_nomor')) {
            $query->where('nomor_sk', 'not like', 'REQ/%')
                  ->where('nomor_sk', 'not like', 'DRAFT-%');
        }

        // --- Tenant Isolation ---
        $user = $request->user();
        if ($user->role === 'operator' && $user->school_id) {
            $query->where('school_id', $user->school_id);
        } elseif ($request->school_id) {
            $query->where('school_id', $request->school_id);
        }

        $sortBy = in_array($request->sort_by, ['id', 'created_at', 'updated_at', 'nomor_sk']) ? $request->sort_by : 'created_at';
        $sortDir = strtolower($request->sort_dir ?? 'desc'); // Ubah default jadi desc agar yang terbaru tampil di atas
        
        $paginated = $query
            ->orderByRaw("CASE WHEN nomor_sk LIKE 'REQ/%' OR nomor_sk LIKE 'DRAFT-%' THEN 1 ELSE 0 END ASC")
            ->orderBy($sortBy, $sortDir)
            ->orderBy('id', $sortDir)
            ->paginate($request->integer('per_page', 25));

        // Enrich NIM and TMT: for items whose teacher has no nomor_induk_maarif or tmt,
        // resolve matching teachers using SQL-level case-insensitive comparison
        // scoped to the same school_id (avoids loading all teachers into PHP memory).
        $items = collect($paginated->items());
        $missingDataItems = $items->filter(fn($sk) =>
            (empty($sk->teacher?->nomor_induk_maarif) || empty($sk->teacher?->tmt)) && !empty($sk->nama)
        );

        if ($missingDataItems->isNotEmpty()) {
            $missingDataIds = $missingDataItems->pluck('id')->values()->toArray();

            // SQL-level enrichment: JOIN teachers on normalized name + same school_id
            $enrichedRows = DB::table('sk_documents as sd')
                ->join('teachers as t', function ($join) {
                    $join->on(DB::raw('LOWER(TRIM(t.nama))'), '=', DB::raw('LOWER(TRIM(sd.nama))'))
                        ->on('t.school_id', '=', 'sd.school_id')
                        ->whereNull('t.deleted_at');
                })
                ->whereIn('sd.id', $missingDataIds)
                ->select('sd.id', 't.nomor_induk_maarif', 't.tmt', 't.tempat_lahir', 't.tanggal_lahir', 't.pendidikan_terakhir')
                ->get()
                ->keyBy('id');

            foreach ($missingDataItems as $sk) {
                if (isset($enrichedRows[$sk->id])) {
                    $row = $enrichedRows[$sk->id];
                    if ($sk->teacher) {
                        if (empty($sk->teacher->nomor_induk_maarif) && !empty($row->nomor_induk_maarif)) {
                            $sk->teacher->nomor_induk_maarif = $row->nomor_induk_maarif;
                        }
                        if (empty($sk->teacher->tmt) && !empty($row->tmt)) {
                            $sk->teacher->tmt = $row->tmt;
                        }
                        if (empty($sk->teacher->tempat_lahir) && !empty($row->tempat_lahir)) {
                            $sk->teacher->tempat_lahir = $row->tempat_lahir;
                        }
                        if (empty($sk->teacher->tanggal_lahir) && !empty($row->tanggal_lahir)) {
                            $sk->teacher->tanggal_lahir = $row->tanggal_lahir;
                        }
                        if (empty($sk->teacher->pendidikan_terakhir) && !empty($row->pendidikan_terakhir)) {
                            $sk->teacher->pendidikan_terakhir = $row->pendidikan_terakhir;
                        }
                    } else {
                        $sk->setRelation('teacher', new Teacher([
                            'nomor_induk_maarif' => $row->nomor_induk_maarif,
                            'tmt' => $row->tmt,
                            'tempat_lahir' => $row->tempat_lahir,
                            'tanggal_lahir' => $row->tanggal_lahir,
                            'pendidikan_terakhir' => $row->pendidikan_terakhir,
                        ]));
                    }
                }
            }
        }

        // Hide internal fields from response - school_id and teacher_id are used
        // for joins/scoping but should not be exposed in the list response.
        // Teacher relation should only expose nomor_induk_maarif.
        // Also compute is_guru_baru: TMT < 1 tahun AND belum punya NIM AND pengajuan manual
        $oneYearAgo = now()->subYear()->toDateString();

        foreach ($paginated as $sk) {
            $sk->makeHidden(['school_id']);
            $tmt = $sk->teacher?->tmt;
            $nim = $sk->teacher?->nomor_induk_maarif;
            $isManual = empty($sk->surat_permohonan_url);
            
            $isGuruBaru = !empty($tmt) && $tmt > $oneYearAgo && empty($nim) && $isManual;
            $sk->setAttribute('is_guru_baru', $isGuruBaru);
        }

        return response()->json($paginated);
    }

    public function show(SkDocument $skDocument): JsonResponse
    {
        return response()->json($skDocument->load('teacher', 'school'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nomor_sk' => 'required|string',
            'jenis_sk' => 'required|string',
            'teacher_id' => 'nullable|exists:teachers,id',
            'nama' => 'required|string',
            'jabatan' => 'nullable|string',
            'unit_kerja' => 'nullable|string',
            'tanggal_penetapan' => 'required|string',
            'status' => 'nullable|string',
            'file_url' => 'nullable|string',
            'surat_permohonan_url' => 'nullable|string',
            'qr_code' => 'nullable|string',
        ]);

        // Auto-resolve school_id
        if (isset($data['unit_kerja'])) {
            $school = School::where('nama', $data['unit_kerja'])->first();
            $data['school_id'] = $school?->id;
        }

        $data['created_by'] = $request->user()->email;
        $data['status'] = $data['status'] ?? 'draft';

        // Upsert: update if nomor_sk exists
        $existing = SkDocument::where('nomor_sk', $data['nomor_sk'])->first();
        if ($existing) {
            $existing->update($data);
            return response()->json($existing->fresh());
        }

        $sk = SkDocument::create($data);

        ActivityLog::log(
            description: ($data['unit_kerja'] ?? 'Unknown School') . " - Pengajuan SK Baru: {$data['nomor_sk']}",
            event: 'submit_sk',
            logName: 'sk',
            subject: $sk,
            causer: $request->user(),
            schoolId: $sk->school_id
        );

        // Create approval history for initial submission
        ApprovalHistory::create([
            'school_id'         => $sk->school_id,
            'document_id'       => $sk->id,
            'document_type'     => 'sk_document',
            'action'            => 'submit',
            'from_status'       => null,
            'to_status'         => $data['status'] ?? 'draft',
            'performed_by'      => $request->user()->id,
            'performed_at'      => now(),
            'comment'           => null,
            'metadata'          => [
                'performed_by_name' => $request->user()->name,
                'performed_by_role' => $request->user()->role,
            ],
        ]);

        return response()->json($sk, 201);
    }

    public function update(Request $request, SkDocument $skDocument): JsonResponse
    {
        try {
            $request->validate([
                'ijazah_url' => 'nullable|string|max:500',
            ]);

            // Operators are not allowed to approve or reject SK documents
            $newStatus = $request->input('status');
            if (
                $newStatus !== null
                && in_array($newStatus, ['approved', 'rejected'])
                && $request->user()->role === 'operator'
            ) {
                return response()->json([
                    'message' => 'Anda tidak memiliki izin untuk menyetujui atau menolak pengajuan SK.',
                ], 403);
            }

            $oldStatus = $skDocument->status;

            $skDocument->update($request->only([
                'nomor_sk', 'jenis_sk', 'teacher_id', 'nama', 'jabatan',
                'unit_kerja', 'tanggal_penetapan', 'status', 'file_url', 'qr_code',
                'revision_status', 'revision_reason', 'revision_data',
                'ijazah_url', 'tahun_ajaran',
            ]));

            ActivityLog::log(
                description: "SK {$skDocument->nomor_sk} diperbarui" .
                    ($oldStatus !== $skDocument->status ? " (status: {$oldStatus} → {$skDocument->status})" : ''),
                event: 'update_sk',
                logName: 'sk',
                subject: $skDocument,
                causer: $request->user(),
                schoolId: $skDocument->school_id
            );

            // Send notification to operator when status changes to approved or rejected
            $newStatus = $skDocument->status;
            if ($oldStatus !== $newStatus && in_array($newStatus, ['approved', 'rejected'])) {
                $targetUser = $this->findSkOperator($skDocument);
                if ($targetUser) {
                    $isApproved = $newStatus === 'approved';
                    $rejectionReason = $request->input('rejection_reason') ?? $skDocument->rejection_reason;
                    Notification::create([
                        'user_id'   => $targetUser->id,
                        'school_id' => $skDocument->school_id,
                        'type'      => $isApproved ? 'sk_approved' : 'sk_rejected',
                        'title'     => $isApproved ? '✅ SK Disetujui' : '❌ SK Ditolak',
                        'message'   => "SK No. {$skDocument->nomor_sk} untuk {$skDocument->nama} telah " .
                            ($isApproved ? 'disetujui dan siap diterbitkan.' : 'ditolak.' .
                            ($rejectionReason ? " Alasan: {$rejectionReason}" : '')),
                        'is_read'   => false,
                        'metadata'  => [
                            'sk_id'            => $skDocument->id,
                            'nomor_sk'         => $skDocument->nomor_sk,
                            'rejection_reason' => $rejectionReason,
                        ],
                    ]);
                }

                if ($newStatus === 'rejected') {
                    $rejectionReason = $request->input('rejection_reason') ?? $skDocument->rejection_reason;
                    \App\Jobs\NotifyHeadmasterOfSkRejection::dispatch(
                        $skDocument->id,
                        $skDocument->nomor_sk,
                        $skDocument->nama,
                        $skDocument->jenis_sk,
                        $rejectionReason,
                        $skDocument->school_id
                    );
                }
            }

            // Create approval history record when status changes to approved or rejected
            if ($oldStatus !== $newStatus && in_array($newStatus, ['approved', 'rejected'])) {
                $rejectionReason = $request->input('rejection_reason') ?? $skDocument->rejection_reason;
                ApprovalHistory::create([
                    'school_id'         => $skDocument->school_id,
                    'document_id'       => $skDocument->id,
                    'document_type'     => 'sk_document',
                    'action'            => $newStatus === 'approved' ? 'approve' : 'reject',
                    'from_status'       => $oldStatus,
                    'to_status'         => $newStatus,
                    'performed_by'      => $request->user()->id,
                    'performed_at'      => now(),
                    'comment'           => $rejectionReason,
                    'metadata'          => [
                        'performed_by_name' => $request->user()->name,
                        'performed_by_role' => $request->user()->role,
                        'rejection_reason'  => $rejectionReason,
                    ],
                ]);
            }

            // Invalidate dashboard cache when SK status changes
            if ($oldStatus !== $skDocument->status && $skDocument->school_id) {
                $this->dashboardCacheService->invalidateForSchool($skDocument->school_id);
            }

            return response()->json($skDocument->fresh());
        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->getCode() == '23505') { // Postgres Unique violation
                return response()->json([
                    'message' => 'Gagal memperbarui SK. Nomor SK sudah digunakan oleh dokumen lain.',
                    'error' => $e->getMessage()
                ], 400);
            }
            throw $e;
        }
    }

    public function destroy(Request $request, SkDocument $skDocument): JsonResponse
    {
        $skDocument->update(['status' => 'archived', 'archived_at' => now()]);

        ActivityLog::log(
            description: "SK {$skDocument->nomor_sk} ({$skDocument->nama}) diarsipkan",
            event: 'archive_sk',
            logName: 'sk',
            subject: $skDocument,
            causer: $request->user(),
            schoolId: $skDocument->school_id
        );

        return response()->json(['success' => true]);
    }

    /**
     * POST /api/sk-documents/bulk — Batch create
     */
    public function bulkCreate(Request $request): JsonResponse
    {
        $request->validate([
            'documents' => 'required|array',
            'documents.*.nomor_sk' => 'required|string',
            'documents.*.nama' => 'required|string',
            'documents.*.jenis_sk' => 'required|string',
            'documents.*.tanggal_penetapan' => 'required|string',
        ]);

        $created = 0;
        $errors = [];
        $schoolCache = [];

        foreach ($request->documents as $doc) {
            try {
                $schoolId = null;
                if (isset($doc['unit_kerja'])) {
                    $schoolId = $schoolCache[$doc['unit_kerja']]
                        ?? ($schoolCache[$doc['unit_kerja']] = School::where('nama', $doc['unit_kerja'])->value('id'));
                }

                $existing = SkDocument::where('nomor_sk', $doc['nomor_sk'])->first();
                if (! $existing) {
                    SkDocument::create(array_merge($doc, [
                        'school_id' => $schoolId,
                        'status' => $doc['status'] ?? 'active',
                        'created_by' => $request->user()->email,
                    ]));
                    $created++;
                }
            } catch (\Throwable $e) {
                $errors[] = ['nomor' => $doc['nomor_sk'], 'error' => $e->getMessage()];
            }
        }

        ActivityLog::log(
            description: "Bulk import SK: {$created} dokumen dibuat" . (count($errors) ? ', ' . count($errors) . ' gagal' : ''),
            event: 'bulk_create_sk',
            logName: 'sk',
            causer: $request->user()
        );

        return response()->json(['count' => $created, 'errors' => $errors]);
    }

    /**
     * PATCH /api/sk-documents/batch-status — Batch approve / reject
     */
    public function batchUpdateStatus(Request $request): JsonResponse
    {
        // Only super_admin and admin_yayasan can approve or reject SK documents
        if (! in_array($request->user()->role, ['super_admin', 'admin_yayasan'])) {
            return response()->json([
                'message' => 'Anda tidak memiliki izin untuk menyetujui atau menolak pengajuan SK.',
            ], 403);
        }

        $request->validate([
            'ids' => 'required|array|max:50',
            'ids.*' => 'integer',
            'status' => 'required|string|in:approved,rejected',
            'rejection_reason' => 'nullable|string',
        ]);

        $user = $request->user();
        $ids = $request->ids;
        $newStatus = $request->status;
        $rejectionReason = $request->rejection_reason;
        $isApproved = $newStatus === 'approved';

        // Eager-load all documents with teacher in a single query
        $documents = SkDocument::with('teacher')
            ->whereIn('id', $ids)
            ->get();

        $succeeded = [];
        $failed = [];
        $notificationRecords = [];
        $historyRecords = [];
        $now = now();

        // Track IDs not found in the database as failures
        $foundIds = $documents->pluck('id')->all();
        $notFoundIds = array_diff($ids, $foundIds);
        foreach ($notFoundIds as $missingId) {
            $failed[] = ['id' => (int) $missingId, 'reason' => 'Dokumen SK tidak ditemukan'];
        }

        DB::transaction(function () use (
            $documents, $user, $newStatus, $rejectionReason, $isApproved,
            &$succeeded, &$failed, &$notificationRecords, &$historyRecords, $now
        ) {
            foreach ($documents as $sk) {
                try {
                    $oldStatus = $sk->status;

                    // Update SK status
                    $sk->update([
                        'status' => $newStatus,
                        'rejection_reason' => $rejectionReason,
                    ]);

                    // If it's a revision approval, apply the suggested data
                    if ($isApproved && $sk->revision_status === 'revision_pending' && $sk->revision_data) {
                        $revData = $sk->revision_data;

                        // Update SK Document with revision data
                        $sk->update([
                            'nama' => $revData['nama'] ?? $sk->nama,
                            'unit_kerja' => $revData['unit_kerja'] ?? $sk->unit_kerja,
                            'revision_status' => 'approved',
                        ]);

                        // Update related Teacher
                        if ($sk->teacher_id && $sk->teacher) {
                            $sk->teacher->update([
                                'nama' => $revData['nama'] ?? $sk->teacher->nama,
                                'nip' => $revData['nip'] ?? $sk->teacher->nip,
                                'tempat_lahir' => $revData['tempat_lahir'] ?? $sk->teacher->tempat_lahir,
                                'tanggal_lahir' => $revData['tanggal_lahir'] ?? $sk->teacher->tanggal_lahir,
                                'pendidikan_terakhir' => $revData['pendidikan_terakhir'] ?? $sk->teacher->pendidikan_terakhir,
                                'tmt' => $revData['tmt'] ?? $sk->teacher->tmt,
                            ]);
                        }
                    } elseif (!$isApproved && $sk->revision_status === 'revision_pending') {
                        $sk->update(['revision_status' => 'rejected']);
                    }

                    // Verify teacher when SK approved/rejected
                    if ($isApproved && $sk->teacher_id && $sk->teacher) {
                        $sk->teacher->update(['is_verified' => true]);
                    } elseif (!$isApproved && $sk->teacher_id && $sk->teacher) {
                        $sk->teacher->update(['is_verified' => false]);
                    }

                    // Collect notification record for bulk insert
                    $targetUser = $this->findSkOperator($sk);
                    if ($targetUser) {
                        $notificationRecords[] = [
                            'user_id'    => $targetUser->id,
                            'school_id'  => $sk->school_id,
                            'type'       => $isApproved ? 'sk_approved' : 'sk_rejected',
                            'title'      => $isApproved ? '✅ SK Disetujui' : '❌ SK Ditolak',
                            'message'    => "SK No. {$sk->nomor_sk} untuk {$sk->nama} telah " .
                                ($isApproved ? 'disetujui dan siap diterbitkan.' : 'ditolak.' .
                                ($rejectionReason ? " Alasan: {$rejectionReason}" : '')),
                            'is_read'    => false,
                            'metadata'   => json_encode([
                                'sk_id'            => $sk->id,
                                'nomor_sk'         => $sk->nomor_sk,
                                'rejection_reason' => $rejectionReason,
                            ]),
                            'created_at' => $now,
                            'updated_at' => $now,
                        ];
                    }

                    // Collect approval history record for bulk insert
                    $historyRecords[] = [
                        'school_id'     => $sk->school_id,
                        'document_id'   => $sk->id,
                        'document_type' => 'sk_document',
                        'action'        => $isApproved ? 'approve' : 'reject',
                        'from_status'   => $oldStatus,
                        'to_status'     => $newStatus,
                        'performed_by'  => $user->id,
                        'performed_at'  => $now,
                        'comment'       => $rejectionReason,
                        'metadata'      => json_encode([
                            'performed_by_name' => $user->name,
                            'performed_by_role' => $user->role,
                            'rejection_reason'  => $rejectionReason,
                        ]),
                        'created_at'    => $now,
                        'updated_at'    => $now,
                    ];

                    if (!$isApproved && $oldStatus !== $newStatus) {
                        \App\Jobs\NotifyHeadmasterOfSkRejection::dispatch(
                            $sk->id,
                            $sk->nomor_sk,
                            $sk->nama,
                            $sk->jenis_sk,
                            $rejectionReason,
                            $sk->school_id
                        );
                    }

                    $succeeded[] = $sk->id;
                } catch (\Throwable $e) {
                    $failed[] = ['id' => $sk->id, 'reason' => $e->getMessage()];
                }
            }

            // Bulk insert notifications
            if (!empty($notificationRecords)) {
                Notification::insert($notificationRecords);
            }

            // Bulk insert approval histories
            if (!empty($historyRecords)) {
                ApprovalHistory::insert($historyRecords);
            }
        });

        // Invalidate dashboard cache for affected schools
        $affectedSchoolIds = $documents->pluck('school_id')->unique()->filter();
        foreach ($affectedSchoolIds as $schoolId) {
            $this->dashboardCacheService->invalidateForSchool($schoolId);
        }

        // Log activity
        ActivityLog::log(
            description: "Batch {$newStatus}: " . count($succeeded) . ' SK dokumen' .
                (count($failed) > 0 ? ', ' . count($failed) . ' gagal' : ''),
            event: 'batch_' . $newStatus . '_sk',
            logName: 'sk',
            causer: $user,
            schoolId: $user->school_id
        );

        return response()->json([
            'count' => count($succeeded),
            'failed' => $failed,
        ]);
    }

    /**
     * GET /api/sk-documents/revisions
     */
    public function revisions(Request $request): JsonResponse
    {
        $query = SkDocument::withRevisions()->with('teacher');

        $revisions = $query->orderByDesc('created_at')->take(100)->get();

        return response()->json($revisions);
    }

    /**
     * POST /api/sk-documents/submit-request
     * Submit single SK request (individual)
*/
    public function submitRequest(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'nama' => 'required|string',
                'nuptk' => 'nullable|string',
                'nip' => 'nullable|string',
                'jenis_sk' => 'required|string',
                'jenis_pengajuan' => 'nullable|string|in:new,renew,bulk',
                'unit_kerja' => 'required|string',
                'jabatan' => 'nullable|string',
                'surat_permohonan_url' => 'required|string',
                'nomor_surat_permohonan' => 'nullable|string',
                'tanggal_surat_permohonan' => 'nullable|string',
                'tanggal_penetapan' => 'nullable|string',
                'status_kepegawaian' => 'nullable|string',
                // Personal data fields — saved to Teacher record for use in SK generation
                'tempat_lahir' => 'nullable|string',
                'tanggal_lahir' => 'nullable|string',
                'pendidikan_terakhir' => 'nullable|string',
                'tmt' => 'nullable|string',
                'nomor_induk_maarif' => 'nullable|string|max:20',
            ]);

            // Normalize school name and teacher name before processing
            $originalUnitKerja = $data['unit_kerja'];
            $originalNama = $data['nama'];
            
            $data['unit_kerja'] = $this->normalizationService->normalizeSchoolName($data['unit_kerja']);
            $data['nama'] = $this->normalizationService->normalizeTeacherName($data['nama']);

            // Enrich name with degrees from Teacher record if the submitted name lacks them.
            // e.g. "MAILID" → "MAILID, S.Pd." when the Teacher DB has the full name.
            $schoolIdForEnrich = $request->user()->role === 'operator' ? $request->user()->school_id : null;
            $data['nama'] = $this->normalizationService->enrichNameFromTeacher($data['nama'], $schoolIdForEnrich);

            // Track normalization changes for activity logging
            $normalizationChanges = [];
            if ($originalUnitKerja !== $data['unit_kerja']) {
                $normalizationChanges['unit_kerja'] = [
                    'original' => $originalUnitKerja,
                    'normalized' => $data['unit_kerja']
                ];
            }
            if ($originalNama !== $data['nama']) {
                $normalizationChanges['nama'] = [
                    'original' => $originalNama,
                    'normalized' => $data['nama']
                ];
            }

            // 3.1: Add school_id validation for operators
            if ($request->user()->role === 'operator' && $request->user()->school_id === null) {
                return response()->json([
                    'message' => 'Akun operator belum terhubung ke sekolah. Hubungi administrator.',
                ], 400);
            }

            // Case-insensitive school lookup with normalized name
            $school = School::whereRaw('LOWER(nama) = LOWER(?)', [$data['unit_kerja']])->first();
            
            // Block SK submission for non-RA schools (MI, MTs, MA, dll)
            $detectedJenjang = $this->detectJenjang($school, $data['unit_kerja']);
            if (in_array($detectedJenjang, ['MI', 'SD', 'MTS', 'SMP', 'MA', 'SMA', 'SMK'])) {
                // Pengecualian untuk MI Ma'arif 01 Sidaurip
                if (stripos($data['unit_kerja'], 'sidaurip') === false) {
                    return response()->json([
                        'message' => "Pengajuan SK untuk jenjang {$detectedJenjang} saat ini sudah ditutup. Pengajuan hanya dibuka untuk jenjang RA.",
                    ], 422);
                }
            }

            // PNS auto-rejection: SK for PNS is issued by the government, not LP Ma'arif NU
            if ($this->isPns($data)) {
                $nomorSk = SkDocument::generateNomorSk();
                $sk = SkDocument::create([
                    'nomor_sk'             => $nomorSk,
                    'nama'                 => $data['nama'],
                    'jenis_sk'             => $data['jenis_sk'],
                    'unit_kerja'           => $data['unit_kerja'],
                    'school_id'            => $request->user()->role === 'operator'
                                                ? $request->user()->school_id
                                                : (School::whereRaw('LOWER(nama) = LOWER(?)', [$data['unit_kerja']])->value('id')),
                    'surat_permohonan_url' => $data['surat_permohonan_url'],
                    'status'               => 'rejected',
                    'rejection_reason'     => 'PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.',
                    'created_by'           => $request->user()->email,
                    'tanggal_penetapan'    => $data['tanggal_penetapan'] ?? now()->format('Y-m-d'),
                ]);
                return response()->json([
                    'message' => 'Pengajuan ditolak: PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.',
                    'sk'      => $sk,
                ], 422);
            }

            // Use database-agnostic case-insensitive comparison
            $schoolId = $school?->id;

            // Force school_id for operators
            if ($request->user()->role === 'operator') {
                $schoolId = $request->user()->school_id;
            }
            $data['school_id'] = $schoolId;

            // --- Duplicate submission guard ---
            // Tahun ajaran selalu mengacu ke tahun berjalan → tahun berikutnya.
            // Contoh: Juni 2026 → "2026/2027" (SK disiapkan untuk tapel yang akan datang).
            $nowYear  = (int) now()->format('Y');
            $activeTahunAjaran = "{$nowYear}/" . ($nowYear + 1);

            // Block re-submission of the same person + jenis SK for the current academic year.
            // A "pending" or "draft" record already waiting for approval counts as a duplicate.
            // Approved/rejected/archived records do NOT block: operators can re-submit after rejection,
            // and perpanjangan for a different tapel is handled by the different tahun_ajaran value.
            $duplicateQuery = SkDocument::where('nama', $data['nama'])
                ->where('jenis_sk', $data['jenis_sk'])
                ->where('school_id', $schoolId)
                ->whereIn('status', ['pending', 'draft']);

            // Only apply tahun_ajaran filter when the column is already populated on existing rows.
            // Rows submitted before this fix have tahun_ajaran = NULL, so we catch both:
            //   - rows with tahun_ajaran matching this year (new submissions)
            //   - rows with tahun_ajaran = NULL (legacy rows without the field set)
            $duplicateQuery->where(function ($q) use ($activeTahunAjaran) {
                $q->where('tahun_ajaran', $activeTahunAjaran)
                  ->orWhereNull('tahun_ajaran');
            });

            $existingPending = $duplicateQuery->first();
            if ($existingPending) {
                return response()->json([
                    'message' => "Pengajuan SK untuk \"{$data['nama']}\" ({$data['jenis_sk']}) sudah ada dan sedang menunggu persetujuan (No: {$existingPending->nomor_sk}). Tidak bisa mengajukan duplikat untuk tahun ajaran yang sama.",
                    'existing_nomor_sk' => $existingPending->nomor_sk,
                ], 422);
            }

            // Upsert Teacher logic
            $teacher = null;
            if (!empty($data['nuptk'])) {
                $teacher = Teacher::where('nuptk', $data['nuptk'])->first();
            } elseif (!empty($data['nip'])) {
                $teacher = Teacher::where('nip', $data['nip'])->first();
            } else {
                // Try exact match first, then fall back to bare-name match
                // (handles cases where DB has "MAILID" but input is "MAILID, S.Pd." or vice versa)
                $teacher = Teacher::where('nama', $data['nama'])->where('school_id', $schoolId)->first();
                if (!$teacher) {
                    $bareName = mb_strtoupper(
                        trim($this->normalizationService->parseAcademicDegreesPublic($data['nama'])['name']),
                        'UTF-8'
                    );
                    if ($bareName !== '') {
                        $teacher = Teacher::where(function ($q) use ($bareName) {
                                $q->whereRaw("UPPER(nama) = ?", [$bareName])
                                  ->orWhereRaw("UPPER(nama) LIKE ?", [$bareName . ',%']);
                            })
                            ->where('school_id', $schoolId)
                            ->first();
                    }
                }
            }

            // Teacher data with normalized values
            $teacherData = [
                'nama' => trim($data['nama']),
                'nuptk' => !empty($data['nuptk']) ? trim($data['nuptk']) : null,
                'nip' => !empty($data['nip']) ? trim($data['nip']) : null,
                'unit_kerja' => trim($data['unit_kerja']),
                'school_id' => $schoolId,
                'jabatan' => $data['jabatan'] ?? null,
                'status' => $data['status_kepegawaian'] ?? 'Draft',
                'is_verified' => false,
            ];

            // Merge personal data fields only when provided — avoid overwriting existing
            // Teacher data with empty values (e.g. if operator re-submits without filling them)
            if (!empty($data['tempat_lahir'])) {
                $teacherData['tempat_lahir'] = $data['tempat_lahir'];
            }
            if (!empty($data['tanggal_lahir'])) {
                $teacherData['tanggal_lahir'] = $data['tanggal_lahir'];
            }
            if (!empty($data['pendidikan_terakhir'])) {
                $teacherData['pendidikan_terakhir'] = $data['pendidikan_terakhir'];
            }
            if (!empty($data['tmt'])) {
                $teacherData['tmt'] = $data['tmt'];
            }
            if (!empty($data['nomor_induk_maarif'])) {
                $existingWithNim = Teacher::where('nomor_induk_maarif', $data['nomor_induk_maarif'])->first();
                if ($existingWithNim) {
                    $isSameTeacher = ($teacher && $teacher->id === $existingWithNim->id) ||
                                     ($existingWithNim->nama === $teacherData['nama'] && $existingWithNim->school_id === $schoolId);
                    
                    if ($isSameTeacher) {
                        $teacherData['nomor_induk_maarif'] = $data['nomor_induk_maarif'];
                    } else {
                        // Loloskan tapi NIM dihilangkan agar admin yang meng-generate nanti
                        // (Mencegah error unique constraint collision dengan guru lain)
                    }
                } else {
                    $teacherData['nomor_induk_maarif'] = $data['nomor_induk_maarif'];
                }
            }

            // 3.2: Wrap teacher upsert in try-catch block
            try {
                if ($teacher) {
                    $teacher->update($teacherData);
                } else {
                    $teacher = Teacher::create($teacherData);
                }
            } catch (\Illuminate\Database\QueryException $e) {
                \Log::error('Teacher upsert failed', ['exception' => $e, 'data' => $teacherData]);
                
                $errorCode = $e->getCode();
                if ($errorCode == '23505') {
                    return response()->json([
                        'message' => 'Data guru sudah ada dengan identitas yang sama',
                    ], 422);
                } elseif ($errorCode == '23503') {
                    return response()->json([
                        'message' => 'Data sekolah tidak valid. Hubungi administrator.',
                    ], 422);
                } elseif ($errorCode == '23502') {
                    return response()->json([
                        'message' => 'Field wajib tidak boleh kosong. Periksa formulir Anda.',
                    ], 422);
                }
                
                throw $e;
            }

            // Generate temporary nomor_sk for pending requests: REQ/{year}/{sequence}
            // Uses race-condition-safe helper that retries on collision
            $nomorSk = SkDocument::generateNomorSk();

            // 3.3: Wrap SK document creation in try-catch block
            try {
                $sk = SkDocument::create([
                    'nomor_sk'             => $nomorSk,
                    'teacher_id'           => $teacher->id,
                    'nama'                 => $data['nama'],
                    'jenis_sk'             => $data['jenis_sk'],
                    'unit_kerja'           => $data['unit_kerja'],
                    'school_id'            => $schoolId,
                    'jabatan'              => $data['jabatan'] ?? null,
                    'surat_permohonan_url' => $data['surat_permohonan_url'],
                    'nomor_permohonan'     => $data['nomor_surat_permohonan'] ?? null,
                    'tanggal_permohonan'   => $data['tanggal_surat_permohonan'] ?? null,
                    'status'               => 'pending',
                    'created_by'           => $request->user()->email,
                    'tanggal_penetapan'    => $data['tanggal_penetapan'] ?? now()->format('Y-m-d'),
                    'tahun_ajaran'         => $activeTahunAjaran,
                ]);
            } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
                // Race condition on nomor_sk — re-fetch and retry once
                $nomorSk = SkDocument::generateNomorSk();
                $sk = SkDocument::create([
                    'nomor_sk'             => $nomorSk,
                    'teacher_id'           => $teacher->id,
                    'nama'                 => $data['nama'],
                    'jenis_sk'             => $data['jenis_sk'],
                    'unit_kerja'           => $data['unit_kerja'],
                    'school_id'            => $schoolId,
                    'jabatan'              => $data['jabatan'] ?? null,
                    'surat_permohonan_url' => $data['surat_permohonan_url'],
                    'nomor_permohonan'     => $data['nomor_surat_permohonan'] ?? null,
                    'tanggal_permohonan'   => $data['tanggal_surat_permohonan'] ?? null,
                    'status'               => 'pending',
                    'created_by'           => $request->user()->email,
                    'tanggal_penetapan'    => $data['tanggal_penetapan'] ?? now()->format('Y-m-d'),
                    'tahun_ajaran'         => $activeTahunAjaran,
                ]);
            } catch (\Illuminate\Database\QueryException $e) {
                \Log::error('SK document creation failed', ['exception' => $e, 'data' => [
                    'nomor_sk' => $nomorSk,
                    'teacher_id' => $teacher->id,
                    'nama' => $data['nama'],
                ]]);
                
                $errorCode = $e->getCode();
                $errorMessage = $e->getMessage();
                
                if ($errorCode == '23503') {
                    // Check which foreign key constraint failed
                    if (strpos($errorMessage, 'teacher_id') !== false) {
                        return response()->json([
                            'message' => 'Data guru tidak valid. Silakan periksa kembali.',
                        ], 422);
                    } elseif (strpos($errorMessage, 'school_id') !== false) {
                        return response()->json([
                            'message' => 'Data sekolah tidak valid. Hubungi administrator.',
                        ], 422);
                    }
                    return response()->json([
                        'message' => 'Data sekolah tidak valid. Hubungi administrator.',
                    ], 422);
                } elseif ($errorCode == '23502') {
                    return response()->json([
                        'message' => 'Field wajib tidak boleh kosong. Periksa formulir Anda.',
                    ], 422);
                }
                
                throw $e;
            }

            // 3.4: Wrap activity log creation in try-catch block
            try {
                $logProperties = [];
                if (!empty($normalizationChanges)) {
                    $logProperties['normalization'] = $normalizationChanges;
                }
                
                ActivityLog::create([
                    'description' => "Pengajuan SK Individual: {$data['nama']} ({$data['unit_kerja']})",
                    'event' => 'submit_sk_request',
                    'log_name' => 'sk',
                    'subject_id' => $sk->id,
                    'subject_type' => get_class($sk),
                    'causer_id' => $request->user()->id,
                    'causer_type' => get_class($request->user()),
                    'school_id' => $schoolId,
                    'properties' => $logProperties,
                ]);

                // Create approval history for SK submission
                ApprovalHistory::create([
                    'school_id'         => $schoolId,
                    'document_id'       => $sk->id,
                    'document_type'     => 'sk_document',
                    'action'            => 'submit',
                    'from_status'       => null,
                    'to_status'         => 'pending',
                    'performed_by'      => $request->user()->id,
                    'performed_at'      => now(),
                    'comment'           => null,
                    'metadata'          => [
                        'performed_by_name' => $request->user()->name,
                        'performed_by_role' => $request->user()->role,
                    ],
                ]);

                // Dispatch notification to queue — avoids blocking the HTTP response
                // when there are many admins to notify.
                NotifyAdminsOfSkSubmission::dispatch(
                    skId: $sk->id,
                    nomorSk: $sk->nomor_sk,
                    jenisSk: $data['jenis_sk'],
                    nama: $data['nama'],
                    unitKerja: $data['unit_kerja'],
                    schoolId: $schoolId
                );
            } catch (\Exception $e) {
                \Log::error('Failed to create activity log', ['exception' => $e, 'sk_id' => $sk->id]);
                // Continue execution - activity log failure should not block the request
            }

            // Invalidate dashboard cache for the affected school
            if ($schoolId) {
                $this->dashboardCacheService->invalidateForSchool($schoolId);
            }

            return response()->json($sk, 201);
        } catch (\Exception $e) {
            // 3.5: Add generic exception handler
            \Log::error('Unexpected error in submitRequest', ['exception' => $e, 'request' => $request->all()]);
            
            return response()->json([
                'message' => 'Gagal menyimpan pengajuan. Silakan coba lagi atau hubungi administrator.',
            ], 500);
        }
    }

    /**
     * POST /api/sk-documents/bulk-request
     * Submit bulk SK requests from Excel
     */
    public function bulkRequest(Request $request): JsonResponse
    {
        \Illuminate\Support\Facades\Log::info('Bulk SK Request Payload:', ['data' => $request->all()]);
        
        if ($request->has('meta.detected_headers')) {
            \Illuminate\Support\Facades\Log::info('Detected Headers from Frontend:', ['headers' => $request->input('meta.detected_headers')]);
        }
        
        $request->validate([
            'documents'            => 'required|array',
            'surat_permohonan_url' => 'required|string',
        ]);

        $documentCount = count($request->documents);

        // For very small batches (<= 3 rows), process synchronously for immediate feedback.
        // Anything larger goes to the queue to avoid gateway timeouts on slow connections.
        if ($documentCount <= 3) {
            return $this->processBulkRequestSync($request);
        }

        // For large batches (> 10 rows), dispatch to queue for background processing
        \App\Jobs\ProcessBulkSkSubmission::dispatch(
            documents: $request->documents,
            suratPermohonanUrl: $request->surat_permohonan_url,
            userId: $request->user()->id,
            userEmail: $request->user()->email,
            userSchoolId: $request->user()->school_id,
            userRole: $request->user()->role
        );

        return response()->json([
            'success' => true,
            'message' => "Pengajuan {$documentCount} SK sedang diproses di background. Anda akan menerima notifikasi setelah selesai.",
            'queued' => true,
            'count' => $documentCount,
        ], 202); // 202 Accepted
    }

    /**
     * Process bulk request synchronously (for small batches)
     */
    private function processBulkRequestSync(Request $request): JsonResponse
    {
        $created      = 0;
        $skipped      = 0;
        $rejectedRows = []; // detail guru yang ditolak (PNS) atau error
        $schoolCache  = [];
        $year         = now()->year;

        // Get the highest existing REQ/{year}/NNNN sequence number in one query,
        // then increment locally — avoids a per-row existence-check loop.
        // On a rare race-condition duplicate, the create() will throw and we
        // re-fetch via generateNomorSk() which retries safely.
        $prefix = "REQ/{$year}/";
        $seq = SkDocument::withoutTenantScope()
            ->where('nomor_sk', 'like', $prefix . '%')
            ->pluck('nomor_sk')
            ->map(fn($n) => (int) substr($n, strlen($prefix)))
            ->max() ?? 0;

        foreach ($request->documents as $doc) {
            try {
            // PNS auto-rejection: SK for PNS is issued by the government, not LP Ma'arif NU
            if ($this->isPns($doc)) {
                $seq++;
                $nomorSk = 'REQ/' . $year . '/' . str_pad($seq, 4, '0', STR_PAD_LEFT);
                $createdDoc = SkDocument::create([
                    'nomor_sk'         => $nomorSk,
                    'nama'             => $doc['nama'],
                    'jenis_sk'         => $doc['status_kepegawaian'] ?? $doc['status'] ?? $doc['jenis_sk'] ?? 'PNS',
                    'unit_kerja'       => $doc['unit_kerja'] ?? null,
                    'school_id'        => $request->user()->role === 'operator' ? $request->user()->school_id : null,
                    'status'           => 'rejected',
                    'rejection_reason' => 'PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.',
                    'created_by'       => $request->user()->email,
                    'tanggal_penetapan'=> now()->format('Y-m-d'),
                ]);
                \App\Models\ApprovalHistory::create([
                    'school_id' => $createdDoc->school_id,
                    'document_id' => $createdDoc->id,
                    'document_type' => 'sk_document',
                    'action' => 'reject',
                    'from_status' => 'pending',
                    'to_status' => 'rejected',
                    'performed_by' => null,
                    'performed_at' => now(),
                    'comment' => 'Ditolak otomatis oleh sistem',
                    'metadata' => ['rejection_reason' => 'PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.'],
                ]);
                $skipped++;
                $rejectedRows[] = [
                    'nama'   => $doc['nama'] ?? 'unknown',
                    'alasan' => 'PTK berstatus PNS tidak dapat mengajukan SK melalui yayasan.',
                ];
                continue;
            }
            // Normalize school name and teacher name before processing
            $originalUnitKerja = $doc['unit_kerja'] ?? null;
            $originalNama = $doc['nama'];
            
            $doc['unit_kerja'] = $this->normalizationService->normalizeSchoolName($doc['unit_kerja'] ?? null);
            $doc['nama'] = $this->normalizationService->normalizeTeacherName($doc['nama']);

            // Enrich name with degrees from Teacher record if the submitted name lacks them.
            $schoolIdForEnrich = $request->user()->role === 'operator' ? $request->user()->school_id : null;
            $doc['nama'] = $this->normalizationService->enrichNameFromTeacher($doc['nama'], $schoolIdForEnrich);

            $schoolId = null;
            // Force user's school if operator
            if ($request->user()->role === 'operator') {
                $schoolId = $request->user()->school_id;
                // If unit_kerja is blank, fall back to the operator's school name
                if (empty(trim((string)($doc['unit_kerja'] ?? '')))) {
                    if (!isset($schoolCache['__operator__'])) {
                        $schoolCache['__operator__'] = School::find($schoolId)?->nama;
                    }
                    $doc['unit_kerja'] = $schoolCache['__operator__'];
                }
            } elseif (isset($doc['unit_kerja'])) {
                // Case-insensitive school lookup with normalized name
                if (!isset($schoolCache[$doc['unit_kerja']])) {
                    $schoolCache[$doc['unit_kerja']] = School::where('nama', 'ILIKE', $doc['unit_kerja'])->value('id');
                }
                $schoolId = $schoolCache[$doc['unit_kerja']];
            }

            // --- Duplicate submission guard ---
            $nowYear  = (int) now()->format('Y');
            $activeTahunAjaranBulk = "{$nowYear}/" . ($nowYear + 1);

            $jenisSk = $doc['status_kepegawaian'] ?? $doc['status'] ?? $doc['jenis_sk'] ?? 'GTY';
            
            $duplicateQuery = \App\Models\SkDocument::where('nama', $doc['nama'])
                ->where('jenis_sk', $jenisSk)
                ->where('school_id', $schoolId)
                ->whereIn('status', ['pending', 'draft'])
                ->where(function ($q) use ($activeTahunAjaranBulk) {
                    $q->where('tahun_ajaran', $activeTahunAjaranBulk)
                      ->orWhereNull('tahun_ajaran');
                });

            $existingPending = $duplicateQuery->first();
            if ($existingPending) {
                $seq++;
                $nomorSk = 'REQ/' . $year . '/' . str_pad($seq, 4, '0', STR_PAD_LEFT);
                $createdDoc = \App\Models\SkDocument::create([
                    'nomor_sk'         => $nomorSk,
                    'nama'             => $doc['nama'],
                    'jenis_sk'         => $jenisSk,
                    'unit_kerja'       => $doc['unit_kerja'] ?? null,
                    'school_id'        => $schoolId,
                    'status'           => 'rejected',
                    'rejection_reason' => "Pengajuan sedang menunggu persetujuan (No: {$existingPending->nomor_sk}).",
                    'created_by'       => $request->user()->email,
                    'tanggal_penetapan'=> now()->format('Y-m-d'),
                ]);
                \App\Models\ApprovalHistory::create([
                    'school_id' => $schoolId,
                    'document_id' => $createdDoc->id,
                    'document_type' => 'sk_document',
                    'action' => 'reject',
                    'from_status' => 'pending',
                    'to_status' => 'rejected',
                    'performed_by' => null,
                    'performed_at' => now(),
                    'comment' => 'Ditolak otomatis oleh sistem',
                    'metadata' => ['rejection_reason' => "Pengajuan sedang menunggu persetujuan (No: {$existingPending->nomor_sk})."],
                ]);
                $skipped++;
                $rejectedRows[] = [
                    'nama'   => $doc['nama'] ?? 'unknown',
                    'alasan' => "Pengajuan sedang menunggu persetujuan (No: {$existingPending->nomor_sk}).",
                ];
                continue;
            }

            // Build teacher data — only include fields that are explicitly provided in the
            // uploaded Excel row. Fields absent from the file must NOT overwrite existing
            // database values (e.g. status, is_certified, is_verified, pdpkpnu).
            $teacherData = ['nama' => $doc['nama'], 'school_id' => $schoolId];

            foreach ([
                'nuptk', 'nip', 'nomor_induk_maarif', 'unit_kerja',
                'tempat_lahir', 'tanggal_lahir', 'pendidikan_terakhir',
                'tmt', 'kecamatan', 'status',
            ] as $field) {
                if (isset($doc[$field]) && $doc[$field] !== '' && $doc[$field] !== null) {
                    $teacherData[$field] = $doc[$field];
                }
            }

            // Normalize date fields — convert Indonesian date strings to ISO YYYY-MM-DD
            foreach (['tanggal_lahir', 'tmt'] as $dateField) {
                if (isset($teacherData[$dateField]) && is_string($teacherData[$dateField])) {
                    $parsed = $this->normalizationService->parseIndonesianDate($teacherData[$dateField]);
                    $teacherData[$dateField] = $parsed; // null if unparseable — safer than bad string
                }
            }

            // Normalize employment status if provided
            if (isset($teacherData['status'])) {
                $tmtForStatus = isset($teacherData['tmt']) ? \Carbon\Carbon::parse($teacherData['tmt']) : null;
                $teacherNameForStatus = $teacherData['nama'] ?? null;
                $teacherData['status'] = $this->normalizationService->normalizeEmploymentStatus($teacherData['status'], $tmtForStatus, $teacherNameForStatus);
            }



            // Sync NIP â†” NIM only when one side is provided and the other is missing
            $nipWasSynced = false;
            $nimWasSynced = false;
            if (empty($teacherData['nip']) && !empty($teacherData['nomor_induk_maarif'])) {
                $teacherData['nip'] = $teacherData['nomor_induk_maarif'];
                $nipWasSynced = true;
            }
            if (empty($teacherData['nomor_induk_maarif']) && !empty($teacherData['nip'])) {
                $teacherData['nomor_induk_maarif'] = $teacherData['nip'];
                $nimWasSynced = true;
            }

            // Validate synced NIP value for uniqueness (NIP â†” NIM sync may introduce duplicates)
            // When NIM is copied to NIP, check that the NIP value isn't already used by a different teacher
            if ($nipWasSynced && !empty($teacherData['nip'])) {
                $existingNipTeacher = Teacher::withoutTenantScope()
                    ->where('nip', $teacherData['nip'])
                    ->whereNull('deleted_at')
                    ->first();

                if ($existingNipTeacher) {
                    // Self-reference check: if the nuptk matches, it's the same teacher
                    $isSelfByNuptk = !empty($teacherData['nuptk']) && $existingNipTeacher->nuptk === $teacherData['nuptk'];
                    // Also check by exact name + school
                    $isSelfByName = mb_strtoupper(trim($teacherData['nama']), 'UTF-8') === mb_strtoupper(trim($existingNipTeacher->nama), 'UTF-8')
                        && $existingNipTeacher->school_id == $schoolId;

                    if (!$isSelfByNuptk && !$isSelfByName) {
                        $seq++;
                        $nomorSk = 'REQ/' . $year . '/' . str_pad($seq, 4, '0', STR_PAD_LEFT);
                        SkDocument::create([
                            'nomor_sk'         => $nomorSk,
                            'nama'             => $doc['nama'],
                            'jenis_sk'         => $doc['status_kepegawaian'] ?? $doc['status'] ?? $doc['jenis_sk'] ?? 'GTY',
                            'unit_kerja'       => $doc['unit_kerja'] ?? null,
                            'school_id'        => $schoolId,
                            'status'           => 'rejected',
                            'rejection_reason' => 'NIP sudah digunakan oleh guru lain (dari sinkronisasi NIM).',
                            'created_by'       => $request->user()->email,
                            'tanggal_penetapan'=> now()->format('Y-m-d'),
                        ]);
                        $skipped++;
                        $rejectedRows[] = [
                            'nama'   => $doc['nama'] ?? 'unknown',
                            'alasan' => 'NIP sudah digunakan oleh guru lain (dari sinkronisasi NIM).',
                        ];
                        continue;
                    }
                }
            }



            $teacher = null;
            if (!empty($teacherData['nuptk'])) {
                $teacher = Teacher::where('nuptk', $teacherData['nuptk'])->first();
            }

            if (!$teacher && !empty($teacherData['nip'])) {
                $teacher = Teacher::where('nip', $teacherData['nip'])->first();
            }

            if (!$teacher && !empty($teacherData['nomor_induk_maarif'])) {
                $teacher = Teacher::where('nomor_induk_maarif', $teacherData['nomor_induk_maarif'])->first();
            }

            // Protect against data-entry typos: if identifier matches but name is completely different, don't overwrite!
            if ($teacher) {
                $excelBareName = mb_strtoupper(trim($this->normalizationService->parseAcademicDegreesPublic($teacherData['nama'])['name']), 'UTF-8');
                $dbBareName = mb_strtoupper(trim($this->normalizationService->parseAcademicDegreesPublic($teacher->nama)['name']), 'UTF-8');
                
                if ($excelBareName !== '' && $dbBareName !== '') {
                    similar_text($excelBareName, $dbBareName, $percent);
                    if ($percent < 60) {
                        $teacher = null;
                    }
                }
            }

            if (!$teacher) {
                $teacher = Teacher::where('nama', $teacherData['nama'])
                    ->where('school_id', $schoolId)
                    ->first();

                // Fallback: bare-name match (handles degree mismatch between file and DB)
                if (!$teacher) {
                    $bareName = mb_strtoupper(
                        trim($this->normalizationService->parseAcademicDegreesPublic($teacherData['nama'])['name']),
                        'UTF-8'
                    );
                    if ($bareName !== '') {
                        $teacher = Teacher::where(function ($q) use ($bareName) {
                                $q->whereRaw("UPPER(nama) = ?", [$bareName])
                                  ->orWhereRaw("UPPER(nama) LIKE ?", [$bareName . ',%']);
                            })
                            ->where('school_id', $schoolId)
                            ->first();
                    }
                }
            }



            if ($teacher) {
                // Auto-fill NIM & TMT from existing teacher data if not provided in Excel
                if (empty($teacherData['nomor_induk_maarif']) && !empty($teacher->nomor_induk_maarif)) {
                    $teacherData['nomor_induk_maarif'] = $teacher->nomor_induk_maarif;
                }
                if (empty($teacherData['tmt']) && !empty($teacher->tmt)) {
                    $teacherData['tmt'] = $teacher->tmt;
                }

                // Existing teacher must have NIM and TMT — reject if both sources are empty
                $finalNim = $teacherData['nomor_induk_maarif'] ?? $teacher->nomor_induk_maarif;
                $finalTmt = $teacherData['tmt'] ?? $teacher->tmt;

                if (empty(trim((string)($finalNim ?? ''))) && empty(trim((string)($finalTmt ?? '')))) {
                    $seq++;
                    $nomorSk = 'REQ/' . $year . '/' . str_pad($seq, 4, '0', STR_PAD_LEFT);
                    SkDocument::create([
                        'nomor_sk'         => $nomorSk,
                        'nama'             => $doc['nama'],
                        'jenis_sk'         => $doc['status_kepegawaian'] ?? $doc['status'] ?? $doc['jenis_sk'] ?? 'GTY',
                        'unit_kerja'       => $doc['unit_kerja'] ?? null,
                        'school_id'        => $schoolId,
                        'status'           => 'rejected',
                        'rejection_reason' => 'Guru sudah terdaftar tetapi NIM dan TMT belum terisi. Lengkapi data guru terlebih dahulu.',
                        'created_by'       => $request->user()->email,
                        'tanggal_penetapan'=> now()->format('Y-m-d'),
                    ]);
                    $skipped++;
                    $rejectedRows[] = [
                        'nama'   => $doc['nama'] ?? 'unknown',
                        'alasan' => 'Guru sudah terdaftar tetapi NIM dan TMT belum terisi. Lengkapi data guru terlebih dahulu.',
                    ];
                    continue;
                }

                // Only update fields that were present in the uploaded file
                $teacher->update($teacherData);
            } else {
                // New teacher: apply safe defaults for required fields not in the file
                $teacher = Teacher::create(array_merge(['status' => 'Draft', 'is_verified' => false], $teacherData));
            }

            // --- Duplicate submission guard (bulk) ---
            // Block if a pending/draft SK for the same nama + jenis + school already exists
            // for the current active academic year. Rows with tahun_ajaran = NULL (legacy)
            // are also caught to avoid silent duplicates after the fix is deployed.
            $nowYearBulk  = (int) now()->format('Y');
            $activeTahunAjaranBulk = "{$nowYearBulk}/" . ($nowYearBulk + 1);

            $jenisSk = $doc['status_kepegawaian'] ?? $doc['status'] ?? $doc['jenis_sk'] ?? 'GTY';

            $dupeBulk = SkDocument::where('nama', $doc['nama'])
                ->where('jenis_sk', $jenisSk)
                ->where('school_id', $schoolId)
                ->whereIn('status', ['pending', 'draft'])
                ->where(function ($q) use ($activeTahunAjaranBulk) {
                    $q->where('tahun_ajaran', $activeTahunAjaranBulk)
                      ->orWhereNull('tahun_ajaran');
                })
                ->first();

            if ($dupeBulk) {
                $skipped++;
                $rejectedRows[] = [
                    'nama'   => $doc['nama'] ?? 'unknown',
                    'alasan' => "Pengajuan SK sudah ada dan sedang menunggu persetujuan (No: {$dupeBulk->nomor_sk}). Duplikat tidak diperbolehkan untuk tahun ajaran yang sama.",
                ];
                continue;
            }

            // Auto-generate unique nomor_sk: increment local counter, no per-row DB loop
            $seq++;
            $nomorSk = 'REQ/' . $year . '/' . str_pad($seq, 4, '0', STR_PAD_LEFT);

            // $jenisSk already set above in duplicate guard

            $rawJenisPengajuan = strtolower(trim($doc['jenis_pengajuan'] ?? ''));
            $jenisPengajuan = 'bulk';
            if (str_contains($rawJenisPengajuan, 'baru')) {
                $jenisPengajuan = 'new';
            } elseif (str_contains($rawJenisPengajuan, 'perpanjangan')) {
                $jenisPengajuan = 'renew';
            }

            try {
                $sk = SkDocument::create([
                    'nomor_sk'             => $nomorSk,
                    'teacher_id'           => $teacher->id,
                    'nama'                 => $doc['nama'],
                    'jenis_sk'             => $jenisSk,
                    'jenis_pengajuan'      => $jenisPengajuan,
                    'unit_kerja'           => $doc['unit_kerja'] ?? null,
                    'school_id'            => $schoolId,
                    'surat_permohonan_url' => $request->surat_permohonan_url,
                    'nomor_permohonan'     => $doc['nomor_permohonan'] ?? null,
                    'tanggal_permohonan'   => $doc['tanggal_permohonan'] ?? null,
                    'status'               => 'pending',
                    'created_by'           => $request->user()->email,
                    'tanggal_penetapan'    => now()->format('Y-m-d'),
                    'tahun_ajaran'         => $activeTahunAjaranBulk,
                ]);

                // Create approval history for bulk submission
                ApprovalHistory::create([
                    'school_id'         => $schoolId,
                    'document_id'       => $sk->id,
                    'document_type'     => 'sk_document',
                    'action'            => 'submit',
                    'from_status'       => null,
                    'to_status'         => 'pending',
                    'performed_by'      => $request->user()->id,
                    'performed_at'      => now(),
                    'comment'           => null,
                    'metadata'          => [
                        'performed_by_name' => $request->user()->name,
                        'performed_by_role' => $request->user()->role,
                        'bulk_submission'   => true,
                    ],
                ]);
            } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
                // Race condition: another request grabbed this nomor_sk — re-fetch safely
                $nomorSk = SkDocument::generateNomorSk($year);
                $seq = (int) explode('/', $nomorSk)[2]; // keep local counter in sync
                $sk = SkDocument::create([
                    'nomor_sk'             => $nomorSk,
                    'teacher_id'           => $teacher->id,
                    'nama'                 => $doc['nama'],
                    'jenis_sk'             => $jenisSk,
                    'jenis_pengajuan'      => $jenisPengajuan,
                    'unit_kerja'           => $doc['unit_kerja'] ?? null,
                    'school_id'            => $schoolId,
                    'surat_permohonan_url' => $request->surat_permohonan_url,
                    'nomor_permohonan'     => $doc['nomor_permohonan'] ?? null,
                    'tanggal_permohonan'   => $doc['tanggal_permohonan'] ?? null,
                    'status'               => 'pending',
                    'created_by'           => $request->user()->email,
                    'tanggal_penetapan'    => now()->format('Y-m-d'),
                    'tahun_ajaran'         => $activeTahunAjaranBulk,
                ]);

                // Create approval history for bulk submission (retry case)
                ApprovalHistory::create([
                    'school_id'         => $schoolId,
                    'document_id'       => $sk->id,
                    'document_type'     => 'sk_document',
                    'action'            => 'submit',
                    'from_status'       => null,
                    'to_status'         => 'pending',
                    'performed_by'      => $request->user()->id,
                    'performed_at'      => now(),
                    'comment'           => null,
                    'metadata'          => [
                        'performed_by_name' => $request->user()->name,
                        'performed_by_role' => $request->user()->role,
                        'bulk_submission'   => true,
                    ],
                ]);
            }
            $created++;
            } catch (\Throwable $e) {
                $skipped++;
                $rejectedRows[] = [
                    'nama'   => $doc['nama'] ?? 'unknown',
                    'alasan' => 'Gagal diproses: ' . $e->getMessage(),
                ];
                \Illuminate\Support\Facades\Log::warning('bulkRequest: skip row', [
                    'nama'  => $doc['nama'] ?? 'unknown',
                    'error' => $e->getMessage(),
                ]);
            }
        }

        ActivityLog::create([
            'description' => "Bulk Pengajuan SK: {$created} permohonan dibuat" . ($skipped > 0 ? ", {$skipped} dilewati" : ''),
            'event'       => 'bulk_sk_request',
            'log_name'    => 'sk',
            'causer_id'   => $request->user()->id,
            'causer_type' => get_class($request->user()),
            'school_id'   => $request->user()->school_id,
            'properties'  => ['rejected' => $rejectedRows],
        ]);

        // Notify admins about the new bulk submission
        $admins = User::whereIn('role', ['super_admin', 'admin_yayasan'])->get();
        $operatorSchoolName = $request->user()->school_id
            ? (School::find($request->user()->school_id)?->nama ?? 'Unknown')
            : 'Unknown';

        foreach ($admins as $admin) {
            try {
                Notification::create([
                    'user_id'   => $admin->id,
                    'school_id' => $request->user()->school_id,
                    'type'      => 'sk_bulk_submitted',
                    'title'     => '📝 Pengajuan SK Kolektif Baru',
                    'message'   => "Pengajuan SK kolektif dari {$operatorSchoolName}: {$created} permohonan menunggu verifikasi" .
                        ($skipped > 0 ? ", {$skipped} dilewati." : '.'),
                    'is_read'   => false,
                    'metadata'  => [
                        'school_id' => $request->user()->school_id,
                        'total'     => $created + $skipped,
                        'created'   => $created,
                        'skipped'   => $skipped,
                    ],
                ]);
            } catch (\Exception $e) {
                \Log::error('processBulkRequestSync: Failed to notify admin', [
                    'admin_id' => $admin->id,
                    'error'    => $e->getMessage(),
                ]);
            }
        }

        // Invalidate dashboard cache for the affected school
        $schoolId = $request->user()->school_id;
        if ($schoolId) {
            $this->dashboardCacheService->invalidateForSchool($schoolId);
        }

        return response()->json([
            'success'  => true,
            'count'    => $created,
            'skipped'  => $skipped,
            'rejected' => $rejectedRows,
        ]);
    }


    /**
     * GET /api/sk-documents/count
     */
    public function countByStatus(Request $request): JsonResponse
    {
        $query = SkDocument::query();

        if ($request->status) {
            $query->byStatus($request->status);
        }
        if ($request->jenis_sk) {
            $query->byJenis($request->jenis_sk);
        }

        return response()->json(['count' => $query->count()]);
    }

    /**
     * Generate the next available REQ/{year}/NNNN nomor_sk.
     *
     * Uses MAX() to find the current highest sequence in one query, then
     * returns the next value. The caller should catch UniqueConstraintViolation
     * and call this again if a race condition occurs.
     */
    public static function nextNomorSk(int $year): string
    {
        $maxSeq = SkDocument::withoutTenantScope()
            ->whereYear('created_at', $year)
            ->where('nomor_sk', 'like', "REQ/{$year}/%")
            ->pluck('nomor_sk')
            ->map(fn($n) => (int) substr($n, strlen("REQ/{$year}/")))
            ->max() ?? 0;

        return 'REQ/' . $year . '/' . str_pad($maxSeq + 1, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Find the operator user who submitted the SK.
     * Primary: lookup by email in created_by field.
     * Fallback: find active operator for the same school.
     */
    private function findSkOperator(SkDocument $sk): ?User
    {
        // Primary: lookup by email stored in created_by
        if (!empty($sk->created_by)) {
            $user = User::where('email', $sk->created_by)->first();
            if ($user) return $user;
        }

        // Fallback: find active operator for the same school
        if ($sk->school_id) {
            return User::where('role', 'operator')
                ->where('school_id', $sk->school_id)
                ->first();
        }

        return null;
    }

    /**
     * Detects whether a submission document belongs to a PNS/ASN civil servant.
     *
     * Detection criteria (either is sufficient):
     *   1. status_kepegawaian or status field is exactly "pns" or "asn" (case-insensitive),
     *      OR starts with "pns" / "asn" as a whole word (e.g. "PNS Aktif").
     *      "Non PNS" / "Non-PNS" are explicitly NOT treated as PNS.
     *   2. nip field contains exactly 18 digits (standard Indonesian PNS NIP format)
     *
     * SK for PNS is issued by the government, not by LP Ma'arif NU.
     * PNS submissions must be rejected at intake to prevent erroneous SK issuance.
     */
    private function isPns(array $doc): bool
    {
        $status = strtolower(trim($doc['status_kepegawaian'] ?? $doc['status'] ?? ''));
        $nip    = preg_replace('/\D/', '', $doc['nip'] ?? '');

        // Match "pns" or "asn" as a whole word at the START of the status string.
        // This correctly rejects "pns", "pns aktif", "asn" but accepts "non pns", "non-pns".
        $isPnsByStatus = (bool) preg_match('/^(pns|asn)\b/', $status);

        return $isPnsByStatus || strlen($nip) === 18;
    }

    /**
     * Helper to detect jenjang from school name if not available in DB
     */
    private function detectJenjang(?School $school, string $namaUnitKerja): string
    {
        if ($school && $school->jenjang) {
            $jenjang = strtoupper($school->jenjang);
            if (!empty($jenjang)) return $jenjang;
        }

        $nama = strtoupper($namaUnitKerja);
        if (preg_match('/\bMI\b|MADRASAH IBTIDAIYAH|IBTIDAIYAH/', $nama)) return 'MI';
        if (preg_match('/\bSD\b|SEKOLAH DASAR/', $nama)) return 'SD';
        if (preg_match('/MTS|MT S|MADRASAH TSANAWIYAH|TSANAWIYAH/', $nama)) return 'MTS';
        if (preg_match('/\bSMP\b|SEKOLAH MENENGAH PERTAMA/', $nama)) return 'SMP';
        if (preg_match('/\bMA\b\s|MADRASAH ALIYAH/', $nama)) return 'MA';
        if (preg_match('/\bSMA\b|SEKOLAH MENENGAH ATAS/', $nama)) return 'SMA';
        if (preg_match('/\bSMK\b|SEKOLAH MENENGAH KEJURUAN/', $nama)) return 'SMK';
        if (preg_match('/\bRA\b|\bR A\b|RAUDHATUL|RAUDATUL|TK\b|TAMAN KANAK|PAUD\b|\bBA\b|BUSTHANUL|BUSTANUL/', $nama)) return 'RA';

        return 'UNKNOWN';
    }
}
