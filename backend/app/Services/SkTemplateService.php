<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\SkTemplate;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SkTemplateService
{
    /**
     * Store an uploaded SK template file and persist its metadata.
     */
    public function store(UploadedFile $file, string $skType, User $uploader): SkTemplate
    {
        $disk      = $this->resolveDisk();
        $extension = $file->getClientOriginalExtension() ?: 'docx';
        $filename  = Str::uuid() . '.' . $extension;
        $path      = 'sk-templates/' . $filename;

        Storage::disk($disk)->putFileAs('sk-templates', $file, $filename);

        $template = SkTemplate::create([
            'sk_type'           => $skType,
            'original_filename' => $file->getClientOriginalName(),
            'file_path'         => $path,
            'disk'              => $disk,
            'is_active'         => false,
            'uploaded_by'       => $uploader->email,
        ]);

        ActivityLog::create([
            'log_name'     => 'sk_template',
            'description'  => "Template SK '{$skType}' diunggah: {$file->getClientOriginalName()}",
            'event'        => 'upload_sk_template',
            'subject_id'   => $template->id,
            'subject_type' => SkTemplate::class,
            'causer_id'    => $uploader->id,
            'causer_type'  => User::class,
            'properties'   => [
                'sk_type'           => $skType,
                'original_filename' => $file->getClientOriginalName(),
            ],
            'school_id'    => null,
        ]);

        return $template;
    }

    /**
     * Activate a template, deactivating all others of the same sk_type.
     * Wrapped in a DB transaction to guarantee the single-active invariant.
     */
    public function activate(SkTemplate $template, User $activator): SkTemplate
    {
        DB::transaction(function () use ($template, $activator) {
            SkTemplate::where('sk_type', $template->sk_type)
                ->where('id', '!=', $template->id)
                ->update(['is_active' => false]);

            $template->update(['is_active' => true]);

            ActivityLog::create([
                'log_name'     => 'sk_template',
                'description'  => "Template SK '{$template->sk_type}' diaktifkan: {$template->original_filename}",
                'event'        => 'activate_sk_template',
                'subject_id'   => $template->id,
                'subject_type' => SkTemplate::class,
                'causer_id'    => $activator->id,
                'causer_type'  => User::class,
                'properties'   => [
                    'id'      => $template->id,
                    'sk_type' => $template->sk_type,
                ],
                'school_id'    => null,
            ]);
        });

        return $template->fresh();
    }

    /**
     * Soft-delete a template, clearing active status first if it was active.
     */
    public function delete(SkTemplate $template, User $deleter): void
    {
        if ($template->is_active) {
            $template->update(['is_active' => false]);
        }

        // Capture before soft-delete so we can log the correct values
        $templateId = $template->id;
        $skType     = $template->sk_type;
        $filename   = $template->original_filename;

        $template->delete();

        ActivityLog::create([
            'log_name'     => 'sk_template',
            'description'  => "Template SK '{$skType}' dihapus: {$filename}",
            'event'        => 'delete_sk_template',
            'subject_id'   => $templateId,
            'subject_type' => SkTemplate::class,
            'causer_id'    => $deleter->id,
            'causer_type'  => User::class,
            'properties'   => [
                'id'      => $templateId,
                'sk_type' => $skType,
            ],
            'school_id'    => null,
        ]);
    }

    /**
     * Return a URL to access the template file.
     *
     * Strategy:
     * - If disk is 's3' and AWS_URL points to the backend MinIO proxy (contains '/api/minio'),
     *   return a proxy URL directly: {APP_URL}/api/minio/{bucket}/{file_path}
     *   This avoids broken presigned URLs being routed through the proxy.
     * - If disk is 's3' and AWS_URL is a real public MinIO endpoint, return a presigned URL
     *   with the internal endpoint replaced by the public URL.
     * - If disk is 'public', return a plain public URL.
     *
     * @throws \Symfony\Component\HttpKernel\Exception\HttpException
     */
    public function getDownloadUrl(SkTemplate $template): string
    {
        $disk = Storage::disk($template->disk);

        if (! $disk->exists($template->file_path)) {
            \Log::error('SK Template file not found in storage', [
                'template_id' => $template->id,
                'file_path'   => $template->file_path,
                'disk'        => $template->disk,
                'sk_type'     => $template->sk_type,
            ]);
            abort(404, 'File template tidak ditemukan di storage.');
        }

        if ($template->disk === 's3') {
            $minioPublicUrl = config('filesystems.disks.s3.url');
            $minioEndpoint  = config('filesystems.disks.s3.endpoint');
            $bucket         = config('filesystems.disks.s3.bucket', 'simmaci-storage');

            // If AWS_URL points to the backend proxy (/api/minio), build a direct proxy URL
            // instead of a presigned URL — presigned URLs cannot be served through the proxy.
            if ($minioPublicUrl && str_contains($minioPublicUrl, '/api/minio')) {
                $proxyBase = rtrim($minioPublicUrl, '/');
                $proxyUrl  = $proxyBase . '/' . $bucket . '/' . ltrim($template->file_path, '/');

                \Log::info('Generated MinIO proxy URL for SK template', [
                    'template_id' => $template->id,
                    'sk_type'     => $template->sk_type,
                    'url'         => $proxyUrl,
                ]);

                return $proxyUrl;
            }

            // Standard presigned URL — replace internal hostname with public-facing URL
            $url = $disk->temporaryUrl($template->file_path, now()->addMinutes(60));

            if ($minioPublicUrl && $minioEndpoint) {
                $url = str_replace(rtrim($minioEndpoint, '/'), rtrim($minioPublicUrl, '/'), $url);
            }

            \Log::info('Generated S3 presigned URL for SK template', [
                'template_id' => $template->id,
                'sk_type'     => $template->sk_type,
                'url'         => $url,
            ]);

            return $url;
        }

        $url = $disk->url($template->file_path);

        \Log::info('Generated public disk URL for SK template', [
            'template_id' => $template->id,
            'sk_type'     => $template->sk_type,
            'url'         => $url,
        ]);

        return $url;
    }

    /**
     * Resolve the currently active template for a given sk_type.
     * Returns null if no active template exists.
     */
    public function resolveActiveTemplate(string $skType): ?SkTemplate
    {
        return SkTemplate::active()->forType($skType)->first();
    }

    /**
     * Determine which storage disk to use.
     * Prefers S3 when AWS credentials are present, falls back to public disk.
     */
    private function resolveDisk(): string
    {
        return config('filesystems.default') === 's3' && config('filesystems.disks.s3.key')
            ? 's3'
            : 'public';
    }
}
