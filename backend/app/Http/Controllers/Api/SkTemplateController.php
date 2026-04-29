<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SkTemplate\StoreSkTemplateRequest;
use App\Models\SkTemplate;
use App\Services\SkTemplateService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

class SkTemplateController extends Controller
{
    use ApiResponse;

    public function __construct(
        private SkTemplateService $service
    ) {}

    /**
     * GET /api/sk-templates
     * List all templates ordered by sk_type asc, created_at desc.
     * Supports ?sk_type= filter. Excludes file_path from response.
     */
    public function index(Request $request): JsonResponse
    {
        $query = SkTemplate::query()
            ->orderBy('sk_type')
            ->orderByDesc('created_at');

        if ($request->filled('sk_type')) {
            $query->forType($request->sk_type);
        }

        $templates = $query->get([
            'id', 'sk_type', 'original_filename', 'is_active',
            'uploaded_by', 'created_at', 'updated_at',
        ]);

        return $this->successResponse($templates);
    }

    /**
     * POST /api/sk-templates
     * Upload a new SK template file. Returns 201 on success.
     */
    public function store(StoreSkTemplateRequest $request): JsonResponse
    {
        $template = $this->service->store(
            $request->file('file'),
            $request->input('sk_type'),
            $request->user()
        );

        return $this->successResponse(
            $template->only(['id', 'sk_type', 'original_filename', 'is_active', 'uploaded_by', 'created_at', 'updated_at']),
            'Template SK berhasil diunggah.',
            201
        );
    }

    /**
     * POST /api/sk-templates/{id}/activate
     * Activate a template, deactivating all others of the same sk_type.
     */
    public function activate(SkTemplate $skTemplate): JsonResponse
    {
        $template = $this->service->activate($skTemplate, request()->user());

        return $this->successResponse(
            $template->only(['id', 'sk_type', 'original_filename', 'is_active', 'uploaded_by', 'created_at', 'updated_at']),
            'Template SK berhasil diaktifkan.'
        );
    }

    /**
     * DELETE /api/sk-templates/{id}
     * Soft-delete a template (clears active status first if active).
     */
    public function destroy(SkTemplate $skTemplate): JsonResponse
    {
        $this->service->delete($skTemplate, request()->user());

        return $this->successResponse(null, 'Template SK berhasil dihapus.');
    }

    /**
     * GET /api/sk-templates/{id}/download
     * Return a signed/direct URL to download the template file.
     */
    public function download(SkTemplate $skTemplate): JsonResponse
    {
        try {
            $url = $this->service->getDownloadUrl($skTemplate);
        } catch (HttpException $e) {
            return $this->errorResponse('File template tidak ditemukan di storage.', null, 404);
        }

        return $this->successResponse(['url' => $url], 'Berhasil.');
    }

    /**
     * GET /api/sk-templates/active?sk_type=
     * Resolve the active template for a given sk_type.
     * Returns 404 if no active template exists or if the file is missing from storage.
     */
    public function active(Request $request): JsonResponse
    {
        $skType = $request->query('sk_type');

        if (! $skType) {
            return $this->errorResponse('Parameter sk_type wajib diisi.', null, 422);
        }

        $template = $this->service->resolveActiveTemplate($skType);

        if (! $template) {
            return $this->errorResponse('Tidak ada template aktif untuk jenis SK ini.', null, 404);
        }

        $data = $template->only(['id', 'sk_type', 'original_filename', 'is_active', 'uploaded_by', 'created_at', 'updated_at']);

        try {
            $data['file_url'] = $this->service->getDownloadUrl($template);
        } catch (HttpException $e) {
            // File record exists in DB but the actual file is missing from storage.
            // Return 404 so the frontend can fall back to the bundled static template.
            return $this->errorResponse('File template tidak ditemukan di storage.', null, 404);
        }

        return $this->successResponse($data);
    }
}
