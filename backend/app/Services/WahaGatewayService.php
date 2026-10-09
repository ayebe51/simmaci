<?php

namespace App\Services;

use App\Models\WaBlastConfig;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * WahaGatewayService
 *
 * Handles communication with WhatsApp HTTP API (WAHA - devlikeapro/waha).
 *
 * Authentication:
 *   API Key is sent via the "X-Api-Key" header (if configured in WaBlastConfig).
 *   If token contains ":", Basic Auth is also sent as a fallback for reverse proxies.
 *
 * Endpoints (WAHA Core / Plus):
 *   POST /api/sendText       — send text message (fields: session, chatId, text)
 *   POST /api/sendFile       — send file (fields: session, chatId, file: {data, filename, mimetype}, caption)
 *   GET  /api/sessions/{id}  — get session status (WORKING, SCAN_QR_CODE, STARTING, STOPPED, etc.)
 *   GET  /api/server/status  — get WAHA server status
 */
class WahaGatewayService
{
    private const TIMEOUT_SECONDS = 30;

    /**
     * Build an HTTP client with API Key (and Basic Auth fallback if applicable).
     */
    protected function makeClient(WaBlastConfig $config): PendingRequest
    {
        $client = Http::timeout(self::TIMEOUT_SECONDS)
            ->acceptJson()
            ->withHeaders([
                // Bypass ngrok/localtunnel browser warning interstitial page
                'ngrok-skip-browser-warning' => 'true',
                'bypass-tunnel-reminder' => 'true',
            ]);

        $token = $config->getDecryptedToken();

        if (!empty($token)) {
            // Standard WAHA Authentication via X-Api-Key
            $client = $client->withHeaders(['X-Api-Key' => $token]);

            // If token is formatted as username:password, also attach Basic Auth for reverse proxies
            if (str_contains($token, ':')) {
                [$username, $password] = explode(':', $token, 2);
                $client = $client->withBasicAuth($username, $password);
            }
        }

        return $client;
    }

    /**
     * Format target phone number into WAHA chatId format.
     * International format: {country_code}{number}@c.us
     * Example: 628123456789 -> 628123456789@c.us
     */
    public function formatChatId(string $to): string
    {
        $trimmed = trim($to);

        // If already formatted as chatId (c.us, g.us, newsletter)
        if (str_ends_with($trimmed, '@c.us') || str_ends_with($trimmed, '@g.us') || str_ends_with($trimmed, '@newsletter')) {
            return $trimmed;
        }

        // Clean digits
        $clean = preg_replace('/[^0-9]/', '', $trimmed);

        // Convert Indonesian local 08xx to 628xx
        if (str_starts_with($clean, '08')) {
            $clean = '62' . substr($clean, 1);
        }

        return $clean . '@c.us';
    }

    /**
     * Get effective session name for WAHA.
     * Defaults to 'default' if not specified.
     */
    public function getSessionName(WaBlastConfig $config): string
    {
        $deviceId = null;
        try {
            $deviceId = $config->getAttribute('device_id');
        } catch (\Throwable) {
            // Ignore
        }

        if ($deviceId === null || $deviceId === '') {
            try {
                $deviceId = $config->device_id;
            } catch (\Throwable) {
                // Ignore
            }
        }

        return ($deviceId !== null && $deviceId !== '') ? (string) $deviceId : 'default';
    }

