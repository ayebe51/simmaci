<?php

// Standalone execution script for FixMuhtaromGuruScores
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$args = array_slice($argv, 1);
$isDryRun = in_array('--dry-run', $args, true);

$params = [
    '--force'   => true,
    '--dry-run' => $isDryRun,
];

foreach ($args as $arg) {
    if (str_starts_with($arg, '--jury=')) {
        $params['--jury'] = substr($arg, 7);
    } elseif (str_starts_with($arg, '--competition=')) {
        $params['--competition'] = substr($arg, 14);
    } elseif (str_starts_with($arg, '--keep-jenjang=')) {
        $params['--keep-jenjang'] = substr($arg, 15);
    }
}

$exitCode = $kernel->call(\App\Console\Commands\FixMuhtaromGuruScores::class, $params);
echo $kernel->output();
exit($exitCode);
