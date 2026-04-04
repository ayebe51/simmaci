<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Notification;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SkDocumentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SkDocument::with('teacher');

        if ($request->search) {
            $query->where('nama', 'ilike', "%{$request->search}%");
        }
        if ($request->status && $request->status !== 'all') {
            $query->byStatus($request->status);
        }
        if ($request->jenis_sk && $request->jenis_sk !== 'all') {
            $query->byJenis($request->jenis_sk);
        }

        return response()->json(
            $query->orderByDesc('created_at')->paginate($request->integer('per_page', 25))
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
        $oldStatus = $skDocument->status;

        $skDocument->update($request->only([
            'nomor_sk', 'jenis_sk', 'teacher_id', 'nama', 'jabatan',
            'unit_kerja', 'tanggal_penetapan', 'status', 'file_url', 'qr_code',
            'revision_status', 'revision_reason', 'revision_data',
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
            ]);

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
                    Notification::create([
                        'user_id' => $targetUser->id,
                        'type' => $request->status === 'approved' ? 'sk_approved' : 'sk_rejected',
                        'title' => $request->status === 'approved' ? 'SK Disetujui' : 'SK Ditolak',
                        'message' => "SK No. {$sk->nomor_sk} untuk {$sk->nama} telah " .
                            ($request->status === 'approved' ? 'disetujui' : 'ditolak') .
                            ($request->rejection_reason ? ": {$request->rejection_reason}" : ''),
                        'metadata' => ['sk_id' => $id, 'rejection_reason' => $request->rejection_reason],
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
}
