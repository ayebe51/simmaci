#!/usr/bin/env php
<?php

use Illuminate\Foundation\Application;
use Symfony\Component\Console\Input\ArgvInput;

define('LARAVEL_START', microtime(true));

// 1. Autoloader
require __DIR__ . '/vendor/autoload.php';

// 2. Bootstrap Laravel
/** @var Application $app */
$app = require_once __DIR__ . '/bootstrap/app.php';

// 3. Prepare argv input for handleCommand
$rawArgs = array_slice($argv, 1);
$inputArgs = array_merge(['artisan', 'competition:check-festival-beregu'], $rawArgs);

$status = $app->handleCommand(new ArgvInput($inputArgs));

exit($status);
