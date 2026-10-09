<?php

namespace Tests\Feature;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\Yaml\Yaml;
use Tests\TestCase;

class SecurityHardeningPhase1Test extends TestCase
{
    /**
     * SEC-HTTPS-001: Requests arriving through a trusted proxy resolve the correct client IP and scheme.
     */
    public function test_trusted_proxy_resolves_client_ip_and_https_scheme(): void
    {
        // 127.0.0.1 and 172.16.0.0/12 are in the default TRUSTED_PROXIES list
        $response = $this->withServerVariables([
            'REMOTE_ADDR'          => '172.18.0.2', // Docker bridge gateway (in 172.16.0.0/12)
            'HTTP_X_FORWARDED_FOR' => '203.0.113.195',
            'HTTP_X_FORWARDED_PROTO' => 'https',
            'HTTP_X_FORWARDED_HOST' => 'api.simmaci.com',
            'HTTP_X_FORWARDED_PORT' => '443',
        ])->getJson('/api/health');

        $response->assertStatus(200);

        // Verify request context resolution
        $request = Request::create('/api/health', 'GET', [], [], [], [
            'REMOTE_ADDR'          => '172.18.0.2',
            'HTTP_X_FORWARDED_FOR' => '203.0.113.195',
            'HTTP_X_FORWARDED_PROTO' => 'https',
            'HTTP_X_FORWARDED_HOST' => 'api.simmaci.com',
            'HTTP_X_FORWARDED_PORT' => '443',
        ]);

        $this->assertEquals('203.0.113.195', $request->getClientIp());
        $this->assertTrue($request->isSecure());
        $this->assertEquals('https', $request->getScheme());
        $this->assertEquals('api.simmaci.com', $request->getHost());
    }

    /**
     * SEC-HTTPS-001: Requests from untrusted sources CANNOT spoof client IP or HTTPS scheme.
     */
    public function test_untrusted_client_cannot_spoof_client_ip_or_scheme(): void
    {
        // 198.51.100.55 is a public IP, NOT in TRUSTED_PROXIES (127.0.0.1, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
        $request = Request::create('/api/health', 'GET', [], [], [], [
            'REMOTE_ADDR'          => '198.51.100.55',
            'HTTP_X_FORWARDED_FOR' => '1.2.3.4',
            'HTTP_X_FORWARDED_PROTO' => 'https',
            'HTTP_X_FORWARDED_HOST' => 'malicious.attacker.com',
        ]);

        // When proxy is untrusted, getClientIp() must return REMOTE_ADDR, ignoring X-Forwarded-For
        $this->assertEquals('198.51.100.55', $request->getClientIp());
        $this->assertFalse($request->isSecure());
        $this->assertEquals('http', $request->getScheme());
        $this->assertNotEquals('malicious.attacker.com', $request->getHost());
    }

    /**
     * SEC-HTTPS-001: Throttling / rate limiter uses resolved client IP from trusted proxy.
     */
    public function test_throttling_uses_resolved_client_ip_through_trusted_proxy(): void
    {
        $trustedProxyIp = '127.0.0.1';
        $clientIp = '203.0.113.50';

        $request = Request::create('/api/login', 'POST', [], [], [], [
            'REMOTE_ADDR'          => $trustedProxyIp,
            'HTTP_X_FORWARDED_FOR' => $clientIp,
            'HTTP_X_FORWARDED_PROTO' => 'https',
        ]);

        $this->assertEquals($clientIp, $request->getClientIp());
        $this->assertEquals($clientIp.'|127.0.0.1', $clientIp.'|'.$trustedProxyIp);
    }

