<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for cross-origin resource sharing. Allows the React frontend
    | (running on a different port/domain) to access the Laravel API.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => app()->isProduction()
        ? explode(',', env('ALLOWED_ORIGINS', ''))
        : explode(',', env('ALLOWED_ORIGINS', env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000'))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
