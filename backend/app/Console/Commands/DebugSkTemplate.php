<?php

namespace App\Console\Commands;

use App\Models\SkTemplate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class DebugSkTemplate extends Command
{
    protected $signature = 'sk-template:debug {sk_type=surat_permohonan}';

    protected $description = 'Debug SK template configuration and file existence';

    public function handle(): int
    {
        $skType = $this->argument('sk_type');

        $this->info("🔍 Debugging SK Template: {$skType}");
        $this->newLine();

        // 1. Check database records
        $this->info('📊 Database Records:');
        $templates = SkTemplate::where('sk_type', $skType)->get();

        if ($templates->isEmpty()) {
            $this->error("❌ No templates found for sk_type: {$skType}");
            return self::FAILURE;
        }

        foreach ($templates as $template) {
            $this->line("  ID: {$template->id}");
            $this->line("  Original Filename: {$template->original_filename}");
            $this->line("  File Path: {$template->file_path}");
            $this->line("  Disk: {$template->disk}");
            $this->line("  Is Active: " . ($template->is_active ? '✅ YES' : '❌ NO'));
            $this->line("  Uploaded By: {$template->uploaded_by}");
            $this->line("  Created At: {$template->created_at}");
            $this->line("  Deleted At: " . ($template->deleted_at ? $template->deleted_at : 'NULL'));

            // 2. Check file existence
            $disk = Storage::disk($template->disk);
            $exists = $disk->exists($template->file_path);

            $this->line("  File Exists: " . ($exists ? '✅ YES' : '❌ NO'));

            if ($exists) {
                $size = $disk->size($template->file_path);
                $this->line("  File Size: " . number_format($size / 1024, 2) . " KB");

                // Try to generate URL
                try {
                    if ($template->disk === 's3') {
                        $url = $disk->temporaryUrl($template->file_path, now()->addMinutes(60));
                    } else {
                        $url = $disk->url($template->file_path);
                    }
                    $this->line("  Generated URL: {$url}");
                } catch (\Exception $e) {
                    $this->error("  ❌ Failed to generate URL: " . $e->getMessage());
                }
            } else {
                $this->error("  ❌ File not found at: {$template->file_path}");
                $this->warn("  💡 Expected location: " . $disk->path($template->file_path));
            }

            $this->newLine();
        }

        // 3. Check active template
        $this->info('🎯 Active Template:');
        $activeTemplate = SkTemplate::active()->forType($skType)->first();

        if ($activeTemplate) {
            $this->line("  ✅ Active template found: ID {$activeTemplate->id}");
            $this->line("  Filename: {$activeTemplate->original_filename}");
        } else {
            $this->error("  ❌ No active template found for {$skType}");
        }

        $this->newLine();

        // 4. Check storage configuration
        $this->info('⚙️  Storage Configuration:');
        $this->line("  Default Disk: " . config('filesystems.default'));
        $this->line("  Public Disk Root: " . config('filesystems.disks.public.root'));
        $this->line("  Public Disk URL: " . config('filesystems.disks.public.url'));
        $this->line("  APP_URL: " . config('app.url'));

        if (config('filesystems.default') === 's3') {
            $this->line("  S3 Bucket: " . config('filesystems.disks.s3.bucket'));
            $this->line("  S3 Region: " . config('filesystems.disks.s3.region'));
            $this->line("  S3 Endpoint: " . config('filesystems.disks.s3.endpoint'));
            $this->line("  S3 URL: " . config('filesystems.disks.s3.url'));
        }

        $this->newLine();

        // 5. Check symlink
        $this->info('🔗 Storage Symlink:');
        $symlinkPath = public_path('storage');
        $symlinkExists = is_link($symlinkPath);
        $this->line("  Symlink Exists: " . ($symlinkExists ? '✅ YES' : '❌ NO'));

        if ($symlinkExists) {
            $target = readlink($symlinkPath);
            $this->line("  Symlink Target: {$target}");
        } else {
            $this->warn("  💡 Run: php artisan storage:link");
        }

        return self::SUCCESS;
    }
}

