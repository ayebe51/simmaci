<?php

namespace App\Services;

use App\Models\WaBlastConfig;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/**
 * GoWaGatewayService
 *
 * Handles communication with go-whatsapp-web-multidevice (aldinokemal) API.
 *
 * Authentication: HTTP Basic Auth — the stored "token" is in the format
 * "username:password" as set via the --basic-auth flag when starting GoWA.
 * If GoWA was started without --basic-auth, leave the token field empty.
 *
 * Endpoints (go-whatsapp-web-multidevice v5+):
 *   POST /api/send/message   — send text message
 *   POST /api/send/file      — send file/document
 *   GET  /api/user/info      — used for connection test
 */
class GoWaGatewayService
{
    private const TIMEOUT_SECONDS = 30;

    /**
     * Build an HTTP client with Basic Auth applied (if token is set).
     *
     * The token stored in WaBlastConfig is "username:password".
     * If empty, no Authorization header is sent (GoWA running without --basic-auth).
     */
    private function makeClient(WaBlastConfig $config): \Illuminate\Http\Client\PendingRequest
    {
        $client = Http::timeout(self::TIMEOUT_SECONDS)
            ->acceptJson()
            ->withHeaders([
                // Bypass ngrok browser warning interstitial page
                'ngrok-skip-browser-warning' => 'true',
            ]);

        $token = $config->getDecryptedToken();

        if (!empty($token) && str_contains($token, ':')) {
            [$username, $password] = explode(':', $token, 2);
            $client = $client->withBasicAuth($username, $password);
        }

        return $client;
    }

    /**
     * Send a text message via Go-WA Gateway.
     *
     * @param string $to Recipient phone number (normalized format: 62xxxxxxxxx)
     * @param string $message Message text
     * @param WaBlastConfig $config Go-WA configuration
     * @return array Response array with keys: success, message, data (or error details)
     */
    public function sendText(string $to, string $message, WaBlastConfig $config): array
    {
        try {
            $response = $this->makeClient($config)
                ->post($config->api_url . '/api/send/message', [
                    'phone'   => $to,
                    'message' => $message,
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
                'message' => 'Go-WA Gateway tidak dapat dihubungi',
                'error'   => $e->getMessage(),
            ];
        } catch (RequestException $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan saat mengirim permintaan ke Go-WA',
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
     * Send a message with file attachment via Go-WA Gateway.
     *
     * @param string $to Recipient phone number (normalized format: 62xxxxxxxxx)
     * @param string $message Caption/message text
     * @param string $filePath Path to file in Laravel Storage
     * @param WaBlastConfig $config Go-WA configuration
     * @return array Response array with keys: success, message, data (or error details)
     */
    public function sendFile(string $to, string $message, string $filePath, WaBlastConfig $config): array
    {
        try {
            $fileContent = \Illuminate\Support\Facades\Storage::get($filePath);

            if (!$fileContent) {
                return [
                    'success' => false,
                    'message' => 'File tidak ditemukan',
                    'error'   => "File path: {$filePath}",
                ];
            }

            $response = $this->makeClient($config)
                ->attach('file', $fileContent, basename($filePath))
                ->post($config->api_url . '/api/send/file', [
                    'phone'   => $to,
                    'caption' => $message,
                ]);

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
                'message' => 'Go-WA Gateway tidak dapat dihubungi',
                'error'   => $e->getMessage(),
            ];
        } catch (RequestException $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan saat mengirim permintaan ke Go-WA',
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
     * Test connection to Go-WA Gateway.
     *
     * Uses GET /app/status — returns device connection status.
     * Compatible with go-whatsapp-web-multidevice v6+.
     *
     * @param WaBlastConfig $config Go-WA configuration
     * @return array Response array with keys: success, message, data (or error details)
     */
    public function testConnection(WaBlastConfig $config): array
    {
        try {
            $response = $this->makeClient($config)
                ->get($config->api_url . '/app/status');

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message' => 'Koneksi ke Go-WA berhasil',
                    'data'    => $response->json(),
                ];
            }

            // 401 = Basic Auth salah
            if ($response->status() === 401) {
                return [
                    'success' => false,
                    'message' => 'Autentikasi gagal. Periksa kembali username:password Basic Auth.',
                    'error'   => $response->body(),
                    'status_code' => 401,
                ];
            }

            return [
                'success'     => false,
                'message'     => 'Koneksi ke Go-WA gagal',
                'error'       => $response->json() ?? $response->body(),
                'status_code' => $response->status(),
            ];
        } catch (ConnectionException $e) {
            return [
                'success' => false,
                'message' => 'Go-WA Gateway tidak dapat dihubungi',
                'error'   => $e->getMessage(),
            ];
        } catch (RequestException $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan saat mengirim permintaan ke Go-WA',
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
