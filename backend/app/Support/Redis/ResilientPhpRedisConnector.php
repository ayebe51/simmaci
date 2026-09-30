<?php

namespace App\Support\Redis;

use Illuminate\Redis\Connectors\PhpRedisConnector;
use Illuminate\Support\Facades\Log;
use Throwable;

class ResilientPhpRedisConnector extends PhpRedisConnector
{
    /**
     * Cache the successful password format across calls in the same request process.
     */
    protected static ?string $resolvedPassword = null;
    protected static bool $resolvedPasswordSet = false;

    /**
     * Create the Redis client instance with resilient multi-format credential resolution.
     *
     * In Docker / Coolify environments, Redis containers can run with:
     * 1. The exact password configured in env
     * 2. The password stripped of quotes (if entered with quotes in Coolify)
     * 3. The password with surrounding quotes (caused by shell/compose command quoting)
     * 4. The default fallback secret unquoted
     * 5. The default fallback secret with surrounding quotes
     * 6. No password (nopass)
     *
     * This connector tests the candidate formats and automatically locks onto
     * whichever one successfully authenticates, preventing 500/503 errors.
     *
     * @param  array  $config
     * @return \Redis
     */
    protected function createClient(array $config)
    {
        $rawPassword = $config['password'] ?? null;
        $envPassword = env('REDIS_PASSWORD');

        // Build list of all potential password candidates
        $rawCandidates = [
            static::$resolvedPasswordSet ? static::$resolvedPassword : null,
            'R3d1s_S1mm4c1_9f8a7b6c5d4e3f2nd74',
            '"R3d1s_S1mm4c1_9f8a7b6c5d4e3f2nd74"',
            $rawPassword,
            is_string($rawPassword) ? trim($rawPassword, " \t\n\r\0\x0B\"'") : null,
            is_string($rawPassword) && $rawPassword !== '' ? '"' . trim($rawPassword, '"\'') . '"' : null,
            $envPassword,
            is_string($envPassword) ? trim($envPassword, " \t\n\r\0\x0B\"'") : null,
            is_string($envPassword) && $envPassword !== '' ? '"' . trim($envPassword, '"\'') . '"' : null,
            'simmaci_redis_default_secret_2026',
            '"simmaci_redis_default_secret_2026"',
            null,
        ];

        // Deduplicate candidates preserving order
        $candidates = [];
        foreach ($rawCandidates as $c) {
            if (!in_array($c, $candidates, true)) {
                $candidates[] = $c;
            }
        }

        $lastException = null;

        foreach ($candidates as $candidate) {
            try {
                $testConfig = $config;
                $testConfig['password'] = $candidate;
                if ($candidate === null || $candidate === '') {
                    $testConfig['password'] = null;
                    $testConfig['username'] = null;
                }

                $client = parent::createClient($testConfig);

                // Ping to ensure authentication actually succeeded (throws if WRONGPASS or NOAUTH)
                $client->ping();

                // Save working password for future connections in this request
                static::$resolvedPassword = $candidate;
                static::$resolvedPasswordSet = true;

                return $client;
            } catch (Throwable $e) {
                $lastException = $e;
                $msg = $e->getMessage();

                // If authentication failed (wrong pass or no auth), try next candidate format
                if (str_contains($msg, 'WRONGPASS') || str_contains($msg, 'NOAUTH')) {
                    continue;
                }

                // If it's a network/host connection failure, fail immediately
                throw $e;
            }
        }

        throw $lastException;
    }
}
