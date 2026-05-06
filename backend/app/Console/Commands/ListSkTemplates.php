<?php

namespace App\Console\Commands;

use App\Models\SkTemplate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class ListSkTemplates extends Command
{
    protected $signature = 'sk:list-templates {--all : Include soft-deleted templates}';
    protected $description = 'List all SK templates with their status';

    public function handle(): int
    {
        $includeDeleted = $this->option('all');
        
        $query = SkTemplate::query();
        
        if ($includeDeleted) {
            $query->withTrashed();
        }
        
        $templates = $query->orderBy('sk_type')
            ->orderByDesc('created_at')
            ->get();

        if ($templates->isEmpty()) {
            $this->warn("No templates found in database.");
            return self::SUCCESS;
        }

        $this->info("Found {$templates->count()} template(s):\n");

        $headers = ['ID', 'Type', 'Filename', 'Active', 'File OK', 'Uploaded By', 'Created'];
        $rows = [];

        foreach ($templates as $template) {
            $disk = Storage::disk($template->disk);
            $fileExists = $disk->exists($template->file_path);
            
            $rows[] = [
                $template->id,
                $template->sk_type,
                $template->original_filename,
                $template->is_active ? '✅' : '❌',
                $fileExists ? '✅' : '❌',
                $template->uploaded_by,
                $template->created_at->format('Y-m-d H:i'),
            ];
        }

        $this->table($headers, $rows);

        // Summary by type
        $this->newLine();
        $this->info("Summary by type:");
        
        $byType = $templates->groupBy('sk_type');
        foreach ($byType as $type => $items) {
            $activeCount = $items->where('is_active', true)->count();
            $validFiles = $items->filter(function ($t) {
                return Storage::disk($t->disk)->exists($t->file_path);
            })->count();
            
            $this->line("  {$type}: {$items->count()} total, {$activeCount} active, {$validFiles} with valid files");
        }

        return self::SUCCESS;
    }
}
