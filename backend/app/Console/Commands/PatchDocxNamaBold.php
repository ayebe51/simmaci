<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use App\Models\SkTemplate;

/**
 * Patches all active SK DOCX templates to ensure the {NAMA} placeholder
 * run has bold formatting (<w:b/> and <w:bCs/>) in its run properties.
 *
 * Bug fix for: Bug 2 — Nama tidak bold (placeholder {NAMA} missing <w:b/>)
 */
class PatchDocxNamaBold extends Command
{
    protected $signature   = 'sk:patch-nama-bold {--dry-run : Show what would be changed without writing}';
    protected $description = 'Add <w:b/> and <w:bCs/> to the {NAMA} placeholder run in all SK DOCX templates';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        $templates = SkTemplate::all();

        if ($templates->isEmpty()) {
            $this->warn('No SK templates found in the database.');
            return self::SUCCESS;
        }

        $this->info("Found {$templates->count()} template(s). Processing...");

        $patched = 0;
        $skipped = 0;
        $alreadyBold = 0;

        foreach ($templates as $template) {
            $disk = Storage::disk($template->disk);

            if (! $disk->exists($template->file_path)) {
                $this->warn("  [{$template->sk_type}] File not found: {$template->file_path} — skipping");
                $skipped++;
                continue;
            }

            $docxBytes = $disk->get($template->file_path);

            // A DOCX is a ZIP archive — use ZipArchive to read/write word/document.xml
            $tmpPath = sys_get_temp_dir() . '/patch_nama_' . uniqid() . '.docx';
            file_put_contents($tmpPath, $docxBytes);

            $zip = new \ZipArchive();
            if ($zip->open($tmpPath) !== true) {
                $this->error("  [{$template->sk_type}] Cannot open ZIP: {$template->file_path} — skipping");
                $skipped++;
                @unlink($tmpPath);
                continue;
            }

            $xmlContent = $zip->getFromName('word/document.xml');
            if ($xmlContent === false) {
                $this->warn("  [{$template->sk_type}] word/document.xml not found inside DOCX — skipping");
                $zip->close();
                $skipped++;
                @unlink($tmpPath);
                continue;
            }

            // Check if {NAMA} placeholder exists
            if (stripos($xmlContent, '{NAMA}') === false && stripos($xmlContent, '{ NAMA }') === false) {
                $this->warn("  [{$template->sk_type}] {NAMA} placeholder not found in document.xml — skipping");
                $zip->close();
                $skipped++;
                @unlink($tmpPath);
                continue;
            }

            // Check if bold is already applied to a run containing {NAMA}
            // Pattern: <w:r> ... <w:b/> ... {NAMA} or {NAMA} ... <w:b/>
            if (preg_match('/<w:r\b[^>]*>(?:(?!<\/w:r>).)*<w:b\/>(?:(?!<\/w:r>).)*\{NAMA\}(?:(?!<\/w:r>).)*<\/w:r>/si', $xmlContent) ||
                preg_match('/<w:r\b[^>]*>(?:(?!<\/w:r>).)*\{NAMA\}(?:(?!<\/w:r>).)*<w:b\/>(?:(?!<\/w:r>).)*<\/w:r>/si', $xmlContent)) {
                $this->line("  [{$template->sk_type}] {NAMA} already has <w:b/> — no change needed");
                $zip->close();
                $alreadyBold++;
                @unlink($tmpPath);
                continue;
            }

            $patchedXml = $this->patchNamaBold($xmlContent);

            if ($patchedXml === $xmlContent) {
                $this->warn("  [{$template->sk_type}] Could not locate {NAMA} run to patch — skipping");
                $zip->close();
                $skipped++;
                @unlink($tmpPath);
                continue;
            }

            if ($dryRun) {
                $this->info("  [{$template->sk_type}] [DRY RUN] Would patch {$template->file_path}");
                $zip->close();
                $patched++;
                @unlink($tmpPath);
                continue;
            }

            // Write patched XML back into the ZIP
            $zip->addFromString('word/document.xml', $patchedXml);
            $zip->close();

            // Write the patched DOCX back to storage
            $disk->put($template->file_path, file_get_contents($tmpPath));
            @unlink($tmpPath);

            $this->info("  [{$template->sk_type}] Patched: {$template->file_path}");
            $patched++;
        }

        $this->newLine();
        $this->info("Done. Patched: {$patched} | Already bold: {$alreadyBold} | Skipped: {$skipped}");

        return self::SUCCESS;
    }

    /**
     * Patches word/document.xml to add <w:b/> and <w:bCs/> to the run
     * containing the {NAMA} placeholder.
     *
     * Strategy:
     *   1. Find <w:r>...</w:r> runs that contain {NAMA} (possibly split across <w:t> tags).
     *   2. If the run has no <w:rPr>, insert <w:rPr><w:b/><w:bCs/></w:rPr> before the first child.
     *   3. If the run has <w:rPr> but no <w:b/>, inject <w:b/><w:bCs/> inside <w:rPr>.
     */
    private function patchNamaBold(string $xml): string
    {
        // Match a <w:r> run that contains {NAMA} (case-insensitive placeholder, may have spaces)
        // The run may contain <w:rPr>...</w:rPr> followed by <w:t>...</w:t>
        $pattern = '/(<w:r\b[^>]*>)((?:(?!<\/w:r>).)*?)(\{[\s]*NAMA[\s]*\})((?:(?!<\/w:r>).)*?)(<\/w:r>)/si';

        return preg_replace_callback($pattern, function (array $m) {
            $openTag  = $m[1]; // <w:r> or <w:r w:rsidR="...">
            $before   = $m[2]; // content before {NAMA}
            $nama     = $m[3]; // {NAMA}
            $after    = $m[4]; // content after {NAMA}
            $closeTag = $m[5]; // </w:r>

            $inner = $before . $nama . $after;

            // Case 1: run already has <w:rPr>
            if (preg_match('/<w:rPr\b/i', $inner)) {
                // Inject <w:b/><w:bCs/> inside existing <w:rPr> if not already present
                $inner = preg_replace_callback(
                    '/(<w:rPr\b[^>]*>)(.*?)(<\/w:rPr>)/si',
                    function (array $rpr) {
                        $rprOpen  = $rpr[1];
                        $rprInner = $rpr[2];
                        $rprClose = $rpr[3];

                        // Already has <w:b/> — leave as-is
                        if (stripos($rprInner, '<w:b/>') !== false ||
                            stripos($rprInner, '<w:b ') !== false) {
                            return $rpr[0];
                        }

                        // Prepend <w:b/><w:bCs/> inside <w:rPr>
                        return $rprOpen . '<w:b/><w:bCs/>' . $rprInner . $rprClose;
                    },
                    $inner
                );
            } else {
                // Case 2: no <w:rPr> — insert one before the first <w:t>
                $inner = preg_replace(
                    '/(<w:t\b)/i',
                    '<w:rPr><w:b/><w:bCs/></w:rPr>$1',
                    $inner,
                    1 // only first occurrence
                );
            }

            return $openTag . $inner . $closeTag;
        }, $xml) ?? $xml;
    }
}
