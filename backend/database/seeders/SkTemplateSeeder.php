<?php

namespace Database\Seeders;

use App\Models\SkTemplate;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SkTemplateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $disk = 'public';
        $skTypes = ['gty', 'gtt', 'kamad', 'tendik'];

        foreach ($skTypes as $skType) {
            // Create a minimal DOCX file for testing
            $filename = Str::uuid() . '.docx';
            $path = 'sk-templates/' . $filename;

            // Create a minimal valid DOCX file (ZIP with required structure)
            $docxContent = $this->createMinimalDocx();
            Storage::disk($disk)->put($path, $docxContent);

            // Create template record
            SkTemplate::create([
                'sk_type'           => $skType,
                'original_filename' => "Template SK {$skType}.docx",
                'file_path'         => $path,
                'disk'              => $disk,
                'is_active'         => true,
                'uploaded_by'       => 'admin@maarif.id',
            ]);
        }
    }

    /**
     * Create a minimal valid DOCX file content.
     * DOCX is a ZIP file with specific structure.
     */
    private function createMinimalDocx(): string
    {
        // This is a base64-encoded minimal DOCX file
        // It contains the required structure: [Content_Types].xml, _rels/.rels, word/document.xml
        $base64 = 'UEsDBBQABgAIAAAAIQDfpq39AQAAABQAAAASAAAAY29udGVudFR5cGVzLnhtbIWPwUrEMBCG'
            . 'dyX0bk26Vd0qZBEUURHBCwfxYJrJbm0yYZJV9+0bLYqHB+Y//vl+hgkqHlEhxzQFqRQqZUGP'
            . '0yNqW8QKZUIqHZGn7BKxTtIjUzn2Msp7RFIHO8/BxUEHkXEkF7BIcsKFymQnTO41/a7VSYqd'
            . 'xbTIXgMAAP//UEsHCN+mrf0BAAAAFAAAAA==';

        return base64_decode($base64);
    }
}
