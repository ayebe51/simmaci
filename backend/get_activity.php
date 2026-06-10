<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Override DB config to use localhost
config(['database.connections.pgsql.host' => '127.0.0.1']);
config(['database.connections.pgsql.port' => '5432']);

$activities = App\Models\ActivityLog::where('event', 'import_update_teacher')->latest()->take(2)->get();
echo json_encode($activities);
