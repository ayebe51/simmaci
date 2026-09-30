<?php

namespace App\Support\Redis;

use Illuminate\Redis\Connectors\PhpRedisConnector;
use Illuminate\Support\Facades\Log;
use Throwable;

class ResilientPhpRedisConnector extends PhpRedisConnector
{
    /**
     * Create the Redis client instance with graceful fallback for WRONGPASS.
     *
     * In Docker / Coolify environments, Redis containers may run without authentication
     * (default Alpine nopass) or with a password. If a password mismatch occurs (WRONGPASS),
     * this connector falls back to unauthenticated connection instead of crashing the entire
     * application with 500 Server Error.
     *
     * @param  array  $config
     * @return \Redis
     */
    protected function createClient(array $config)
    {
        try {
            return parent::createClient($config);
        } catch (Throwable $e) {
            if (str_contains($e->getMessage(), 'WRONGPASS') && ! empty($config['password'])) {
                Log::warning('[Redis] Authentication returned WRONGPASS (Redis server is running without password or password mismatch). Retrying connection without password.');
                $config['password'] = null;
                $config['username'] = null;
                return parent::createClient($config);
            }

            throw $e;
        }
    }
}