    /**
     * Get the effective API URL for WAHA.
     * Uses WAHA_INTERNAL_URL or GOWA_INTERNAL_URL env var if set (for Docker internal networking),
     * otherwise falls back to the configured api_url in the database.
     */
    protected function getApiUrl(WaBlastConfig $config): string
    {
        // When running unit tests, explicitly configured mock URL on WaBlastConfig takes precedence
        if (app()->environment('testing') && !empty($config->api_url)) {
            return rtrim((string) $config->api_url, '/');
        }

        $internal = config('services.waha.internal_url') ?? config('services.gowa.internal_url');
        if (!empty($internal)) {
            return rtrim($internal, '/');
        }

        $url = rtrim((string) $config->api_url, '/');

        // SSRF check on user-configured URL when not in testing environment
        if (! app()->environment('testing')) {
            $host = parse_url($url, PHP_URL_HOST);
            if ($host && ! in_array(strtolower($host), ['localhost', '127.0.0.1', 'waha', 'gowa'], true)) {
                $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
                foreach ($ips as $ip) {
                    if (
                        str_starts_with($ip, '127.')
                        || str_starts_with($ip, '169.254.')
                        || $ip === '0.0.0.0'
                        || $ip === '::1'
                    ) {
                        throw new \InvalidArgumentException('Akses ke alamat internal atau metadata dicegah (SSRF Protection).');
                    }
                }
            }
        }

        return $url;
    }

