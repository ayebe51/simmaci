<?php
putenv('DB_HOST=127.0.0.1');
putenv('DB_PORT=5433');
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$schools = \App\Models\School::where('name', 'like', '%Pucung lor%')
    ->orWhere('name', 'like', '%Pucunglor%')
    ->get();

if ($schools->isEmpty()) {
    echo "School not found\n";
} else {
    foreach ($schools as $school) {
        echo "====================================\n";
        echo "School: " . $school->name . " (ID: " . $school->id . ")\n";
        $teachers = \App\Models\Teacher::where('school_id', $school->id)->get();
        echo "Total teachers in DB for this school: " . $teachers->count() . "\n";
        foreach ($teachers as $t) {
            echo "- " . $t->name . " (ID: " . $t->id . ", Status: " . $t->status . ", NPK: " . $t->npk . ", NUPTK: " . $t->nuptk . ")\n";
        }
    }
}
