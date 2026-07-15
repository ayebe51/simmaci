<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$ns = app(\App\Services\NormalizationService::class);
echo "Test 1: " . ($ns->parseIndonesianDate('12 Juli 2008') ?? 'NULL') . "\n";
echo "Test 2: " . ($ns->parseIndonesianDate('19 Juli 1999') ?? 'NULL') . "\n";
