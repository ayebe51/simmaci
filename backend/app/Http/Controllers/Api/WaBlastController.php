<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\WaBlast\PreviewRecipientsRequest;
use App\Http\Requests\WaBlast\StoreWaBlastRequest;
use App\Models\ActivityLog;
use App\Repositories\Contracts\WaBlastRepositoryInterface;
use App\Services\WaBlastService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class WaBlastController extends Controller
{
    use ApiResponse;

    public function __construct(
        private WaBlastService $waBlastService,
        private WaBlastRepositoryInterface $blastRepository
    ) {}

    /**
     * GET /api/wa-blasts
     * List paginated blast sessions with optional filters.
     *
     * Query params: blast_status, date_from, date_to, per_page
     */
    public function index(Request $request): JsonResponse
    {
        $filters = [
            'blast_status'   => $request->input('blast_status'),
            'created_at_from' => $request->input('date_from'),
            'created_at_to'   => $request->input('date_to'),
            'per_page'        => $request->integer('per_page', 15),
        ];

        $paginator = $this->blastRepository->paginate($filters);

        return $this->paginatedResponse($paginator, 'Daftar WA Blast berhasil diambil.');
    }

    /**
     * POST /api/wa-blasts
     * Create a new blast session (immediate or scheduled).
     */
    public function store(StoreWaBlastRequest $request): JsonResponse
    {
        try {
            $data = $request->validated();

            // Map 'jenjang' from request to 'jenjang_filter' expected by service
            if (isset($data['jenjang'])) {
                $data['jenjang_filter'] = $data['jenjang'];
                unset($data['jenjang']);
            }

            // Pass the uploaded file object directly (service handles storage)
            if ($request->hasFile('attachment')) {
                $data['attachment'] = $request->file('attachment');
            }

            $blast = $this->waBlastService->createBlast($data, $request->user()->id);

            // Log activity
            ActivityLog::create([
                'description' => "Membuat WA Blast: {$blast->title} ({$blast->total_recipients} penerima)",
                'event'       => 'create_wa_blast',
                'log_name'    => 'wa_blast',
                'subject_id'  => $blast->id,
                'subject_type' => get_class($blast),
                'causer_id'   => $request->user()->id,
                'causer_type' => get_class($request->user()),
                'school_id'   => null,
                'properties'  => [
                    'total_recipients' => $blast->total_recipients,
                    'blast_status'     => $blast->blast_status,
                    'scheduled_at'     => $blast->scheduled_at?->toIso8601String(),
                ],
            ]);

            return $this->successResponse($blast, 'WA Blast berhasil dibuat.', 201);
        } catch (ValidationException $e) {
            return $this->validationErrorResponse($e->errors());
        }
    }

    /**
     * GET /api/wa-blasts/{id}
     * Get detail of a single blast session including recipients.
     */
    public function show(int $id): JsonResponse
    {
        $blast = $this->blastRepository->findById($id);

        if (!$blast) {
            return $this->errorResponse('WA Blast tidak ditemukan.', null, 404);
        }

        $blast->load('recipients', 'creator');

        return $this->successResponse($blast, 'Detail WA Blast berhasil diambil.');
    }

    /**
     * DELETE /api/wa-blasts/{id}
     * Cancel a blast (only allowed for 'scheduled' or 'draft' status).
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        try {
            $this->waBlastService->cancelBlast($id);

            return $this->successResponse(null, 'WA Blast berhasil dibatalkan.');
        } catch (ValidationException $e) {
            return $this->validationErrorResponse($e->errors());
        }
    }

    /**
     * POST /api/wa-blasts/preview-recipients
     * Preview the recipient list before creating a blast.
     */
    public function previewRecipients(PreviewRecipientsRequest $request): JsonResponse
    {
        $data = $request->validated();

        $preview = $this->waBlastService->previewRecipients(
            $data['recipient_category'],
            $data['school_ids'] ?? [],
            $data['jenjang'] ?? []
        );

        return $this->successResponse($preview, 'Preview penerima berhasil diambil.');
    }

    /**
     * POST /api/wa-blasts/{id}/retry
     * Create a new blast from failed recipients of an existing blast.
     */
    public function retry(Request $request, int $id): JsonResponse
    {
        try {
            $newBlast = $this->waBlastService->retryBlast($id, $request->user()->id);

            // Log activity
            ActivityLog::create([
                'description' => "Retry WA Blast: {$newBlast->title} ({$newBlast->total_recipients} penerima)",
                'event'       => 'retry_wa_blast',
                'log_name'    => 'wa_blast',
                'subject_id'  => $newBlast->id,
                'subject_type' => get_class($newBlast),
                'causer_id'   => $request->user()->id,
                'causer_type' => get_class($request->user()),
                'school_id'   => null,
                'properties'  => [
                    'parent_blast_id'  => $id,
                    'total_recipients' => $newBlast->total_recipients,
                ],
            ]);

            return $this->successResponse($newBlast, 'WA Blast retry berhasil dibuat.', 201);
        } catch (ValidationException $e) {
            return $this->validationErrorResponse($e->errors());
        }
    }

    /**
     * GET /api/wa-blasts/{id}/progress
     * Get real-time delivery progress for a blast session.
     */
    public function progress(int $id): JsonResponse
    {
        try {
            $progress = $this->waBlastService->getProgress($id);

            return $this->successResponse($progress, 'Progress WA Blast berhasil diambil.');
        } catch (ValidationException $e) {
            return $this->validationErrorResponse($e->errors());
        }
    }
}
