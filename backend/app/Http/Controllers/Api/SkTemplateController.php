<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SkTemplate\StoreSkTemplateRequest;
use App\Models\SkTemplate;
use App\Services\SkTemplateService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
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
     * Stream the template file directly to the browser.
     * Returns the file as a download attachment (no redirect, no presigned URL).
     */
    public function download(SkTemplate $skTemplate): Response|JsonResponse
    {
        $disk = Storage::disk($skTemplate->disk);

        if (! $disk->exists($skTemplate->file_path)) {
            \Log::error('SK Template file not found in storage for download', [
                'template_id' => $skTemplate->id,
                'file_path'   => $skTemplate->file_path,
                'disk'        => $skTemplate->disk,
            ]);
            return $this->errorResponse('File template tidak ditemukan di storage.', null, 404);
        }

        $content  = $disk->get($skTemplate->file_path);
        $ext      = strtolower(pathinfo($skTemplate->file_path, PATHINFO_EXTENSION));
        $mimeMap  = [
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'doc'  => 'application/msword',
            'pdf'  => 'application/pdf',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        $mimeType = $mimeMap[$ext] ?? 'application/octet-stream';
        $filename = $skTemplate->original_filename ?: basename($skTemplate->file_path);

        \Log::info('Streaming SK template file for download', [
            'template_id' => $skTemplate->id,
            'sk_type'     => $skTemplate->sk_type,
            'filename'    => $filename,
        ]);

        return response($content, 200, [
            'Content-Type'        => $mimeType,
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Content-Length'      => strlen($content),
            'Cache-Control'       => 'private, no-store',
        ]);
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
            \Log::warning('No active SK template found', ['sk_type' => $skType]);
            return $this->errorResponse('Tidak ada template aktif untuk jenis SK ini.', null, 404);
        }

        $data = $template->only(['id', 'sk_type', 'original_filename', 'is_active', 'uploaded_by', 'created_at', 'updated_at']);

        try {
            $data['file_url'] = $this->service->getDownloadUrl($template);
            
            \Log::info('Successfully resolved active SK template', [
                'sk_type' => $skType,
                'template_id' => $template->id,
                'file_url' => $data['file_url'],
            ]);
        } catch (HttpException $e) {
            // File record exists in DB but the actual file is missing from storage.
            // Return 404 so the frontend can fall back to the bundled static template.
            \Log::error('SK template file missing from storage', [
                'sk_type' => $skType,
                'template_id' => $template->id,
                'file_path' => $template->file_path,
                'disk' => $template->disk,
                'error' => $e->getMessage(),
            ]);
            return $this->errorResponse('File template tidak ditemukan di storage.', null, 404);
        }

        return $this->successResponse($data);
    }
}
