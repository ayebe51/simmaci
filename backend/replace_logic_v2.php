<?php
$file = 'd:\apss-source\SIMMACI\backend\app\Http\Controllers\Api\SkDocumentController.php';
$content = file_get_contents($file);

// Find the start of processBulkRequestSync
$pos = strpos($content, 'private function processBulkRequestSync');

if ($pos !== false) {
    $before = substr($content, 0, $pos);
    $after = substr($content, $pos);

    // Replace in $after
    $after = preg_replace('/[ \t]*\/\/ Early NIM uniqueness validation:.*?\}\s*\n/s', '', $after, 1);
    $after = preg_replace('/[ \t]*\/\/ When NIP is copied to NIM, validate the synced NIM for uniqueness as well.*?\}\s*\n/s', '', $after, 1);
    $after = preg_replace('/[ \t]*\/\/ NIM uniqueness validation: reject if NIM is already assigned to a different teacher.*?\}\s*\n/s', '', $after, 1);

$replacement = <<<PHP
            // Protect against data-entry typos: if identifier matches but name is completely different, don't overwrite!
            if (\$teacher) {
                \$excelBareName = mb_strtoupper(trim(\$this->normalizationService->parseAcademicDegreesPublic(\$teacherData['nama'])['name']), 'UTF-8');
                \$dbBareName = mb_strtoupper(trim(\$this->normalizationService->parseAcademicDegreesPublic(\$teacher->nama)['name']), 'UTF-8');
                
                if (\$excelBareName !== '' && \$dbBareName !== '') {
                    similar_text(\$excelBareName, \$dbBareName, \$percent);
                    if (\$percent < 60) {
                        \$teacher = null;
                    }
                }
            }

            if (!\$teacher) {
PHP;

    $after = preg_replace('/[ \t]*if \(!\$teacher\) \{/', $replacement . ' {', $after, 1);

    file_put_contents($file, $before . $after);
    echo "Done.";
} else {
    echo "Function not found.";
}
