<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class SafeExternalUrl implements ValidationRule
{
    public function __construct(private bool $allowLocalInTesting = true)
    {
    }

    /**
     * Run the validation rule.
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || empty($value)) {
            $fail('URL tidak valid.');
            return;
        }

        // 1. Basic URL syntax check
        if (! filter_var($value, FILTER_VALIDATE_URL)) {
            $fail('Format URL tidak valid.');
            return;
        }

        // 2. Protocol check: only http and https allowed
        $scheme = strtolower((string) parse_url($value, PHP_URL_SCHEME));
        if (! in_array($scheme, ['http', 'https'], true)) {
            $fail('Protokol URL harus berupa HTTP atau HTTPS.');
            return;
        }

        $host = parse_url($value, PHP_URL_HOST);
        if (! $host) {
            $fail('Host URL tidak valid.');
            return;
        }

        // Allow internal service hostnames when running in testing or development
        // or when configured via env
        $isLocalOrTesting = $this->allowLocalInTesting && app()->environment('local', 'testing');
        if ($isLocalOrTesting && in_array(strtolower($host), ['localhost', '127.0.0.1', 'gowa', 'minio', 'postgres'], true)) {
            return;
        }

        // 3. Resolve host to IP addresses
        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);

        if (empty($ips)) {
            $fail('Host URL tidak dapat diselesaikan ke alamat IP publik yang valid.');
            return;
        }

        foreach ($ips as $ip) {
            // Check for loopback, private ranges, link-local (cloud metadata)
            $isSafeIp = filter_var(
                $ip,
                FILTER_VALIDATE_IP,
                FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
            );

            // Explicit check for cloud metadata (169.254.169.254) and loopback
            if (
                ! $isSafeIp
                || str_starts_with($ip, '127.')
                || str_starts_with($ip, '169.254.')
                || str_starts_with($ip, '10.')
                || $ip === '0.0.0.0'
                || $ip === '::1'
            ) {
                $fail('URL tidak diizinkan mengarah ke alamat jaringan internal atau link-local (SSRF Protection).');
                return;
            }
        }
    }
}