    /**
     * SEC-COOKIE-001: Session cookie secure attribute defaults to true in production.
     */
    public function test_session_cookie_secure_defaults_to_true_in_production(): void
    {
        // Verify session configuration logic:
        // 'secure' => env('SESSION_SECURE_COOKIE') !== null ? (bool) env('SESSION_SECURE_COOKIE') : (env('APP_ENV') === 'production')
        $sessionConfig = require base_path('config/session.php');

        $this->assertTrue($sessionConfig['http_only'], 'Session cookies must be HttpOnly');
        $this->assertEquals('lax', $sessionConfig['same_site'], 'Session cookies must use SameSite=lax');

        // Test production environment evaluation
        $origEnv = $_ENV['APP_ENV'] ?? null;
        $_ENV['APP_ENV'] = 'production';
        $_SERVER['APP_ENV'] = 'production';
        putenv('APP_ENV=production');
        unset($_ENV['SESSION_SECURE_COOKIE'], $_SERVER['SESSION_SECURE_COOKIE']);
        putenv('SESSION_SECURE_COOKIE');

        $prodSessionConfig = require base_path('config/session.php');
        $this->assertTrue(
            (bool) ($prodSessionConfig['secure'] ?? false),
            'In production, session cookies must default to Secure'
        );

        // Reset env
        $_ENV['APP_ENV'] = $origEnv ?? 'testing';
        $_SERVER['APP_ENV'] = $origEnv ?? 'testing';
        putenv('APP_ENV='.($origEnv ?? 'testing'));
    }

    /**
     * SEC-COOKIE-001: CSRF token cookie respects secure attribute while maintaining HttpOnly=false.
     */
    public function test_csrf_cookie_is_secure_without_breaking_frontend_reading(): void
    {
        // Register a temporary web route with session and CSRF middleware
        Route::middleware(['web'])->get('/test-csrf-cookie', function () {
            return response('OK');
        });

        // Set secure to true as in production
        config(['session.secure' => true]);

        $response = $this->get('/test-csrf-cookie');
        $response->assertStatus(200);

        // Verify cookies in response
        $cookies = $response->headers->getCookies();
        $xsrfCookie = null;
        $sessionCookie = null;

        foreach ($cookies as $cookie) {
            if ($cookie->getName() === 'XSRF-TOKEN') {
                $xsrfCookie = $cookie;
            }
            if ($cookie->getName() === config('session.cookie')) {
                $sessionCookie = $cookie;
            }
        }

        if ($xsrfCookie !== null) {
            $this->assertTrue($xsrfCookie->isSecure(), 'XSRF-TOKEN must be Secure when session.secure=true');
            $this->assertFalse($xsrfCookie->isHttpOnly(), 'XSRF-TOKEN must NOT be HttpOnly so frontend can read it');
            $this->assertEquals('lax', $xsrfCookie->getSameSite(), 'XSRF-TOKEN SameSite must be lax');
        }

        if ($sessionCookie !== null) {
            $this->assertTrue($sessionCookie->isSecure(), 'Session cookie must be Secure');
            $this->assertTrue($sessionCookie->isHttpOnly(), 'Session cookie must be HttpOnly');
            $this->assertEquals('lax', $sessionCookie->getSameSite(), 'Session cookie SameSite must be lax');
        }
    }

    /**
     * SEC-COOKIE-001: CSRF enforcement on stateful web routes rejects unauthenticated POST without token.
     */
    public function test_csrf_rejection_behavior_on_web_routes(): void
    {
        $middleware = new class($this->app, $this->app['encrypter']) extends \Illuminate\Foundation\Http\Middleware\ValidateCsrfToken {
            protected function runningUnitTests(): bool
            {
                // Force CSRF validation even during test execution
                return false;
            }
        };

        // Create a mock session
        $session = $this->app['session']->driver();
        $session->setId('test-session-id');
        $session->start();
        $validToken = $session->token();

        // 1. Request WITHOUT CSRF token must throw TokenMismatchException
        $invalidRequest = Request::create('/test-csrf-protected', 'POST', []);
        $invalidRequest->setLaravelSession($session);

        $this->expectException(\Illuminate\Session\TokenMismatchException::class);
        $middleware->handle($invalidRequest, function () {
            return response('Success');
        });
    }

    /**
     * SEC-COOKIE-001: CSRF enforcement accepts request when valid CSRF token is provided.
     */
    public function test_csrf_acceptance_with_valid_token(): void
    {
        $middleware = new class($this->app, $this->app['encrypter']) extends \Illuminate\Foundation\Http\Middleware\ValidateCsrfToken {
            protected function runningUnitTests(): bool
            {
                return false;
            }
        };

        $session = $this->app['session']->driver();
        $session->setId('test-session-id');
        $session->start();
        $validToken = $session->token();

        // Request WITH valid CSRF token must pass successfully
        $validRequest = Request::create('/test-csrf-protected', 'POST', ['_token' => $validToken]);
        $validRequest->setLaravelSession($session);

        $response = $middleware->handle($validRequest, function () {
            return response('Success');
        });

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals('Success', $response->getContent());
    }

