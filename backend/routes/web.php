<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Deprecated emergency route - permanently disabled
Route::get('/fix-template-emergency', function () {
    return response()->json(['message' => 'Endpoint ini sudah dinonaktifkan.'], 410);
})->middleware(['auth:sanctum', 'role:super_admin']);


