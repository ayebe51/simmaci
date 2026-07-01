<?php
$files = [
    'backend/app/Http/Controllers/Api/SkDocumentController.php',
    'backend/app/Http/Controllers/Api/TeacherController.php',
    'backend/routes/api.php'
];

foreach ($files as $file) {
    if (file_exists($file)) {
        $content = file_get_contents($file);
        $content = str_replace(
            ['â€”'],
            ['—'],
            $content
        );
        file_put_contents($file, $content);
    }
}
echo "Done\n";
