<?php

namespace App\Console\Commands;

use App\Models\SkTemplate;
use App\Models\User;
use App\Services\SkTemplateService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class FixSkTemplateIssues extends Command
{
    protected $signature = 'sk:fix-templates {--type=surat_permohonan} {--auto-activate}';
    protected $description = 'Diagnose and fix common SK template issues';

    public function __construct(
        private SkTemplateService $service
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $skType = $this->option('type');
        $autoActivate = $this->option('auto-activate');
        
        $this->info("🔧 Diagnosing SK template issues for type: {$skType}");
        $this->newLine();

        // Step 1: Check if any templates exist
        $templates = SkTemplate::where('sk_type', $skType)->get();
        
        if ($templates->isEmpty()) {
            $this->error("❌ ISSUE: No templates found for type '{$skType}'");
            $this->newLine();
            $this->info("💡 SOLUTION:");
            $this->line("   1. Upload a template via the admin panel");
            $this->line("   2. Or check if the sk_type name is correct");
            $this->newLine();
            
            // Show available types
            $allTypes = SkTemplate::select('sk_type')->distinct()->pluck('sk_type');
            if ($allTypes->isNotEmpty()) {
                $this->info("Available sk_types:");
                foreach ($allTypes as $type) {
                    $count = SkTemplate::where('sk_type', $type)->count();
                    $activeCount = SkTemplate::where('sk_type', $type)->where('is_active', true)->count();
                    $this->line("   - {$type} ({$count} total, {$activeCount} active)");
                }
            }
            
            return self::FAILURE;
        }

        $this->info("✅ Found {$templates->count()} template(s)");
        $this->newLine();

        // Step 2: Check for active template
        $activeTemplate = SkTemplate::active()->forType($skType)->first();
        
        if (!$activeTemplate) {
            $this->error("❌ ISSUE: No active template for type '{$skType}'");
            $this->newLine();
            
            // Find the most recent valid template
            $validTemplate = null;
            foreach ($templates->sortByDesc('created_at') as $template) {
                $disk = Storage::disk($template->disk);
                if ($disk->exists($template->file_path)) {
                    $validTemplate = $template;
                    break;
                }
            }
            
            if ($validTemplate) {
                $this->info("💡 SOLUTION: Found a valid template to activate:");
                $this->line("   ID: {$validTemplate->id}");
                $this->line("   Filename: {$validTemplate->original_filename}");
                $this->line("   Created: {$validTemplate->created_at}");
                $this->newLine();
                
                if ($autoActivate || $this->confirm('Do you want to activate this template?', true)) {
                    $systemUser = User::where('role', 'super_admin')->first();
                    
                    if (!$systemUser) {
                        $this->error("❌ No super_admin user found");
                        return self::FAILURE;
                    }
                    
                    try {
                        $this->service->activate($validTemplate, $systemUser);
                        $this->info("✅ Template activated successfully!");
                        $activeTemplate = $validTemplate;
                    } catch (\Exception $e) {
                        $this->error("❌ Failed to activate: {$e->getMessage()}");
                        return self::FAILURE;
                    }
                } else {
                    $this->line("Run: php artisan sk:activate-template {$validTemplate->id}");
                    return self::FAILURE;
                }
            } else {
                $this->error("❌ No valid templates found (all files are missing from storage)");
                $this->info("💡 SOLUTION: Re-upload the template file");
                return self::FAILURE;
            }
        } else {
            $this->info("✅ Active template found: {$activeTemplate->original_filename}");
        }

        // Step 3: Verify file exists in storage
        $disk = Storage::disk($activeTemplate->disk);
        if (!$disk->exists($activeTemplate->file_path)) {
            $this->error("❌ ISSUE: Active template file is MISSING from storage");
            $this->line("   Path: {$activeTemplate->file_path}");
            $this->line("   Disk: {$activeTemplate->disk}");
            $this->newLine();
            $this->info("💡 SOLUTION:");
            $this->line("   1. Re-upload the template file");
            $this->line("   2. Or activate a different template that has a valid file");
            
            // Check if other templates have valid files
            $otherValidTemplates = $templates->filter(function ($t) use ($activeTemplate) {
                if ($t->id === $activeTemplate->id) {
                    return false;
                }
                $disk = Storage::disk($t->disk);
                return $disk->exists($t->file_path);
            });
            
            if ($otherValidTemplates->isNotEmpty()) {
                $this->newLine();
                $this->info("Other templates with valid files:");
                foreach ($otherValidTemplates as $t) {
                    $this->line("   - ID {$t->id}: {$t->original_filename}");
                }
            }
            
            return self::FAILURE;
        }

        $size = $disk->size($activeTemplate->file_path);
        $this->info("✅ File exists in storage ({$this->formatBytes($size)})");
        $this->newLine();

        // Step 4: Test URL generation
        try {
            $url = $this->service->getDownloadUrl($activeTemplate);
            $this->info("✅ Download URL generated successfully");
            $this->line("   URL: {$url}");
        } catch (\Exception $e) {
            $this->error("❌ ISSUE: Failed to generate download URL");
            $this->line("   Error: {$e->getMessage()}");
            return self::FAILURE;
        }

        $this->newLine();
        $this->info("🎉 All checks passed! Template should be working correctly.");
        
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
