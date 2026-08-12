<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

for ($i=1; $i<=35; $i++) {
    App\Models\WaBlast::create([
        'title' => 'Test Blast ' . $i,
        'recipient_category' => 'gtk',
        'message_body' => 'Test',
        'blast_status' => 'draft',
        'total_recipients' => 0,
        'sent_count' => 0,
        'failed_count' => 0,
        'invalid_count' => 0,
        'created_by' => 1
    ]);
}
echo 'Created 35 blasts.';
