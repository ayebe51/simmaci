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

    'allowed_origins' => (env('APP_ENV') === 'production')
        ? array_values(array_filter(array_map('trim', explode(',', env('ALLOWED_ORIGINS', env('CORS_ALLOWED_ORIGINS', ''))))))
        : array_values(array_filter(array_map('trim', explode(',', env('ALLOWED_ORIGINS', env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000')))))),


    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['Content-Disposition', 'Content-Length', 'X-Total-Count'],

    'max_age' => 0,

    'supports_credentials' => true,

];