    /**
     * Send a text message via WAHA Gateway.
     *
     * @param string $to Recipient phone number or chatId
     * @param string $message Message text
     * @param WaBlastConfig $config WA configuration
     * @return array Response array with keys: success, message, data (or error details)
     */
    public function sendText(string $to, string $message, WaBlastConfig $config): array
    {
        try {
            $session = $this->getSessionName($config);
            $chatId  = $this->formatChatId($to);

            $response = $this->makeClient($config)
                ->post($this->getApiUrl($config) . '/api/sendText', [
                    'session' => $session,
                    'chatId'  => $chatId,
                    'text'    => $message,
                ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message' => 'Pesan berhasil dikirim',
                    'data'    => $response->json(),
                ];
            }

            return [
                'success'     => false,
                'message'     => 'Gagal mengirim pesan',
                'error'       => $response->json() ?? $response->body(),
                'status_code' => $response->status(),
            ];
        } catch (ConnectionException $e) {
            return [
                'success' => false,
                'message' => 'WAHA Gateway tidak dapat dihubungi',
                'error'   => $e->getMessage(),
            ];
        } catch (RequestException $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan saat mengirim permintaan ke WAHA',
                'error'   => $e->getMessage(),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan tidak terduga',
                'error'   => $e->getMessage(),
            ];
        }
    }

    /**
     * Helper sendMessage to support parameter order (config, to, message).
     */
    public function sendMessage(WaBlastConfig $config, string $to, string $message): array
    {
        return $this->sendText($to, $message, $config);
    }

    /**
     * Send a message with file attachment via WAHA Gateway.
     *
     * @param string $to Recipient phone number or chatId
     * @param string $message Caption/message text
     * @param string $filePath Path to file in Laravel Storage (checks default disk first, then local)
     * @param WaBlastConfig $config WA configuration
     * @return array Response array with keys: success, message, data (or error details)
     */
    public function sendFile(string $to, string $message, string $filePath, WaBlastConfig $config): array
    {
        try {
            $fileContent = null;

            if (Storage::exists($filePath)) {
                $fileContent = Storage::get($filePath);
            } elseif (Storage::disk('local')->exists($filePath)) {
                $fileContent = Storage::disk('local')->get($filePath);
            }

            if (!$fileContent) {
                return [
                    'success' => false,
                    'message' => 'File tidak ditemukan',
                    'error'   => "File path: {$filePath} (checked default and local disks)",
                ];
            }

            $fileName = basename($filePath);
            $mimeType = Storage::mimeType($filePath) ?: 'application/octet-stream';
            $session  = $this->getSessionName($config);
            $chatId   = $this->formatChatId($to);

            $payload = [
                'session' => $session,
                'chatId'  => $chatId,
                'file'    => [
                    'data'     => base64_encode($fileContent),
                    'filename' => $fileName,
                    'mimetype' => $mimeType,
                ],
            ];

            if (!empty($message)) {
                $payload['caption'] = $message;
            }

            $response = $this->makeClient($config)
                ->post($this->getApiUrl($config) . '/api/sendFile', $payload);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message' => 'File berhasil dikirim',
                    'data'    => $response->json(),
                ];
            }

            return [
                'success'     => false,
                'message'     => 'Gagal mengirim file',
                'error'       => $response->json() ?? $response->body(),
                'status_code' => $response->status(),
            ];
        } catch (ConnectionException $e) {
            return [
                'success' => false,
                'message' => 'WAHA Gateway tidak dapat dihubungi',
                'error'   => $e->getMessage(),
            ];
        } catch (RequestException $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan saat mengirim permintaan ke WAHA',
                'error'   => $e->getMessage(),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan tidak terduga',
                'error'   => $e->getMessage(),
            ];
        }
    }

    /**
     * Test connection to WAHA Gateway.
     *
     * Queries GET /api/sessions/{session} or GET /api/server/status.
     *
     * @param WaBlastConfig $config WA configuration
     * @return array Response array with keys: success, message, data (or error details)
     */
    public function testConnection(WaBlastConfig $config): array
    {
        try {
            $session = $this->getSessionName($config);
            $apiUrl  = $this->getApiUrl($config);
            $client  = $this->makeClient($config);

            // Step 1: Check the specific session status
            $sessionResponse = $client->get($apiUrl . '/api/sessions/' . rawurlencode($session));

            if ($sessionResponse->successful()) {
                $sessionData = $sessionResponse->json();
                $status = strtoupper($sessionData['status'] ?? 'WORKING');

                if ($status === 'WORKING') {
                    return [
                        'success' => true,
                        'message' => 'Koneksi ke WAHA berhasil dan sesi aktif (WORKING).',
                        'data'    => $sessionData,
                    ];
                }

                if ($status === 'SCAN_QR_CODE') {
                    return [
                        'success' => true,
                        'message' => 'Koneksi ke WAHA terhubung. Silakan scan QR code di dashboard WAHA untuk mengaktifkan WhatsApp.',
                        'data'    => $sessionData,
                    ];
                }

                if ($status === 'STARTING') {
                    return [
                        'success' => true,
                        'message' => 'Koneksi ke WAHA terhubung. Sesi WhatsApp sedang memulai (STARTING).',
                        'data'    => $sessionData,
                    ];
                }

                if ($status === 'STOPPED') {
                    return [
                        'success'     => false,
                        'message'     => 'Koneksi ke WAHA terhubung, namun sesi dalam status STOPPED. Aktifkan sesi di dashboard WAHA.',
                        'data'        => $sessionData,
                        'status_code' => 200,
                    ];
                }

                return [
                    'success' => true,
                    'message' => "Koneksi ke WAHA terhubung (Status sesi: {$status}).",
                    'data'    => $sessionData,
                ];
            }

            // 401 = API Key / Auth failed
            if ($sessionResponse->status() === 401) {
                return [
                    'success'     => false,
                    'message'     => 'Autentikasi gagal. Periksa kembali API Key WAHA (X-Api-Key).',
                    'error'       => $sessionResponse->body(),
                    'status_code' => 401,
                ];
            }

            // If 404, maybe session is not created yet. Check server status to verify server reachability.
            if ($sessionResponse->status() === 404) {
                $serverCheck = $client->get($apiUrl . '/api/server/status');
                if ($serverCheck->successful()) {
                    return [
                        'success' => true,
                        'message' => "Server WAHA aktif, namun sesi '{$session}' belum dibuat atau belum dijalankan.",
                        'data'    => $serverCheck->json(),
                    ];
                }
            }

            return [
                'success'     => false,
                'message'     => 'Koneksi ke WAHA gagal.',
                'error'       => $sessionResponse->json() ?? $sessionResponse->body(),
                'status_code' => $sessionResponse->status(),
            ];
        } catch (ConnectionException $e) {
            return [
                'success' => false,
                'message' => 'WAHA Gateway tidak dapat dihubungi',
                'error'   => $e->getMessage(),
            ];
        } catch (RequestException $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan saat mengirim permintaan ke WAHA',
                'error'   => $e->getMessage(),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan tidak terduga',
                'error'   => $e->getMessage(),
            ];
        }
    }
}
