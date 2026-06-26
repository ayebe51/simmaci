<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Force DB connection to use 127.0.0.1 instead of db
config(['database.connections.pgsql.host' => '127.0.0.1']);
\Illuminate\Support\Facades\DB::purge('pgsql');

try {
    $school = App\Models\School::where('nama', 'like', '%Karangmangu%')->first();
    if (!$school) {
        echo "School not found\n";
        exit;
    }

    $teachers = App\Models\Teacher::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)->where('school_id', $school->id)->pluck('nama')->toArray();
    $sks = App\Models\SkDocument::where('school_id', $school->id)->pluck('nama')->unique()->toArray();

    echo "Teachers (" . count($teachers) . "):\n";
    foreach ($teachers as $t) {
        echo "- $t\n";
    }

    echo "\nSKs (" . count($sks) . "):\n";
    foreach ($sks as $sk) {
        echo "- $sk\n";
    }

    // Find SKs where name is not in teachers
    $missing = array_diff($sks, $teachers);
    echo "\nMissing Teachers (" . count($missing) . "):\n";
    foreach ($missing as $m) {
        echo "- $m\n";
        // Check if this teacher exists in DB at all
        $t = App\Models\Teacher::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)->where('nama', $m)->first();
        if ($t) {
            echo "  -> Found in DB with school_id = " . $t->school_id . "\n";
        } else {
            echo "  -> Not found in DB\n";
        }
    }
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
