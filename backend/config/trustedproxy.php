<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Trusted Proxies
    |--------------------------------------------------------------------------
    |
    | Set trusted proxies IP addresses or CIDR notations. Forwarded headers
    | from these proxies will be trusted to determine client IP and HTTPS scheme.
    |
    */

    'proxies' => env('TRUSTED_PROXIES', '127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16'),

    /*
    |--------------------------------------------------------------------------
    | Trusted Headers
    |--------------------------------------------------------------------------
    |
    | Bit field of Request::HEADER_* to trust from configured proxies.
    |
    */

    'headers' => \Illuminate\Http\Request::HEADER_X_FORWARDED_FOR |
                 \Illuminate\Http\Request::HEADER_X_FORWARDED_HOST |
                 \Illuminate\Http\Request::HEADER_X_FORWARDED_PORT |
                 \Illuminate\Http\Request::HEADER_X_FORWARDED_PROTO,

];
