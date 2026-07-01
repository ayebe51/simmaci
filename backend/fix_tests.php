<?php
$files = [
    'tests/Unit/SkDocumentNotificationTest.php',
    'tests/Feature/ActivityLoggingNormalizationTest.php',
    'tests/Feature/NormalizationActivityLogTest.php',
    'tests/Feature/NormalizationIntegrationTest.php',
    'tests/Feature/SkDocumentPreservationTest.php',
    'tests/Feature/SkSubmissionBugExplorationTest.php',
];

foreach ($files as $file) {
    $path = __DIR__ . '/' . $file;
    if (file_exists($path)) {
        $content = file_get_contents($path);
        
        // Regex replace MI, MA, SMP, SD, MTs, SMK, SMA followed by space or quote to RA
        $content = preg_replace("/\b(?:MI|MA|SMP|SD|MTs|SMK|SMA)\b/i", "RA", $content);
        
        file_put_contents($path, $content);
        echo "Updated regex: $file\n";
    } else {
        echo "Not found: $file\n";
    }
}