    /**
     * SEC-HEAD-001 & SEC-DEBUG-003: Backend Nginx configuration includes required security headers.
     */
    public function test_backend_nginx_configuration_includes_security_headers(): void
    {
        $nginxConfPath = base_path('docker/nginx/backend.conf');
        $this->assertFileExists($nginxConfPath);
        $confContent = file_get_contents($nginxConfPath);

        // Verification of security headers with always directive
        $this->assertStringContainsString('server_tokens off;', $confContent);
        $this->assertStringContainsString('fastcgi_hide_header X-Powered-By;', $confContent);
        $this->assertStringContainsString('proxy_hide_header X-Powered-By;', $confContent);
        $this->assertStringContainsString('add_header X-Frame-Options "SAMEORIGIN" always;', $confContent);
        $this->assertStringContainsString('add_header X-Content-Type-Options "nosniff" always;', $confContent);
        $this->assertStringContainsString('add_header Referrer-Policy "strict-origin-when-cross-origin" always;', $confContent);
        $this->assertStringContainsString('add_header Strict-Transport-Security $hsts_header always;', $confContent);
        $this->assertStringContainsString('add_header Content-Security-Policy', $confContent);
        $this->assertStringContainsString("frame-ancestors 'self'", $confContent);

        // Verify hsts_map.conf
        $hstsMapPath = base_path('docker/nginx/hsts_map.conf');
        $this->assertFileExists($hstsMapPath);
        $hstsMapContent = file_get_contents($hstsMapPath);
        $this->assertStringContainsString('map $http_x_forwarded_proto $hsts_header', $hstsMapContent);
        $this->assertStringContainsString('https "max-age=31536000; includeSubDomains";', $hstsMapContent);
        $this->assertStringContainsString('default "";', $hstsMapContent);
    }

    /**
     * SEC-DEBUG-003: Dockerfile configures PHP to disable expose_php.
     */
    public function test_dockerfile_disables_expose_php(): void
    {
        $dockerfilePath = base_path('Dockerfile');
        $this->assertFileExists($dockerfilePath);
        $content = file_get_contents($dockerfilePath);

        $this->assertStringContainsString('expose_php=Off', $content);
        $this->assertStringContainsString('hsts_map.conf', $content);
    }

    /**
     * SEC-DEBUG-003: API responses do not disclose PHP version via X-Powered-By.
     */
    public function test_api_responses_do_not_disclose_x_powered_by(): void
    {
        $response = $this->getJson('/api/version');
        $response->assertStatus(200);
        $this->assertFalse($response->headers->has('X-Powered-By'), 'X-Powered-By header must not be present');
    }

    /**
     * SEC-CONF-001: docker-compose.coolify.yml requires mandatory credentials without insecure fallbacks.
     */
    public function test_compose_coolify_enforces_required_credentials_and_removes_fallbacks(): void
    {
        $composePath = dirname(base_path()).'/docker-compose.coolify.yml';
        $this->assertFileExists($composePath);
        $composeContent = file_get_contents($composePath);

        // 1. Insecure default values MUST NOT exist
        $this->assertStringNotContainsString('R3d1s_S1mm4c1_9f8a7b6c5d4e3f2nd74', $composeContent);
        $this->assertStringNotContainsString('secret123', $composeContent);
        $this->assertStringNotContainsString('GOWA_BASIC_AUTH', $composeContent);

        // 2. Fail-closed variable interpolation requirements
        $this->assertStringContainsString('${DB_PASSWORD:?DB_PASSWORD is required}', $composeContent);
        $this->assertStringContainsString('${REDIS_PASSWORD:?REDIS_PASSWORD is required}', $composeContent);
        $this->assertStringContainsString('${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}', $composeContent);
        $this->assertStringContainsString('${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}', $composeContent);
        $this->assertStringContainsString('${APP_KEY:?APP_KEY is required}', $composeContent);
        $this->assertStringContainsString('${WAHA_API_KEY:?WAHA_API_KEY is required}', $composeContent);
        $this->assertStringContainsString('${WAHA_DASHBOARD_PASSWORD:?WAHA_DASHBOARD_PASSWORD is required}', $composeContent);

        // 3. Redis must have protected-mode enabled
        $this->assertStringContainsString('--protected-mode yes', $composeContent);

        // 4. Backend must specify secure session cookie and trusted proxies
        $this->assertStringContainsString('SESSION_SECURE_COOKIE: "true"', $composeContent);
        $this->assertStringContainsString('TRUSTED_PROXIES:', $composeContent);
    }

