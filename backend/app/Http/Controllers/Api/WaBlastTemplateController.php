<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\WaBlast\StoreWaBlastTemplateRequest;
use App\Http\Requests\WaBlast\UpdateWaBlastTemplateRequest;
use App\Repositories\Contracts\WaBlastTemplateRepositoryInterface;
use App\Services\WaBlastTemplateService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class WaBlastTemplateController extends Controller
{
    use ApiResponse;

    public function __construct(
        private WaBlastTemplateService $templateService,
        private WaBlastTemplateRepositoryInterface $templateRepository
    ) {}

    /**
     * GET /api/wa-blast-templates
     * List all message templates.
     */
    public function index(): JsonResponse
    {
        $templates = $this->templateService->list();

        return $this->successResponse($templates, 'Daftar template berhasil diambil.');
    }

    /**
     * POST /api/wa-blast-templates
     * Create a new message template.
     */
    public function store(StoreWaBlastTemplateRequest $request): JsonResponse
    {
        try {
            $data = $request->validated();
            $data['created_by'] = $request->user()->id;

            $template = $this->templateService->create($data);

            return $this->successResponse($template, 'Template berhasil dibuat.', 201);
        } catch (ValidationException $e) {
            return $this->validationErrorResponse($e->errors());
        }
    }

    /**
     * GET /api/wa-blast-templates/{id}
     * Get detail of a single template.
     */
    public function show(int $id): JsonResponse
    {
        $template = $this->templateRepository->findById($id);

        if (!$template) {
            return $this->errorResponse('Template tidak ditemukan.', null, 404);
        }

        return $this->successResponse($template, 'Detail template berhasil diambil.');
    }

    /**
     * PUT /api/wa-blast-templates/{id}
     * Update an existing template.
     */
    public function update(UpdateWaBlastTemplateRequest $request, int $id): JsonResponse
    {
        try {
            $template = $this->templateRepository->findById($id);

            if (!$template) {
                return $this->errorResponse('Template tidak ditemukan.', null, 404);
            }

            $updated = $this->templateService->update($id, $request->validated());

            return $this->successResponse($updated, 'Template berhasil diperbarui.');
        } catch (ValidationException $e) {
            return $this->validationErrorResponse($e->errors());
        }
    }

    /**
     * DELETE /api/wa-blast-templates/{id}
     * Soft-delete a template.
     */
    public function destroy(int $id): JsonResponse
    {
        $template = $this->templateRepository->findById($id);

        if (!$template) {
            return $this->errorResponse('Template tidak ditemukan.', null, 404);
        }

        $this->templateService->delete($id);

        return $this->successResponse(null, 'Template berhasil dihapus.');
    }
}
