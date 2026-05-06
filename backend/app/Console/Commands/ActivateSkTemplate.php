<?php

namespace App\Console\Commands;

use App\Models\SkTemplate;
use App\Models\User;
use App\Services\SkTemplateService;
use Illuminate\Console\Command;

class ActivateSkTemplate extends Command
{
    protected $signature = 'sk:activate-template {id : The template ID to activate}';
    protected $description = 'Activate an SK template by ID';

    public function __construct(
        private SkTemplateService $service
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $templateId = $this->argument('id');
        
        $template = SkTemplate::find($templateId);
        
        if (!$template) {
            $this->error("❌ Template with ID {$templateId} not found");
            return self::FAILURE;
        }

        $this->info("Template found:");
        $this->line("  ID: {$template->id}");
        $this->line("  Type: {$template->sk_type}");
        $this->line("  Filename: {$template->original_filename}");
        $this->newLine();

        if ($template->is_active) {
            $this->warn("⚠️  This template is already active");
            return self::SUCCESS;
        }

        // Get a system user for the activity log
        $systemUser = User::where('role', 'super_admin')->first();
        
        if (!$systemUser) {
            $this->error("❌ No super_admin user found. Cannot log activity.");
            return self::FAILURE;
        }

        try {
            $this->service->activate($template, $systemUser);
            $this->info("✅ Template activated successfully!");
            $this->line("   All other templates for type '{$template->sk_type}' have been deactivated.");
        } catch (\Exception $e) {
            $this->error("❌ Failed to activate template: {$e->getMessage()}");
            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
