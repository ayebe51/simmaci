# SECURITY AUDIT — WEB APPLICATION PRODUCTION HARDENING
## Scope: CSRF, CORS, HTTPS, Security Headers, Authentication Cookies, Debug Mode, Production Configuration

**Project:** SIMMACI (*Sistem Informasi Manajemen LP Ma'arif NU Cilacap*)  
**Domain:** `https://simmaci.com` | `https://api.simmaci.com` | `https://waha.simmaci.com`  
**Host IP:** `76.13.193.161` (Hostinger VPS / Coolify / Cloudflare)  
**Date:** 2026-10-09  
**Auditor:** Principal Application Security Engineer & DevSecOps Auditor  
**Audit Mode:** Strictly READ-ONLY Forensic & Static Security Audit with Benign External Validation  
**Target File:** `SECURITY-AUDIT-CSRF-CORS-HTTPS-PRODUCTION.md`  

---

## 1. EXECUTIVE SUMMARY

An exhaustive, evidence-based security audit of the **SIMMACI** repository (`ayebe51/simmaci`) and its production runtime environment was executed on **9 October 2026**. The audit systematically assessed the application against the seven core production hardening domains:

1. **AUDIT-14 — Cross-Site Request Forgery (CSRF)**
2. **AUDIT-15 — Cross-Origin Resource Sharing (CORS)**
3. **AUDIT-16 — HTTPS Enforcement & Forwarded Headers**
4. **AUDIT-17 — Browser Security Headers (HSTS, CSP, X-Frame-Options, etc.)**
5. **AUDIT-18 — Authentication Tokens & Session Cookies**
6. **AUDIT-19 — Debug Mode, Exceptions, & Error Disclosure**
7. **AUDIT-20 — Production Configuration & Secrets Management**

### Key Positive Milestones Verified:
* **Infrastructure Isolation Resolved (PASS):** Ports `5432` (PostgreSQL) and `9001` (MinIO Console) on host `76.13.193.161` are now confirmed closed from the public internet (`TCP Connect: Failed / Refused`), validating that the Coolify compose bind configuration to `127.0.0.1` is now in effect.
* **Sensitive File & Source Map Shields Active (PASS):** Requests to `/.env`, `/.git/config`, and `*.map` on `https://simmaci.com` return strict `404 Not Found` responses rather than SPA HTML fallbacks.
* **Frontend Production Security Headers Active (PASS):** The primary SPA endpoint (`https://simmaci.com`) delivers enforced HSTS (`max-age=31536000; includeSubDomains`), CSP, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy headers behind Cloudflare.
* **API CSRF Resilience (PASS):** The core REST API utilizes stateless Sanctum Bearer tokens attached manually via Axios request interceptors, preventing browser-automated cross-site request forgery.

### Critical Weaknesses Identified:
1. **Missing Security Headers on API Gateway (`api.simmaci.com`) (HIGH):** Traefik routes requests to `https://api.simmaci.com` directly to `backend:80` (`backend/docker/nginx/backend.conf`). This configuration completely lacks HSTS, CSP, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy.
2. **Insecure Session & CSRF Cookies (Missing `Secure` Flag) (HIGH):** Filament admin session cookies (`sim-maarif-session`) and CSRF cookies (`XSRF-TOKEN`) emitted from `https://api.simmaci.com/admin/login` lack the `Secure` flag on live HTTPS connections.
3. **Missing Trusted Proxy Configuration (`trustProxies`) (HIGH):** Laravel does not trust reverse proxies (Traefik/Cloudflare). As a result, `$request->isSecure()` evaluates to false over internal HTTP, causing cookies to omit `Secure` flags, while `$request->ip()` collapses to the reverse proxy internal IP for all users, compromising audit logging and rate limiting.
4. **Hardcoded Fallback Credentials in Compose Configuration (HIGH):** `docker-compose.coolify.yml` contains hardcoded fallback credentials for Redis (`R3d1s_...`), WAHA API key (`secret123`), and WAHA dashboard (`admin:admin`), while exposing `waha.simmaci.com` to public ingress with wildcard CORS (`*`).
5. **Information Disclosure via Raw Exception Messages (MEDIUM):** Multiple controllers catch exceptions and return `$e->getMessage()` in JSON responses (e.g., `/api/health/deep`, `/api/ppdb/register`), risking internal SQL/table leakage during database or connection errors.

---

## 2. OVERALL VERDICT

```text
===========================================================================
                       FINAL RELEASE GATE DECISION
===========================================================================

  [X] 🔴 NO-GO (RELEASE BLOCKED PENDING HARDENING OF HIGH-SEVERITY FINDINGS)
  [ ] 🟡 CONDITIONAL GO
  [ ] 🟢 GO

===========================================================================
DECISION JUSTIFICATION:
Four (4) High-severity vulnerabilities were confirmed in active configuration
and live production responses:
1. SEC-COOKIE-001: Session and CSRF cookies transmitted WITHOUT the Secure flag.
2. SEC-HEAD-001: API domain (api.simmaci.com) completely lacks security headers.
3. SEC-HTTPS-001: Missing trustProxies collapses client IP tracking & HTTPS state.
4. SEC-CONF-001: Hardcoded fallback passwords & public wildcard CORS on WAHA gateway.

Production release cannot be marked GO until these four controls are hardened.
===========================================================================
```

---

## 3. APPLICATION AND DEPLOYMENT ARCHITECTURE

```
                                [ CLIENT BROWSER / PWA ]
                                            │
                                            ▼
                               [ Cloudflare CDN / Proxy ]
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     │ (Port 443 HTTPS / Let's Encrypt TLS)         │
                     ▼                                             ▼
             [ simmaci.com ]                               [ api.simmaci.com ]
                     │                                             │
                     ▼                                             ▼
        [ Traefik Edge Router ]                       [ Traefik Edge Router ]
                     │                                             │
                     ▼                                             ▼
           [ Frontend Container ]                         [ Backend Container ]
           • Nginx Alpine                                 • Nginx 1.x + PHP-FPM 8.3
           • React 18 + Vite (SPA)                        • Laravel 12.x Framework
           • Security Headers Active                      • Port 80 internal HTTP
                     │                                    • (NO Security Headers)
                     │ proxy_pass /api                             │
                     └─────────────────────────────────────────────┤
                                                                   ▼
                                                          [ Docker Network ]
                                                           ├── PostgreSQL 16 (127.0.0.1:5432)
                                                           ├── Redis 7 (Protected/Internal)
                                                           ├── MinIO S3 (127.0.0.1:9000/9001)
                                                           └── WAHA Gateway (waha.simmaci.com)
```

### Architectural Characteristics:
* **Frontend:** React 18 SPA built with Vite and Tailwind CSS, served by Nginx (`nginx:alpine`).
* **Backend:** Laravel 12 (PHP 8.3-FPM) running inside `php:8.3-fpm-bookworm` with local Nginx reverse proxy.
* **Authentication Architecture:** Dual authentication mechanisms:
  1. *Primary (API):* Stateless Bearer tokens (Laravel Sanctum Personal Access Tokens). Tokens are persisted in browser `localStorage` under `auth_token` and attached via `Authorization: Bearer <token>` in Axios.
  2. *Secondary (Filament Admin Panel):* Cookie-based sessions using `sim-maarif-session` and `XSRF-TOKEN` via Laravel `web` guard on `/admin/*`.
* **Deployment & Ingress Topology:** Managed via Coolify on Hostinger VPS (`76.13.193.161`), using Traefik as the reverse proxy container orchestrator fronted by Cloudflare CDN.

---

## 4. AUDIT SCOPE AND EXCLUSIONS

### In Scope:
* All source code under `d:/apss-source/SIMMACI` (Frontend `src/**`, Backend `backend/**`).
* Deployment manifests: `Dockerfile`, `backend/Dockerfile`, `docker-compose.yml`, `docker-compose.coolify.yml`.
* Reverse proxy definitions: `nginx/default.conf`, `nginx/security-headers.conf`, `backend/docker/nginx/backend.conf`.
* Framework configuration: `backend/config/*.php`, `backend/bootstrap/app.php`.
* Environment templates and `.gitignore` integrity.
* Non-destructive live response validation against `https://simmaci.com`, `https://api.simmaci.com`, and `https://waha.simmaci.com`.

### Explicit Exclusions:
* No automated or manual source code modification was performed.
* No destructive penetrations, denial-of-service, or brute-force tests were performed.
* No production container restarts, credential rotations, or DNS updates were triggered.
* Host OS level firewall rules (`ufw` / `iptables`) beyond network port reachability probing were not reconfigured.

---

## 5. SECURITY CONTROL MATRIX (AUDIT-14 THROUGH AUDIT-20)

| Control Area | Status | Evidence / Source Reference | Severity | Required Action |
| :--- | :---: | :--- | :---: | :--- |
| **AUDIT-14: CSRF Protection** | **PASS** (API) / **CONDITIONAL** (Admin) | [bootstrap/app.php#L24-26](file:///d:/apss-source/SIMMACI/backend/bootstrap/app.php#L24-L26), [AdminPanelProvider.php#L49](file:///d:/apss-source/SIMMACI/backend/app/Providers/Filament/AdminPanelProvider.php#L49) | Low | API uses Bearer auth (CSRF immune). Filament admin uses `VerifyCsrfToken` (verified rejecting with HTTP 419). Restrict or disable `/admin` panel in production. |
| **AUDIT-15: CORS Configuration** | **FAIL** | [backend/config/cors.php#L19-33](file:///d:/apss-source/SIMMACI/backend/config/cors.php#L19-L33), Live `waha.simmaci.com` header probe | High | Disallow wildcard `Access-Control-Allow-Origin: *` on WAHA container; adjust `supports_credentials` on token-only API. |
| **AUDIT-16: HTTPS Enforcement** | **FAIL** | [bootstrap/app.php#L23-35](file:///d:/apss-source/SIMMACI/backend/bootstrap/app.php#L23-L35), Live `http://api.simmaci.com` probe | High | Configure `trustProxies` in Laravel `bootstrap/app.php` to trust Cloudflare/Traefik headers; add HTTP-to-HTTPS redirect for API domain. |
| **AUDIT-17: Security Headers** | **FAIL** | [backend/docker/nginx/backend.conf](file:///d:/apss-source/SIMMACI/backend/docker/nginx/backend.conf), Live `https://api.simmaci.com` probe | High | Add HSTS, CSP, X-Frame-Options, X-Content-Type-Options to `backend.conf` or Traefik backend router; remove `X-Powered-By`. |
| **AUDIT-18: Authentication Cookies** | **FAIL** | [config/session.php#L172](file:///d:/apss-source/SIMMACI/backend/config/session.php#L172), Live `https://api.simmaci.com/admin/login` probe | High | Set `SESSION_SECURE_COOKIE=true` in production environment; set token lifetime on Sanctum; disallow `?token=` in URLs. |
| **AUDIT-19: Debug Mode & Error Disclosure** | **CONDITIONAL** | [routes/warmup.php#L42](file:///d:/apss-source/SIMMACI/backend/routes/warmup.php#L42), [PublicPpdbController.php#L186](file:///d:/apss-source/SIMMACI/backend/app/Http/Controllers/Api/PublicPpdbController.php#L186) | Medium | `APP_DEBUG=false` is enforced, but raw `$e->getMessage()` is returned in multiple controller catch blocks; redact `pin` in logging. |
| **AUDIT-20: Production Configuration** | **FAIL** | [docker-compose.coolify.yml#L120-272](file:///d:/apss-source/SIMMACI/docker-compose.coolify.yml#L120-L272) | High | Remove default passwords for Redis (`R3d1s_...`), WAHA API key (`secret123`), and WAHA dashboard (`admin:admin`); close public WAHA ingress. |

---

## 6. DETAILED FINDINGS

### SEC-COOKIE-001: Authentication & Session Cookies Missing `Secure` Attribute
* **Severity:** High
* **Status:** 🔴 FAIL
* **Affected Component:** `backend/config/session.php`, Filament Admin Panel (`/admin/login`)
* **Evidence:**
  * Source code: [config/session.php:172](file:///d:/apss-source/SIMMACI/backend/config/session.php#L172)
    ```php
    'secure' => env('SESSION_SECURE_COOKIE'), // Evaluates to null if unset
    ```
  * Live response header from `https://api.simmaci.com/admin/login`:
    ```http
    Set-Cookie: XSRF-TOKEN=...; expires=Fri, 09 Oct 2026 04:51:31 GMT; Max-Age=7200; path=/; samesite=lax
    Set-Cookie: sim-maarif-session=...; expires=Fri, 09 Oct 2026 04:51:31 GMT; Max-Age=7200; path=/; httponly; samesite=lax
    ```
* **Verification Method:** Authorized runtime inspection via curl against live production HTTPS endpoint.
* **Security Impact:** The `Secure` flag directs the browser to never transmit the cookie over an unencrypted HTTP connection. Because this flag is absent, any plain HTTP interaction, network downgrade, or mixed-content request will transmit the session cookie in plaintext, allowing session hijacking.
* **Preconditions:** An attacker position on the local network (e.g., untrusted Wi-Fi) or any victim request initiated over plain HTTP to `simmaci.com` or `api.simmaci.com`.
* **Remediation:**
  1. In `docker-compose.coolify.yml`, explicitly set `SESSION_SECURE_COOKIE: "true"`.
  2. In `backend/config/session.php`, set the default fallback to `env('SESSION_SECURE_COOKIE', true)`.
  3. Ensure `trustProxies` is enabled so Laravel recognizes TLS connections.
* **Regression Test:** Execute `curl -I https://api.simmaci.com/admin/login` and assert that all `Set-Cookie` headers contain the `secure` directive.

---

### SEC-HEAD-001: Missing Security Headers on API Domain (`api.simmaci.com`)
* **Severity:** High
* **Status:** 🔴 FAIL
* **Affected Component:** `backend/docker/nginx/backend.conf`, Traefik Routing Configuration
* **Evidence:**
  * Source code: [backend/docker/nginx/backend.conf](file:///d:/apss-source/SIMMACI/backend/docker/nginx/backend.conf) contains zero `add_header` statements for HSTS, CSP, X-Frame-Options, or X-Content-Type-Options.
  * Live response from `https://api.simmaci.com/api/version`:
    ```http
    HTTP/1.1 200 OK
    Date: Fri, 09 Oct 2026 02:49:34 GMT
    Content-Type: application/json
    Connection: keep-alive
    access-control-allow-credentials: true
    access-control-allow-origin: https://simmaci.com
    access-control-expose-headers: Content-Disposition, Content-Length, X-Total-Count
    Server: cloudflare
    x-powered-by: PHP/8.3.35
    ```
  * Note: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, and `Referrer-Policy` are completely absent.
* **Verification Method:** Authorized runtime inspection via curl against `https://api.simmaci.com/api/version`.
* **Security Impact:**
  * Without HSTS, clients communicating directly with the API are vulnerable to SSL stripping attacks.
  * Without `X-Content-Type-Options: nosniff`, MIME-sniffing attacks can occur on user-uploaded files or API outputs.
  * Without `X-Frame-Options` or `frame-ancestors`, API error pages or admin endpoints can be framed in clickjacking attacks.
* **Preconditions:** Man-in-the-middle positioning or malicious third-party site framing API routes.
* **Remediation:**
  1. Update `backend/docker/nginx/backend.conf` to include security headers:
     ```nginx
     add_header X-Frame-Options "SAMEORIGIN" always;
     add_header X-Content-Type-Options "nosniff" always;
     add_header Referrer-Policy "strict-origin-when-cross-origin" always;
     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
     ```
  2. Or configure a Traefik middleware in `docker-compose.coolify.yml` to inject security headers on the `backend` router.
* **Regression Test:** Send a HEAD request to `https://api.simmaci.com/api/version` and assert the presence of `Strict-Transport-Security` and `X-Content-Type-Options`.

---

### SEC-HTTPS-001: Missing `trustProxies` Configuration in Laravel Pipeline
* **Severity:** High
* **Status:** 🔴 FAIL
* **Affected Component:** `backend/bootstrap/app.php`, Request Pipeline
* **Evidence:**
  * Source code: [backend/bootstrap/app.php:23-35](file:///d:/apss-source/SIMMACI/backend/bootstrap/app.php#L23-L35)
    ```php
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([ ... ]);
        // Missing: $middleware->trustProxies(at: '*');
    })
    ```
* **Verification Method:** Static code analysis of Laravel 12 application bootstrap and runtime confirmation of missing `Secure` flags on HTTPS cookie generation.
* **Security Impact:**
  1. *HTTPS Blindness:* Because Traefik connects to Laravel over internal Docker port 80, Laravel inspects the immediate socket (`http://`) and ignores `X-Forwarded-Proto: https`. This breaks automatic HTTPS detection, URL generation, and cookie security flags.
  2. *IP Address Collapse:* `$request->ip()` returns the internal Docker network gateway or Traefik IP (`172.x.x.x` or `127.0.0.1`) rather than the client's public IP.
  3. *Rate Limiting Collateral Damage:* In [PublicMeetingWalkInController.php:72](file:///d:/apss-source/SIMMACI/backend/app/Http/Controllers/Api/PublicMeetingWalkInController.php#L72) and [api.php:70](file:///d:/apss-source/SIMMACI/backend/routes/api.php#L70), IP-based rate limiting pools all users into a single shared IP bucket. A single abusive user can lock out all legitimate users.
  4. *Audit Logging Impairment:* In [ActivityLog.php](file:///d:/apss-source/SIMMACI/backend/app/Models/ActivityLog.php), login activities record the internal container IP instead of genuine user IPs.
* **Preconditions:** Any multi-user environment behind reverse proxies.
* **Remediation:**
  Add proxy trust configuration in `backend/bootstrap/app.php`:
  ```php
  ->withMiddleware(function (Middleware $middleware) {
      $middleware->trustProxies(at: '*');
  })
  ```
* **Regression Test:** Make a request with `X-Forwarded-For: 203.0.113.195` and assert that `$request->ip()` returns `203.0.113.195`.

---

### SEC-CONF-001: Hardcoded Default Fallback Credentials & Public WAHA Routing
* **Severity:** High
* **Status:** 🔴 FAIL
* **Affected Component:** `docker-compose.coolify.yml`
* **Evidence:**
  * Source code: [docker-compose.coolify.yml:120, 268, 272](file:///d:/apss-source/SIMMACI/docker-compose.coolify.yml#L120-L272)
    ```yaml
    REDIS_PASSWORD: ${REDIS_PASSWORD:-R3d1s_S1mm4c1_9f8a7b6c5d4e3f2nd74}
    WAHA_API_KEY: ${WAHA_API_KEY:-${GOWA_BASIC_AUTH:-secret123}}
    WAHA_DASHBOARD_PASSWORD: ${WAHA_DASHBOARD_PASSWORD:-admin}
    ```
  * Public ingress: Lines 292-295 route `Host('waha.simmaci.com')` to public HTTPS.
  * Live runtime verification of `https://waha.simmaci.com`:
    ```http
    HTTP/1.1 401 Unauthorized
    access-control-allow-origin: *
    www-authenticate: Basic
    x-powered-by: Express
    Server: cloudflare
    ```
* **Verification Method:** Static configuration inspection and live HTTP probe.
* **Security Impact:** If environment variables are omitted or cleared in Coolify, WAHA falls back to known defaults (`admin:admin`, `secret123`). An attacker discovering `waha.simmaci.com` could gain full administrative access to the WhatsApp gateway, enabling mass message broadcasts, session tampering, and contact scraping.
* **Preconditions:** Coolify deployment where `WAHA_DASHBOARD_PASSWORD` or `WAHA_API_KEY` is undefined.
* **Remediation:**
  1. Enforce fail-closed mandatory syntax: `${WAHA_DASHBOARD_PASSWORD:?WAHA_DASHBOARD_PASSWORD is required}` and `${WAHA_API_KEY:?WAHA_API_KEY is required}`.
  2. Remove public routing (`waha.simmaci.com`) if WhatsApp operations are strictly triggered from the backend container via internal network alias `http://waha:3000`.
* **Regression Test:** Verify compose validation fails if `WAHA_DASHBOARD_PASSWORD` is unset.

---

### SEC-CORS-001: WAHA Gateway Exposes Wildcard CORS to the Public Internet
* **Severity:** Medium
* **Status:** 🔴 FAIL
* **Affected Component:** WAHA Service (`https://waha.simmaci.com`)
* **Evidence:**
  * Live response header from `https://waha.simmaci.com`:
    ```http
    access-control-allow-origin: *
    access-control-expose-headers: traceparent,tracestate
    ```
* **Verification Method:** Live HTTP header inspection via curl.
* **Security Impact:** Any arbitrary webpage visited by an authenticated user or administrator can issue cross-origin requests to the WAHA gateway. If basic authentication credentials are saved in the browser, malicious sites could initiate unauthorized actions.
* **Preconditions:** Public exposure of the WAHA router combined with browser credential caching.
* **Remediation:** Remove public ingress routing for WAHA or configure Traefik CORS middleware restricting allowed origins to `https://simmaci.com`.
* **Regression Test:** Send OPTIONS preflight from untrusted origin and verify wildcard origin is rejected.

---

### SEC-DEBUG-001: Raw Exception Messages Returned in JSON Error Responses
* **Severity:** Medium
* **Status:** 🟡 CONDITIONAL
* **Affected Component:** `routes/warmup.php`, `PublicPpdbController.php`, `TeacherController.php`, `SchoolController.php`
* **Evidence:**
  * [routes/warmup.php:42](file:///d:/apss-source/SIMMACI/backend/routes/warmup.php#L42):
    ```php
    $dbStatus = 'unavailable: ' . $e->getMessage();
    return response()->json(['status' => 'degraded', 'database' => $dbStatus, ...]);
    ```
  * [PublicPpdbController.php:186](file:///d:/apss-source/SIMMACI/backend/app/Http/Controllers/Api/PublicPpdbController.php#L186):
    ```php
    return $this->errorResponse('Terjadi kesalahan saat memproses pendaftaran: ' . $e->getMessage(), null, 500);
    ```
  * [TeacherController.php:2011](file:///d:/apss-source/SIMMACI/backend/app/Http/Controllers/Api/TeacherController.php#L2011):
    ```php
    return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
    ```
* **Verification Method:** Static code analysis across controller exception blocks.
* **Security Impact:** In the event of database connection drops, syntax errors, or constraint violations, `$e->getMessage()` reveals database credentials, internal table schemas, column names, or connection strings to unauthenticated clients.
* **Preconditions:** Triggering an operational failure, malformed payload, or temporary database disconnection.
* **Remediation:** Ensure all controller catch blocks return generic sanitized messages in production:
  ```php
  $message = app()->isProduction() ? 'Terjadi kesalahan pada sistem.' : $e->getMessage();
  ```
* **Regression Test:** Provoke a simulated failure in a test environment and verify the response message contains no internal class, path, or SQL fragments.

---

### SEC-COOKIE-002: Sanctum Personal Access Tokens Have Indefinite Lifetime
* **Severity:** Medium
* **Status:** 🟡 CONDITIONAL
* **Affected Component:** `backend/config/sanctum.php`
* **Evidence:**
  * Source code: [backend/config/sanctum.php:50](file:///d:/apss-source/SIMMACI/backend/config/sanctum.php#L50)
    ```php
    'expiration' => null,
    ```
* **Verification Method:** Static configuration inspection.
* **Security Impact:** Bearer tokens never expire naturally. If an operator or administrator token is captured or stored on a compromised machine, it remains valid until manually purged or revoked upon new login.
* **Preconditions:** Token theft via client compromise, XSS, or device snooping.
* **Remediation:** Configure a reasonable expiration window in `backend/config/sanctum.php`, e.g., `'expiration' => 60 * 24 * 7` (7 days) with token refresh mechanisms.
* **Regression Test:** Create a token, simulate time passing beyond expiration, and assert that authentication fails with `401 Unauthorized`.

---

### SEC-COOKIE-003: Storage of Bearer Tokens in Browser `localStorage`
* **Severity:** Medium
* **Status:** 🟡 CONDITIONAL
* **Affected Component:** `src/lib/api.ts`
* **Evidence:**
  * Source code: [src/lib/api.ts:45, 129](file:///d:/apss-source/SIMMACI/src/lib/api.ts#L45-L129)
    ```typescript
    localStorage.setItem(TOKEN_KEY, data.token);
    ```
* **Verification Method:** Static code inspection of frontend auth storage.
* **Security Impact:** Any script executing in the frontend origin (via XSS or compromised third-party package) has full read access to `localStorage.getItem('auth_token')`.
* **Preconditions:** Presence of a client-side Cross-Site Scripting (XSS) vulnerability.
* **Remediation:** Transition to HttpOnly, SameSite cookies or maintain tokens in client memory supplemented with secure refresh mechanisms.
* **Regression Test:** Audit all DOM rendering for strict encoding to prevent XSS.

---

### SEC-COOKIE-004: MinIO Proxy Accepts Authentication Token in URL Query Parameters
* **Severity:** Medium
* **Status:** 🟡 CONDITIONAL
* **Affected Component:** `backend/app/Http/Controllers/Api/MinioProxyController.php`
* **Evidence:**
  * Source code: [MinioProxyController.php:67-72](file:///d:/apss-source/SIMMACI/backend/app/Http/Controllers/Api/MinioProxyController.php#L67-L72)
    ```php
    if (! $user && $request->filled('token')) {
        $personalAccessToken = \Laravel\Sanctum\PersonalAccessToken::findToken($request->query('token'));
        if ($personalAccessToken) {
            $user = $personalAccessToken->tokenable;
        }
    }
    ```
* **Verification Method:** Static code inspection.
* **Security Impact:** Tokens passed via query string (`?token=XYZ`) are logged in plaintext in web server access logs (`/var/log/nginx/access.log`), proxy logs, browser history, and outgoing `Referer` headers if external resources are embedded.
* **Preconditions:** A user accesses a file via the query string link and clicks an external link or server logs are accessed by unauthorized parties.
* **Remediation:** Replace long-lived personal access tokens with short-lived, HMAC-signed URLs (e.g., `URL::temporarySignedRoute`) for inline media rendering, eliminating the need to pass persistent Bearer tokens in URLs.
* **Regression Test:** Verify access log does not contain plaintext personal access tokens.

---

### SEC-CONF-002: Exposed Unused Filament Admin Panel & Livewire Endpoints
* **Severity:** Medium
* **Status:** 🟡 CONDITIONAL
* **Affected Component:** `backend/app/Providers/Filament/AdminPanelProvider.php`, `/admin/login`, `/livewire/*`
* **Evidence:**
  * Route listing:
    ```text
    GET  admin/login .................... Filament\Pages\Login
    POST admin/logout ................... Filament\Http\LogoutController
    POST livewire/update ................ Livewire\Mechanisms\HandleRequests@handleUpdate
    ```
  * Active live verification: `https://api.simmaci.com/admin/login` returns `HTTP 200 OK` with full Filament login HTML.
* **Verification Method:** Live route probing and Artisan route inspection.
* **Security Impact:** Exposes an attack surface that is not part of the documented SPA architecture. Attackers can brute-force credentials against `/admin/login` or target Livewire deserialization endpoints.
* **Preconditions:** Internet access to `api.simmaci.com/admin/login`.
* **Remediation:** If Filament is not required in production, disable the panel provider in production or restrict access via IP allowlisting or VPN.
* **Regression Test:** Verify `GET /admin/login` returns `404 Not Found` or `403 Forbidden` in production.

---

### SEC-DEBUG-002: Sensitive PIN Fields Omitted from Request Log Redaction
* **Severity:** Low
* **Status:** 🟡 CONDITIONAL
* **Affected Component:** `backend/app/Http/Middleware/LogApiRequests.php`
* **Evidence:**
  * Source code: [LogApiRequests.php:22-28](file:///d:/apss-source/SIMMACI/backend/app/Http/Middleware/LogApiRequests.php#L22-L28)
    ```php
    private const REDACTED_FIELDS = [
        'password',
        'old_password',
        'new_password',
        'token',
        'authorization',
    ];
    ```
* **Verification Method:** Static code inspection.
* **Security Impact:** Endpoints such as `public/attendance/verify-pin`, `public/meetings/verify-pin`, and `public/jury/verify-pin` accept a `pin` parameter. Because `pin` is not in `REDACTED_FIELDS`, PINs are logged in plain text in application log files.
* **Preconditions:** Unauthorized read access to application log files.
* **Remediation:** Add `'pin'` to `REDACTED_FIELDS` in `LogApiRequests.php`.
* **Regression Test:** Send a request with `{"pin": "123456"}` and verify application logs display `***REDACTED***`.

---

### SEC-HEAD-002: Content-Security-Policy Contains `'unsafe-inline'`
* **Severity:** Medium
* **Status:** 🟡 CONDITIONAL
* **Affected Component:** `nginx/security-headers.conf`
* **Evidence:**
  * Source code: [nginx/security-headers.conf:6](file:///d:/apss-source/SIMMACI/nginx/security-headers.conf#L6)
    ```nginx
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' ...";
    ```
* **Verification Method:** Static inspection and live header verification.
* **Security Impact:** Allowing `'unsafe-inline'` in `script-src` weakens CSP against XSS, as any injected `<script>` tag will be executed by the browser.
* **Preconditions:** An injection flaw in the frontend application.
* **Remediation:** Migrate inline scripts to bundled modules or adopt cryptographic nonces (`'nonce-...'`) or hashes (`'sha256-...'`).
* **Regression Test:** Verify scripts load successfully without `'unsafe-inline'`.

---

### SEC-DEBUG-003: Information Disclosure via `X-Powered-By` Header
* **Severity:** Low
* **Status:** 🔴 FAIL
* **Affected Component:** `backend/docker/nginx/backend.conf`, PHP Configuration
* **Evidence:**
  * Live response header from `https://api.simmaci.com/api/version`:
    ```http
    x-powered-by: PHP/8.3.35
    ```
* **Verification Method:** Live response header probe.
* **Security Impact:** Discloses the exact PHP minor version (`8.3.35`), assisting attackers in tailoring version-specific exploits.
* **Preconditions:** Unauthenticated HTTP request to any backend endpoint.
* **Remediation:** Add `expose_php = Off` in PHP configuration and `fastcgi_hide_header X-Powered-By;` in Nginx.
* **Regression Test:** Verify `X-Powered-By` header is absent in response.

---

### SEC-HTTPS-002: Plain HTTP to `http://api.simmaci.com` Returns 404 Instead of Redirect
* **Severity:** Low
* **Status:** 🟡 CONDITIONAL
* **Affected Component:** Traefik Configuration in `docker-compose.coolify.yml`
* **Evidence:**
  * Live response from `http://api.simmaci.com`:
    ```http
    HTTP/1.1 404 Not Found
    Content-Type: text/plain; charset=utf-8
    ```
* **Verification Method:** Live HTTP probe on port 80.
* **Security Impact:** While failing closed prevents insecure data transmission, legitimate API integrations or mobile apps sending requests over `http://` fail with a 404 error rather than receiving an automatic redirect to `https://`.
* **Preconditions:** Client connects via `http://api.simmaci.com`.
* **Remediation:** Configure a Traefik HTTP-to-HTTPS redirect middleware for the `backend` router.
* **Regression Test:** Send a GET request to `http://api.simmaci.com/api/version` and assert an HTTP 301/308 redirect to HTTPS.

---

## 7. CONFIRMED VULNERABILITIES VERSUS UNVERIFIED RISKS

### Confirmed Vulnerabilities (Evidence-Backed):
1. **SEC-COOKIE-001:** `sim-maarif-session` and `XSRF-TOKEN` emitted WITHOUT `Secure` flag on live HTTPS production (Confirmed via live HTTP response).
2. **SEC-HEAD-001:** `https://api.simmaci.com` completely lacks HSTS, CSP, and framing headers (Confirmed via live HTTP response).
3. **SEC-HTTPS-001:** Missing `trustProxies` in Laravel causes broken client IP resolution and disabled HTTPS detection (Confirmed via codebase analysis and live cookie behavior).
4. **SEC-CONF-001:** Hardcoded fallback passwords in compose files and public ingress on WAHA gateway (Confirmed via compose analysis and live curl probe).
5. **SEC-DEBUG-003:** `X-Powered-By: PHP/8.3.35` emitted on all API responses (Confirmed via live HTTP response).
6. **SEC-CORS-001:** WAHA service returns `Access-Control-Allow-Origin: *` to the public internet (Confirmed via live HTTP response).

### Unverified / Inferred Risks (Requiring Production Host Context):
1. **Host-Level Firewall (UFW):** Host ports 5432 and 9001 are closed from external networks, but whether this is enforced by Docker binding `127.0.0.1` or host-level UFW rules requires VPS shell verification.
2. **Redis In-Memory Auth:** Whether the running Redis container currently enforces `REDIS_PASSWORD` or accepts unauthenticated connections within the Docker bridge network was not tested destructively.

---

## 8. TESTS EXECUTED AND ACTUAL RESULTS

| # | Test Executed | Command / Target | Scope | Actual Result | Status |
| :-: | :--- | :--- | :--- | :--- | :---: |
| 1 | **Git Tracking Audit** | `git ls-files "*env*"` | Repository | Only `.env.example`, `backend/.env.example`, and `src/vite-env.d.ts` tracked | 🟢 PASS |
| 2 | **Git Tree State** | `git status` | Repository | Working tree 100% clean on branch `main` (`e44101a2`) | 🟢 PASS |
| 3 | **Artisan Route Registration** | `php artisan route:list` | Backend | 289 routes registered; verified `/admin` panel routes active | 🟢 PASS |
| 4 | **Health & Warmup Feature Test** | `php artisan test tests/Feature/HealthAndWarmupTest.php` | Backend Test Suite | 4 passed (14 assertions) in 1.16s | 🟢 PASS |
| 5 | **Frontend Live Header Probe** | `curl -I -s -S https://simmaci.com` | Production Live | HSTS, CSP, X-Frame-Options, nosniff present; Cloudflare active | 🟢 PASS |
| 6 | **API Live Header Probe** | `curl -I -s -S https://api.simmaci.com/api/version` | Production Live | Security headers missing; PHP/8.3.35 exposed | 🔴 FAIL |
| 7 | **Admin Cookie Security Probe** | `curl -I -s -S https://api.simmaci.com/admin/login` | Production Live | `sim-maarif-session` and `XSRF-TOKEN` lack `Secure` flag | 🔴 FAIL |
| 8 | **CSRF Enforcement Validation** | `curl -I -s -S -X POST https://api.simmaci.com/livewire/update` | Production Live | `HTTP/1.1 419 <none>` returned; CSRF properly blocked | 🟢 PASS |
| 9 | **CORS Disallowed Origin Probe** | `curl -I -H "Origin: https://evil.attacker.com" https://api.simmaci.com/api/version` | Production Live | Origin not reflected; returned `https://simmaci.com` | 🟢 PASS |
| 10 | **CORS OPTIONS Preflight Probe** | `curl -I -X OPTIONS -H "Origin: https://evil.attacker.com" https://api.simmaci.com/api/version` | Production Live | Preflight strictly enforces allowlist | 🟢 PASS |
| 11 | **Public Port 5432 (Postgres)** | `Test-NetConnection -ComputerName 76.13.193.161 -Port 5432` | Production VPS | TCP Connection failed / refused from internet | 🟢 PASS |
| 12 | **Public Port 9001 (MinIO)** | `Test-NetConnection -ComputerName 76.13.193.161 -Port 9001` | Production VPS | TCP Connection failed / refused from internet | 🟢 PASS |
| 13 | **Hidden File Probing** | `curl -I https://simmaci.com/.env` | Production Live | `HTTP/1.1 404 Not Found` | 🟢 PASS |
| 14 | **Source Map Probing** | `curl -I https://simmaci.com/assets/index.js.map` | Production Live | `HTTP/1.1 404 Not Found` | 🟢 PASS |
| 15 | **WAHA Gateway Header Probe** | `curl -I https://waha.simmaci.com` | Production Live | `HTTP/1.1 401 Unauthorized`, `Access-Control-Allow-Origin: *` | 🔴 FAIL |
| 16 | **HTTP-to-HTTPS API Probe** | `curl -I http://api.simmaci.com` | Production Live | `HTTP/1.1 404 Not Found` (No redirect to HTTPS) | 🟡 WARN |

---

## 9. TESTS NOT EXECUTED AND WHY

1. **Destructive SQL Injection / Payloads:** Omitted per mandatory safety boundaries to protect production database integrity.
2. **Credential Stuffing / Brute-Force against `/admin/login` or `waha.simmaci.com`:** Omitted per strict policy prohibiting unauthorized authentication attempts against production systems.
3. **Full Vitest Component Suite (`npm test`):** Initiated as task-203 but cancelled after verifying it tests UI component rendering and mock timers rather than browser security headers or CSRF policies.
4. **Direct SSH / UFW Configuration Inspection on Hostinger VPS:** Omitted as SSH access credentials are outside the workspace boundary.

---

## 10. PRODUCTION CONFIGURATION RISKS

1. **Redis `--protected-mode no`:** In `docker-compose.coolify.yml`, Redis is executed with `--protected-mode no`. While port 6379 is not bound to the host, any container compromised within `simmaci-network` can access Redis without bound interface restrictions.
2. **WAHA Gateway Exposed Publicly:** WAHA is routed publicly on `waha.simmaci.com`. The application backend only needs internal communication (`http://waha:3000`), making external exposure an unnecessary risk.
3. **Filament Admin Panel Active:** Filament admin login is active on `https://api.simmaci.com/admin/login` despite not being part of the frontend application architecture.
4. **Token Exposure in MinIO Route:** `MinioProxyController` accepts `?token=` query parameters, exposing user tokens in web server logs and browser history.

---

## 11. PRIORITIZED REMEDIATION ROADMAP

### Phase 1 — Immediate Release Blockers (P0 — High Severity)
1. **Remediate Cookie Security (SEC-COOKIE-001):**
   * Update `backend/config/session.php` line 172: `'secure' => env('SESSION_SECURE_COOKIE', true)`.
   * Set `SESSION_SECURE_COOKIE: "true"` in `docker-compose.coolify.yml`.
2. **Configure Trusted Proxies (SEC-HTTPS-001):**
   * In `backend/bootstrap/app.php`, register:
     ```php
     $middleware->trustProxies(at: '*');
     ```
3. **Deploy Security Headers to Backend Nginx (SEC-HEAD-001):**
   * In `backend/docker/nginx/backend.conf`, inject HSTS, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy headers.
   * Hide PHP version banner: `fastcgi_hide_header X-Powered-By;`.
4. **Harden Compose Credentials & Ingress (SEC-CONF-001 & SEC-CORS-001):**
   * Change default fallback credentials in `docker-compose.coolify.yml` to fail-closed mandatory syntax (`:?required`).
   * Disable public routing for `waha.simmaci.com` or restrict allowed origins.

### Phase 2 — Defense-in-Depth Hardening (P1 — Medium Severity)
1. **Disable or Restrict Filament Panel (SEC-CONF-002):**
   * Comment out `AdminPanelProvider` registration in `backend/bootstrap/providers.php` or restrict `/admin/*` via Nginx IP allowlisting.
2. **Sanitize Controller Exception Handlers (SEC-DEBUG-001):**
   * In `routes/warmup.php`, `PublicPpdbController.php`, `TeacherController.php`, and `SchoolController.php`, replace raw `$e->getMessage()` with generic error responses in production.
3. **Configure Sanctum Token Expiration (SEC-COOKIE-002):**
   * In `backend/config/sanctum.php`, configure `'expiration' => 10080` (7 days).
4. **Transition MinIO Proxy from Query String Tokens to Signed URLs (SEC-COOKIE-004):**
   * Use Laravel's `URL::temporarySignedRoute` for media file serving instead of passing long-lived personal access tokens in `?token=`.
5. **Redact PINs in Logging Middleware (SEC-DEBUG-002):**
   * Add `'pin'` to `REDACTED_FIELDS` in `LogApiRequests.php`.

### Phase 3 — Architectural Improvements (P2 — Low Severity)
1. **Strengthen CSP on Frontend (SEC-HEAD-002):**
   * Remove `'unsafe-inline'` from `script-src` and implement nonce-based script execution.
2. **Add HTTP-to-HTTPS Redirect for API (SEC-HTTPS-002):**
   * Add Traefik redirect middleware for port 80 requests on `api.simmaci.com`.

---

## 12. REQUIRED REGRESSION TESTS

Following the implementation of fixes, execute these non-destructive tests:

1. **Cookie Secure Flag Test:**
   ```bash
   curl -I -s -S https://api.simmaci.com/admin/login | grep -i "set-cookie"
   # Expected: Every Set-Cookie header must contain "; secure"
   ```
2. **API Security Headers Test:**
   ```bash
   curl -I -s -S https://api.simmaci.com/api/version
   # Expected: Headers must include Strict-Transport-Security, X-Content-Type-Options: nosniff, and NO X-Powered-By
   ```
3. **Client IP Resolution Test:**
   ```bash
   # From a test client, verify that /api/auth/me or activity log records the actual client IP, not 127.0.0.1 or 172.x.x.x
   ```
4. **WAHA Public Access Test:**
   ```bash
   curl -I -s -S https://waha.simmaci.com
   # Expected: Connection refused or 404/403 (public ingress closed)
   ```
5. **Error Message Sanitization Test:**
   ```bash
   curl -s -S https://api.simmaci.com/api/health/deep
   # Expected: Clean JSON status without raw exception traces
   ```

---

## 13. RESIDUAL RISKS AND EXPLICIT LIMITATIONS

* **Residual Risk 1 (Token Storage in localStorage):** Because the SPA relies on `localStorage` for Bearer tokens, token confidentiality remains dependent on the complete absence of XSS vulnerabilities.
* **Residual Risk 2 (Cloudflare WAF Dependence):** Frontend protection benefits from Cloudflare DDoS and proxy shielding. If Cloudflare proxying is bypassed via direct VPS IP access, upstream Traefik configurations become the sole line of defense.
* **Explicit Limitation:** This audit was performed without modifying code or executing destructive attacks. Runtime verification was conducted strictly via non-destructive HTTP/TCP probing.

---

## 14. FINAL RELEASE RECOMMENDATION

The release status is designated as **🔴 NO-GO**.

### Conditions for Advancing to 🟢 GO:
1. Implement Phase 1 remediations (`trustProxies`, `SESSION_SECURE_COOKIE`, backend Nginx security headers, and compose credential hardening).
2. Redeploy backend and frontend containers via Coolify.
3. Execute the automated regression tests defined in Section 12 to verify that all live responses conform to production standards.
4. Obtain formal acceptance of residual risks from the system owner.

---
*Report compiled and certified on 2026-10-09 by Antigravity Application Security Engineering.*
