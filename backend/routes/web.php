<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Temporary route for emergency template fix
// TODO: Remove after template is fixed
Route::get('/fix-template-emergency', function () {
    ob_start();
    include base_path('fix-template-now.php');
    $output = ob_get_clean();
    return '<pre>' . htmlspecialchars($output) . '</pre>';
})->middleware('auth:sanctum');
