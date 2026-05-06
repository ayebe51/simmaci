<?php

/**
 * Troubleshooting script untuk template surat permohonan
 * 
 * Jalankan dengan: php troubleshoot-template.php
 * Atau akses via browser: http://localhost:8000/troubleshoot-template.php
 */

require __DIR__ . '/vendor/autoload.php';

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== TROUBLESHOOTING TEMPLATE SURAT PERMOHONAN ===\n\n";

$skType = 'surat_permohonan';

try {
    // Check database connection
    echo "1. Checking database connection...\n";
    DB::connection()->getPdo();
    echo "   ✅ Database connected\n\n";
    
    // Check if sk_templates table exists
    echo "2. Checking sk_templates table...\n";
    $tableExists = DB::select("SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sk_templates'
    )")[0]->exists ?? false;
    
    if (!$tableExists) {
        echo "   ❌ Table sk_templates does not exist!\n";
        echo "   💡 Run: php artisan migrate\n\n";
        exit(1);
    }
    echo "   ✅ Table exists\n\n";
    
    // Get all templates for this type
    echo "3. Checking templates for type '{$skType}'...\n";
    $templates = DB::table('sk_templates')
        ->where('sk_type', $skType)
        ->whereNull('deleted_at')
        ->orderByDesc('created_at')
        ->get();
    
    if ($templates->isEmpty()) {
        echo "   ❌ No templates found for type '{$skType}'\n\n";
        
        // Show all available types
        $allTypes = DB::table('sk_templates')
            ->whereNull('deleted_at')
            ->distinct()
            ->pluck('sk_type');
        
        if ($allTypes->isEmpty()) {
            echo "   ℹ️  No templates in database at all\n";
            echo "   💡 Upload a template via admin panel\n\n";
        } else {
            echo "   ℹ️  Available sk_types in database:\n";
            foreach ($allTypes as $type) {
                $count = DB::table('sk_templates')
                    ->where('sk_type', $type)
                    ->whereNull('deleted_at')
                    ->count();
                $activeCount = DB::table('sk_templates')
                    ->where('sk_type', $type)
                    ->where('is_active', true)
                    ->whereNull('deleted_at')
                    ->count();
                echo "      - {$type} ({$count} total, {$activeCount} active)\n";
            }
            echo "\n   💡 The sk_type might be wrong. Check the upload form.\n\n";
        }
        exit(1);
    }
    
    echo "   ✅ Found {$templates->count()} template(s)\n\n";
    
    // Display all templates
    echo "4. Template details:\n";
    foreach ($templates as $i => $template) {
        echo "   " . str_repeat("─", 60) . "\n";
        echo "   Template #" . ($i + 1) . "\n";
        echo "   ID: {$template->id}\n";
        echo "   Filename: {$template->original_filename}\n";
        echo "   Path: {$template->file_path}\n";
        echo "   Disk: {$template->disk}\n";
        echo "   Active: " . ($template->is_active ? "✅ YES" : "❌ NO") . "\n";
        echo "   Uploaded by: {$template->uploaded_by}\n";
        echo "   Created: {$template->created_at}\n";
        
        // Check file existence
        try {
            $disk = Storage::disk($template->disk);
            if ($disk->exists($template->file_path)) {
                $size = $disk->size($template->file_path);
                $sizeFormatted = $size >= 1048576 
                    ? round($size / 1048576, 2) . ' MB'
                    : round($size / 1024, 2) . ' KB';
                echo "   File: ✅ EXISTS ({$sizeFormatted})\n";
            } else {
                echo "   File: ❌ NOT FOUND\n";
            }
        } catch (\Exception $e) {
            echo "   File: ❌ ERROR checking: {$e->getMessage()}\n";
        }
        echo "\n";
    }
    
    // Check for active template
    echo "5. Checking active template...\n";
    $activeTemplate = DB::table('sk_templates')
        ->where('sk_type', $skType)
        ->where('is_active', true)
        ->whereNull('deleted_at')
        ->first();
    
    if (!$activeTemplate) {
        echo "   ❌ No active template found!\n\n";
        echo "   💡 SOLUTION:\n";
        echo "   Run this SQL to activate the most recent template:\n\n";
        
        $latestTemplate = $templates->first();
        if ($latestTemplate) {
            echo "   UPDATE sk_templates SET is_active = false WHERE sk_type = '{$skType}';\n";
            echo "   UPDATE sk_templates SET is_active = true WHERE id = {$latestTemplate->id};\n\n";
            echo "   Or use artisan command:\n";
            echo "   php artisan sk:activate-template {$latestTemplate->id}\n\n";
        }
        exit(1);
    }
    
    echo "   ✅ Active template: {$activeTemplate->original_filename} (ID: {$activeTemplate->id})\n\n";
    
    // Verify file exists for active template
    echo "6. Verifying active template file...\n";
    try {
        $disk = Storage::disk($activeTemplate->disk);
        if (!$disk->exists($activeTemplate->file_path)) {
            echo "   ❌ File NOT FOUND in storage!\n";
            echo "   Path: {$activeTemplate->file_path}\n";
            echo "   Disk: {$activeTemplate->disk}\n\n";
            echo "   💡 SOLUTION:\n";
            echo "   1. Re-upload the template file\n";
            echo "   2. Or activate a different template that has a valid file\n\n";
            exit(1);
        }
        
        $size = $disk->size($activeTemplate->file_path);
        $sizeFormatted = $size >= 1048576 
            ? round($size / 1048576, 2) . ' MB'
            : round($size / 1024, 2) . ' KB';
        echo "   ✅ File exists ({$sizeFormatted})\n\n";
        
        // Try to generate URL
        echo "7. Testing URL generation...\n";
        if ($activeTemplate->disk === 's3') {
            $url = $disk->temporaryUrl($activeTemplate->file_path, now()->addMinutes(60));
            
            // Replace MinIO internal URL with public URL if configured
            $minioPublicUrl = config('filesystems.disks.s3.url');
            $minioEndpoint = config('filesystems.disks.s3.endpoint');
            
            if ($minioPublicUrl && $minioEndpoint) {
                $url = str_replace(rtrim($minioEndpoint, '/'), rtrim($minioPublicUrl, '/'), $url);
            }
        } else {
            $url = $disk->url($activeTemplate->file_path);
        }
        
        echo "   ✅ URL generated successfully\n";
        echo "   URL: {$url}\n\n";
        
    } catch (\Exception $e) {
        echo "   ❌ Error: {$e->getMessage()}\n\n";
        exit(1);
    }
    
    echo "=== ✅ ALL CHECKS PASSED ===\n";
    echo "Template should be working correctly in the frontend.\n\n";
    echo "If the frontend still shows 'BELUM TERSEDIA', try:\n";
    echo "1. Clear browser cache\n";
    echo "2. Check browser console for errors\n";
    echo "3. Verify API endpoint: GET /api/sk-templates/active?sk_type=surat_permohonan\n\n";
    
} catch (\Exception $e) {
    echo "❌ ERROR: {$e->getMessage()}\n";
    echo "Stack trace:\n{$e->getTraceAsString()}\n";
    exit(1);
}
