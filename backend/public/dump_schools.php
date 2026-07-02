<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$response = $kernel->handle(
    $request = Illuminate\Http\Request::capture()
);
$schools = \App\Models\School::whereIn('nama', ['MA Al Madinah Kroya', 'MI Ma\'arif 01 Sidaurip'])->get(['nama', 'status', 'status_jamiyyah']);
echo json_encode($schools);