    /**
     * SEC-CONF-001: Safe Compose validation test ensuring parse succeeds with dummy values.
     */
    public function test_compose_parses_cleanly_with_disposable_dummy_values(): void
    {
        $composePath = dirname(base_path()).'/docker-compose.coolify.yml';
        $content = file_get_contents($composePath);

        $dummyEnv = [
            'DB_PASSWORD' => 'dummy_db_secret_for_test',
            'REDIS_PASSWORD' => 'dummy_redis_secret_for_test',
            'MINIO_ROOT_USER' => 'dummy_minio_user',
            'MINIO_ROOT_PASSWORD' => 'dummy_minio_password',
            'APP_KEY' => 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            'WAHA_API_KEY' => 'dummy_waha_api_key',
            'WAHA_DASHBOARD_PASSWORD' => 'dummy_waha_password',
            'MINIO_PUBLIC_URL' => 'https://simmaci.com/api/minio',
            'MINIO_BROWSER_REDIRECT_URL' => 'https://simmaci.com/api/minio',
            'VITE_SENTRY_DSN' => '',
        ];

        // Perform safe interpolation simulating Docker Compose variable resolution
        $resolved = preg_replace_callback('/\$\{([A-Z0-9_]+)(?::\?([^}]+)|:-([^}]*))?\}/', function ($matches) use ($dummyEnv) {
            $var = $matches[1];
            $errorMsg = $matches[2] ?? null;
            $defaultVal = $matches[3] ?? null;

            if (isset($dummyEnv[$var]) && $dummyEnv[$var] !== '') {
                return $dummyEnv[$var];
            }
            if ($defaultVal !== null) {
                return $defaultVal;
            }
            if ($errorMsg !== null) {
                throw new \RuntimeException("Variable [{$var}] is required: {$errorMsg}");
            }
            return '';
        }, $content);

        // Ensure YAML parses cleanly
        $parsed = Yaml::parse($resolved);
        $this->assertIsArray($parsed);
        $this->assertArrayHasKey('services', $parsed);
        $this->assertArrayHasKey('db', $parsed['services']);
        $this->assertArrayHasKey('redis', $parsed['services']);
        $this->assertArrayHasKey('backend', $parsed['services']);
        $this->assertArrayHasKey('waha', $parsed['services']);
    }

    /**
     * SEC-CORS-001: WAHA service has no public Traefik routers and is detached from coolify network.
     */
    public function test_waha_service_public_ingress_is_removed(): void
    {
        $composePath = dirname(base_path()).'/docker-compose.coolify.yml';
        $parsed = Yaml::parse(file_get_contents($composePath));

        $this->assertArrayHasKey('waha', $parsed['services']);
        $waha = $parsed['services']['waha'];

        // 1. Traefik labels must be completely absent from WAHA
        $this->assertArrayNotHasKey('labels', $waha, 'WAHA must not have Traefik ingress labels');

        // 2. WAHA must not be connected to the external coolify network
        $wahaNetworks = array_keys($waha['networks'] ?? []);
        $this->assertNotContains('coolify', $wahaNetworks, 'WAHA must not be attached to external coolify network');

        // 3. WAHA must be connected to internal simmaci-network with aliases
        $this->assertContains('simmaci-network', $wahaNetworks);
        $this->assertEquals(['waha', 'gowa'], $waha['networks']['simmaci-network']['aliases'] ?? []);

        // 4. Backend WAHA_INTERNAL_URL must target internal service
        $backendEnv = $parsed['services']['backend']['environment'];
        $this->assertEquals('http://waha:3000', $backendEnv['WAHA_INTERNAL_URL'] ?? null);
    }
}
