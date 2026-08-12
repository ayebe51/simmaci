<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$request = Illuminate\Http\Request::create('/api/wa-blasts', 'GET', ['page' => 2]);
// Mock user
$user = App\Models\User::where('email', 'admin@simmaci.com')->first();
$request->setUserResolver(function() use ($user) { return $user; });
$controller = app(App\Http\Controllers\Api\WaBlastController::class);
$response = $controller->index($request);
echo $response->getContent();
