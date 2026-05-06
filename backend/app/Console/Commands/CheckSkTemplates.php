<?php

namespace App\Console\Commands;

use App\Models\SkTemplate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class CheckSkTemplates extends Command
{
    protected $signature = 'sk:check-templates {--type=surat_permohonan}';
    protected $description = 'Check SK template status and diagnose issues';

    public function handle(): int
    {
        $skType = $this->option('type');
        
        $this->info("🔍 Checking templates for type: {$skType}");
        $this->newLine();

        // Get all templates for this type (including soft-deleted)
        $templates = SkTemplate::withTrashed()
            ->where('sk_type', $skType)
            ->orderByDesc('created_at')
            ->get();

        if ($templates->isEmpty()) {
            $this->error("❌ No templates found for type '{$skType}'");
            $this->newLine();
            $this->info("Available sk_types in database:");
            $allTypes = SkTemplate::withTrashed()
                ->select('sk_type')
                ->distinct()
                ->pluck('sk_type');
            
            if ($allTypes->isEmpty()) {
                $this->warn("   No templates found in database at all.");
            } else {
                foreach ($allTypes as $type) {
                    $this->line("   - {$type}");
                }
            }
            
            return self::FAILURE;
        }

        $this->info("Found {$templates->count()} template(s):");
        $this->newLine();

        foreach ($templates as $template) {
            $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            $this->line("ID: {$template->id}");
            $this->line("Filename: {$template->original_filename}");
            $this->line("Path: {$template->file_path}");
            $this->line("Disk: {$template->disk}");
            
            // Check active status
            if ($template->is_active) {
                $this->info("✅ Status: ACTIVE");
            } else {
                $this->warn("⚠️  Status: INACTIVE");
            }

            // Check if soft-deleted
            if ($template->trashed()) {
                $this->error("🗑️  SOFT DELETED at {$template->deleted_at}");
            }

            // Check file existence
            $disk = Storage::disk($template->disk);
            if ($disk->exists($template->file_path)) {
                $size = $disk->size($template->file_path);
                $this->info("✅ File exists ({$this->formatBytes($size)})");
            } else {
                $this->error("❌ File NOT FOUND in storage");
            }

            $this->line("Uploaded by: {$template->uploaded_by}");
            $this->line("Created: {$template->created_at}");
            $this->newLine();
        }

        // Check for active template
        $activeTemplate = SkTemplate::active()->forType($skType)->first();
        
        if ($activeTemplate) {
            $this->info("✅ Active template found: {$activeTemplate->original_filename}");
            
            // Verify file exists
            $disk = Storage::disk($activeTemplate->disk);
            if (!$disk->exists($activeTemplate->file_path)) {
                $this->error("❌ PROBLEM: Active template file is missing from storage!");
                $this->warn("   This will cause 404 errors in the frontend.");
                $this->newLine();
                $this->info("💡 Suggested fix:");
                $this->line("   1. Re-upload the template file");
                $this->line("   2. Or deactivate this template and activate another one");
            }
        } else {
            $this->error("❌ No active template for type '{$skType}'");
            $this->newLine();
            
            if ($templates->isNotEmpty()) {
                $this->info("💡 Suggested fix:");
                $this->line("   Activate one of the templates above using:");
                $this->line("   php artisan sk:activate-template <template_id>");
            }
        }

        return self::SUCCESS;
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 2) . ' MB';
        } elseif ($bytes >= 1024) {
            return round($bytes / 1024, 2) . ' KB';
        }
        return $bytes . ' bytes';
    }
}
