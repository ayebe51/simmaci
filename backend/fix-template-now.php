<?php

/**
 * Emergency fix script untuk aktivasi template surat permohonan
 * 
 * Cara pakai:
 * 1. Via artisan tinker:
 *    php artisan tinker
 *    include 'fix-template-now.php';
 * 
 * 2. Via web (temporary route):
 *    Tambahkan route di routes/web.php:
 *    Route::get('/fix-template', function() { include base_path('fix-template-now.php'); });
 *    Akses: https://domain.com/fix-template
 * 
 * 3. Via CLI langsung:
 *    cd backend && php fix-template-now.php
 */

// Bootstrap Laravel jika dijalankan via CLI
if (php_sapi_name() === 'cli' && !function_exists('app')) {
    require __DIR__ . '/vendor/autoload.php';
    $app = require_once __DIR__ . '/bootstrap/app.php';
    $app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();
}

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

echo "=== FIX TEMPLATE SURAT PERMOHONAN ===\n\n";

try {
    // Step 1: Cek template yang ada
    echo "1. Checking existing templates...\n";
    $templates = DB::table('sk_templates')
        ->where('sk_type', 'surat_permohonan')
        ->whereNull('deleted_at')
        ->orderByDesc('created_at')
        ->get();
    
    if ($templates->isEmpty()) {
        echo "   ❌ ERROR: No templates found!\n";
        echo "   Solution: Upload template via admin panel first.\n\n";
        exit(1);
    }
    
    echo "   ✅ Found {$templates->count()} template(s)\n\n";
    
    // Display templates
    foreach ($templates as $i => $t) {
        echo "   Template #" . ($i + 1) . ":\n";
        echo "   - ID: {$t->id}\n";
        echo "   - Filename: {$t->original_filename}\n";
        echo "   - Active: " . ($t->is_active ? 'YES' : 'NO') . "\n";
        echo "   - Created: {$t->created_at}\n";
        
        // Check file
        try {
            $disk = Storage::disk($t->disk);
            if ($disk->exists($t->file_path)) {
                echo "   - File: ✅ EXISTS\n";
            } else {
                echo "   - File: ❌ MISSING\n";
            }
        } catch (\Exception $e) {
            echo "   - File: ❌ ERROR: {$e->getMessage()}\n";
        }
        echo "\n";
    }
    
    // Step 2: Find the most recent template with valid file
    echo "2. Finding valid template to activate...\n";
    $validTemplate = null;
    foreach ($templates as $t) {
        try {
            $disk = Storage::disk($t->disk);
            if ($disk->exists($t->file_path)) {
                $validTemplate = $t;
                break;
            }
        } catch (\Exception $e) {
            continue;
        }
    }
    
    if (!$validTemplate) {
        echo "   ❌ ERROR: No valid templates found (all files missing)\n";
        echo "   Solution: Re-upload template via admin panel.\n\n";
        exit(1);
    }
    
    echo "   ✅ Found valid template: {$validTemplate->original_filename} (ID: {$validTemplate->id})\n\n";
    
    // Step 3: Activate the template
    echo "3. Activating template...\n";
    
    DB::beginTransaction();
    try {
        // Deactivate all templates of this type
        DB::table('sk_templates')
            ->where('sk_type', 'surat_permohonan')
            ->update(['is_active' => false]);
        
        // Activate the selected template
        DB::table('sk_templates')
            ->where('id', $validTemplate->id)
            ->update(['is_active' => true]);
        
        DB::commit();
        
        echo "   ✅ Template activated successfully!\n\n";
    } catch (\Exception $e) {
        DB::rollBack();
        echo "   ❌ ERROR: {$e->getMessage()}\n\n";
        exit(1);
    }
    
    // Step 4: Verify
    echo "4. Verifying...\n";
    $activeTemplate = DB::table('sk_templates')
        ->where('sk_type', 'surat_permohonan')
        ->where('is_active', true)
        ->whereNull('deleted_at')
        ->first();
    
    if ($activeTemplate) {
        echo "   ✅ Active template: {$activeTemplate->original_filename}\n";
        echo "   ✅ ID: {$activeTemplate->id}\n";
        echo "   ✅ File path: {$activeTemplate->file_path}\n\n";
        
        // Try to generate URL
        try {
            $disk = Storage::disk($activeTemplate->disk);
            if ($activeTemplate->disk === 's3') {
                $url = $disk->temporaryUrl($activeTemplate->file_path, now()->addMinutes(60));
            } else {
                $url = $disk->url($activeTemplate->file_path);
            }
            echo "   ✅ Download URL: {$url}\n\n";
        } catch (\Exception $e) {
            echo "   ⚠️  Warning: Could not generate URL: {$e->getMessage()}\n\n";
        }
        
        echo "=== ✅ SUCCESS ===\n";
        echo "Template is now active and should be available in the frontend.\n";
        echo "Try refreshing the page: https://simmaci.com/dashboard/sk/submit\n\n";
    } else {
        echo "   ❌ ERROR: Activation failed\n\n";
        exit(1);
    }
    
} catch (\Exception $e) {
    echo "❌ FATAL ERROR: {$e->getMessage()}\n";
    echo "Stack trace:\n{$e->getTraceAsString()}\n";
    exit(1);
}
