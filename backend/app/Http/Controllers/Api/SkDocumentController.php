<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Notification;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\User;
use App\Services\NormalizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SkDocumentController extends Controller
{
    public function __construct(
        private NormalizationService $normalizationService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = SkDocument::with('teacher');

        if ($request->search) {
            $query->where('nama', 'ilike', "%{$request->search}%");
        }
        if ($request->status && $request->status !== 'all') {
            // For the SK Generator, we source from 'pending' requests
            if ($request->status === 'unverified') {
                $query->where('status', 'pending');
            } else {
                $query->byStatus($request->status);
            }
        }
        if ($request->jenis_sk && $request->jenis_sk !== 'all') {
            $query->byJenis($request->jenis_sk);
        }

        // --- Tenant Isolation ---
        $user = $request->user();
        if ($user->role === 'operator' && $user->school_id) {
            $query->where('school_id', $user->school_id);
        } elseif ($request->school_id) {
            $query->where('school_id', $request->school_id);
        }

        return response()->json(
            $query->orderByDesc('created_at')->orderByDesc('id')->paginate($request->integer('per_page', 25))
        );
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

        return response()->json($sk, 201);
    }

    public function update(Request $request, SkDocument $skDocument): JsonResponse
    {
        try {
            $request->validate([
                'ijazah_url' => 'nullable|string|max:500',
            ]);

            $oldStatus = $skDocument->status;

            $skDocument->update($request->only([
                'nomor_sk', 'jenis_sk', 'teacher_id', 'nama', 'jabatan',
                'unit_kerja', 'tanggal_penetapan', 'status', 'file_url', 'qr_code',
                'revision_status', 'revision_reason', 'revision_data',
                'ijazah_url',
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
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:sk_documents,id',
            'status' => 'required|string|in:approved,rejected',
            'rejection_reason' => 'nullable|string',
        ]);

        $user = $request->user();

        foreach ($request->ids as $id) {
            $sk = SkDocument::find($id);
            if (! $sk) continue;

            $sk->update([
                'status' => $request->status,
                'rejection_reason' => $request->rejection_reason,
            ]);

            // If it's a revision approval, apply the suggested data
            if ($request->status === 'approved' && $sk->revision_status === 'revision_pending' && $sk->revision_data) {
                $revData = $sk->revision_data;
                
                // Update SK Document
                $sk->update([
                    'nama' => $revData['nama'] ?? $sk->nama,
                    'unit_kerja' => $revData['unit_kerja'] ?? $sk->unit_kerja,
                    'revision_status' => 'approved',
                ]);

                // Update related Teacher
                if ($sk->teacher_id) {
                    $sk->teacher->update([
                        'nama' => $revData['nama'] ?? $sk->teacher->nama,
                        'nip' => $revData['nip'] ?? $sk->teacher->nip,
                        'tempat_lahir' => $revData['tempat_lahir'] ?? $sk->teacher->tempat_lahir,
                        'tanggal_lahir' => $revData['tanggal_lahir'] ?? $sk->teacher->tanggal_lahir,
                        'pendidikan_terakhir' => $revData['pendidikan_terakhir'] ?? $sk->teacher->pendidikan_terakhir,
                        'tmt' => $revData['tmt'] ?? $sk->teacher->tmt,
                    ]);
                }
            } elseif ($request->status === 'rejected' && $sk->revision_status === 'revision_pending') {
                $sk->update(['revision_status' => 'rejected']);
            }

            // Verify teacher when SK approved
            if ($request->status === 'approved' && $sk->teacher_id) {
                $sk->teacher?->update(['is_verified' => true]);
            } elseif ($request->status === 'rejected' && $sk->teacher_id) {
                $sk->teacher?->update(['is_verified' => false]);
            }

            // Create notification for SK creator
            if ($sk->created_by) {
                $targetUser = User::where('email', $sk->created_by)->first();
                if ($targetUser) {
                    $isApproved = $request->status === 'approved';
                    Notification::create([
                        'user_id'   => $targetUser->id,
                        'school_id' => $sk->school_id,
                        'type'      => $isApproved ? 'sk_approved' : 'sk_rejected',
                        'title'     => $isApproved ? '✅ SK Disetujui' : '❌ SK Ditolak',
                        'message'   => "SK No. {$sk->nomor_sk} untuk {$sk->nama} telah " .
                            ($isApproved ? 'disetujui dan siap diterbitkan.' : 'ditolak.' .
                            ($request->rejection_reason ? " Alasan: {$request->rejection_reason}" : '')),
                        'is_read'   => false,
                        'metadata'  => [
                            'sk_id'           => $sk->id,
                            'nomor_sk'        => $sk->nomor_sk,
                            'rejection_reason' => $request->rejection_reason,
                        ],
                    ]);
                }
            }
        }

        ActivityLog::log(
            description: "Batch {$request->status}: " . count($request->ids) . ' SK dokumen',
            event: 'batch_' . $request->status . '_sk',
            logName: 'sk',
            causer: $user,
            schoolId: $user->school_id
        );

        return response()->json(['count' => count($request->ids)]);
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
                'unit_kerja' => 'required|string',
                'jabatan' => 'nullable|string',
                'surat_permohonan_url' => 'required|string',
                'nomor_surat_permohonan' => 'nullable|string',
                'tanggal_surat_permohonan' => 'nullable|string',
                'tanggal_penetapan' => 'nullable|string',
                'status_kepegawaian' => 'nullable|string',
            ]);

            // Normalize school name and teacher name before processing
            $originalUnitKerja = $data['unit_kerja'];
            $originalNama = $data['nama'];
            
            $data['unit_kerja'] = $this->normalizationService->normalizeSchoolName($data['unit_kerja']);
            $data['nama'] = $this->normalizationService->normalizeTeacherName($data['nama']);
            
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

            // Case-insensitive school lookup with normalized name
            // Use database-agnostic case-insensitive comparison
            $school = School::whereRaw('LOWER(nama) = LOWER(?)', [$data['unit_kerja']])->first();
            $schoolId = $school?->id;

            // Force school_id for operators
            if ($request->user()->role === 'operator') {
                $schoolId = $request->user()->school_id;
            }
            $data['school_id'] = $schoolId;

            // Upsert Teacher logic
            $teacher = null;
            if (!empty($data['nuptk'])) {
                $teacher = Teacher::where('nuptk', $data['nuptk'])->first();
            } elseif (!empty($data['nip'])) {
                $teacher = Teacher::where('nip', $data['nip'])->first();
            } else {
                $teacher = Teacher::where('nama', $data['nama'])->where('school_id', $schoolId)->first();
            }

            // Teacher data with normalized values
            $teacherData = [
                'nama' => $data['nama'],
                'nuptk' => $data['nuptk'] ?? null,
                'nip' => $data['nip'] ?? null,
                'unit_kerja' => $data['unit_kerja'],
                'school_id' => $schoolId,
                'jabatan' => $data['jabatan'] ?? null,
                'status' => $data['status_kepegawaian'] ?? 'Draft',
                'is_verified' => false,
            ];

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

                // Notify super_admin and admin_yayasan about new SK submission
                $admins = User::whereIn('role', ['super_admin', 'admin_yayasan'])->get();
                foreach ($admins as $admin) {
                    Notification::create([
                        'user_id'   => $admin->id,
                        'school_id' => $schoolId,
                        'type'      => 'sk_submitted',
                        'title'     => 'Pengajuan SK Baru',
                        'message'   => "Pengajuan {$data['jenis_sk']} dari {$data['nama']} ({$data['unit_kerja']}) menunggu verifikasi.",
                        'is_read'   => false,
                        'metadata'  => ['sk_id' => $sk->id, 'nomor_sk' => $sk->nomor_sk],
                    ]);
                }
            } catch (\Exception $e) {
                \Log::error('Failed to create activity log', ['exception' => $e, 'sk_id' => $sk->id]);
                // Continue execution - activity log failure should not block the request
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
                SkDocument::create([
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
                $teacherData['status'] = $this->normalizationService->normalizeEmploymentStatus($teacherData['status'], $tmtForStatus);
            }

            // Sync NIP ↔ NIM only when one side is provided and the other is missing
            if (empty($teacherData['nip']) && !empty($teacherData['nomor_induk_maarif'])) {
                $teacherData['nip'] = $teacherData['nomor_induk_maarif'];
            }
            if (empty($teacherData['nomor_induk_maarif']) && !empty($teacherData['nip'])) {
                $teacherData['nomor_induk_maarif'] = $teacherData['nip'];
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

            if (!$teacher) {
                $teacher = Teacher::where('nama', $teacherData['nama'])
                    ->where('school_id', $schoolId)
                    ->first();
            }

            if ($teacher) {
                // Only update fields that were present in the uploaded file
                $teacher->update($teacherData);
            } else {
                // New teacher: apply safe defaults for required fields not in the file
                $teacher = Teacher::create(array_merge(['status' => 'Draft', 'is_verified' => false], $teacherData));
            }

            // Auto-generate unique nomor_sk: increment local counter, no per-row DB loop
            $seq++;
            $nomorSk = 'REQ/' . $year . '/' . str_pad($seq, 4, '0', STR_PAD_LEFT);

            $jenisSk = $doc['status_kepegawaian'] ?? $doc['status'] ?? $doc['jenis_sk'] ?? 'GTY';

            try {
                SkDocument::create([
                    'nomor_sk'             => $nomorSk,
                    'teacher_id'           => $teacher->id,
                    'nama'                 => $doc['nama'],
                    'jenis_sk'             => $jenisSk,
                    'unit_kerja'           => $doc['unit_kerja'] ?? null,
                    'school_id'            => $schoolId,
                    'surat_permohonan_url' => $request->surat_permohonan_url,
                    'nomor_permohonan'     => $doc['nomor_permohonan'] ?? null,
                    'tanggal_permohonan'   => $doc['tanggal_permohonan'] ?? null,
                    'status'               => 'pending',
                    'created_by'           => $request->user()->email,
                    'tanggal_penetapan'    => now()->format('Y-m-d'),
                ]);
            } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
                // Race condition: another request grabbed this nomor_sk — re-fetch safely
                $nomorSk = SkDocument::generateNomorSk($year);
                $seq = (int) explode('/', $nomorSk)[2]; // keep local counter in sync
                SkDocument::create([
                    'nomor_sk'             => $nomorSk,
                    'teacher_id'           => $teacher->id,
                    'nama'                 => $doc['nama'],
                    'jenis_sk'             => $jenisSk,
                    'unit_kerja'           => $doc['unit_kerja'] ?? null,
                    'school_id'            => $schoolId,
                    'surat_permohonan_url' => $request->surat_permohonan_url,
                    'nomor_permohonan'     => $doc['nomor_permohonan'] ?? null,
                    'tanggal_permohonan'   => $doc['tanggal_permohonan'] ?? null,
                    'status'               => 'pending',
                    'created_by'           => $request->user()->email,
                    'tanggal_penetapan'    => now()->format('Y-m-d'),
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
        $maxSeq = (int) SkDocument::withoutTenantScope()
            ->whereYear('created_at', $year)
            ->where('nomor_sk', 'like', "REQ/{$year}/%")
            ->selectRaw("MAX(CAST(SPLIT_PART(nomor_sk, '/', 3) AS INTEGER)) as max_seq")
            ->value('max_seq');

        return 'REQ/' . $year . '/' . str_pad($maxSeq + 1, 4, '0', STR_PAD_LEFT);
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
}
