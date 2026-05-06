<?php

namespace App\Services;

use App\Models\WaBlastConfig;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/**
 * GoWaGatewayService
 *
 * Handles communication with Go-WA WhatsApp Gateway API.
 * Provides methods for sending text messages, files, and testing connection.
 * Uses Laravel HTTP Client with 30-second timeout.
 */
class GoWaGatewayService
{
    private const TIMEOUT_SECONDS = 30;

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
            $response = Http::timeout(self::TIMEOUT_SECONDS)
                ->post($config->api_url . '/send-message', [
                    'phone' => $to,
                    'message' => $message,
                    'token' => $config->getDecryptedToken(),
                ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message' => 'Pesan berhasil dikirim',
                    'data' => $response->json(),
                ];
            }

            return [
                'success' => false,
                'message' => 'Gagal mengirim pesan',
                'error' => $response->json() ?? $response->body(),
                'status_code' => $response->status(),
            ];
        } catch (ConnectionException $e) {
            return [
                'success' => false,
                'message' => 'Go-WA Gateway tidak dapat dihubungi',
                'error' => $e->getMessage(),
            ];
        } catch (RequestException $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan saat mengirim permintaan ke Go-WA',
                'error' => $e->getMessage(),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan tidak terduga',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Send a message with file attachment via Go-WA Gateway.
     *
     * @param string $to Recipient phone number (normalized format: 62xxxxxxxxx)
     * @param string $message Message text
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
                    'error' => "File path: {$filePath}",
                ];
            }

            $response = Http::timeout(self::TIMEOUT_SECONDS)
                ->attach('file', $fileContent, basename($filePath))
                ->post($config->api_url . '/send-file', [
                    'phone' => $to,
                    'message' => $message,
                    'token' => $config->getDecryptedToken(),
                ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message' => 'File berhasil dikirim',
                    'data' => $response->json(),
                ];
            }

            return [
                'success' => false,
                'message' => 'Gagal mengirim file',
                'error' => $response->json() ?? $response->body(),
                'status_code' => $response->status(),
            ];
        } catch (ConnectionException $e) {
            return [
                'success' => false,
                'message' => 'Go-WA Gateway tidak dapat dihubungi',
                'error' => $e->getMessage(),
            ];
        } catch (RequestException $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan saat mengirim permintaan ke Go-WA',
                'error' => $e->getMessage(),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan tidak terduga',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Test connection to Go-WA Gateway.
     *
     * @param WaBlastConfig $config Go-WA configuration
     * @return array Response array with keys: success, message, data (or error details)
     */
    public function testConnection(WaBlastConfig $config): array
    {
        try {
            $response = Http::timeout(self::TIMEOUT_SECONDS)
                ->post($config->api_url . '/test', [
                    'token' => $config->getDecryptedToken(),
                ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'message' => 'Koneksi ke Go-WA berhasil',
                    'data' => $response->json(),
                ];
            }

            return [
                'success' => false,
                'message' => 'Koneksi ke Go-WA gagal',
                'error' => $response->json() ?? $response->body(),
                'status_code' => $response->status(),
            ];
        } catch (ConnectionException $e) {
            return [
                'success' => false,
                'message' => 'Go-WA Gateway tidak dapat dihubungi',
                'error' => $e->getMessage(),
            ];
        } catch (RequestException $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan saat mengirim permintaan ke Go-WA',
                'error' => $e->getMessage(),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Kesalahan tidak terduga',
                'error' => $e->getMessage(),
            ];
        }
    }
}
