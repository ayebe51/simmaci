<?php

namespace Tests\Unit\Services;

use App\Models\WaBlastConfig;
use App\Services\WahaGatewayService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * WahaGatewayServiceTest
 *
 * Unit tests for WahaGatewayService (WhatsApp HTTP API).
 */
class WahaGatewayServiceTest extends TestCase
{
    private WahaGatewayService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new WahaGatewayService();
    }

    private function makeConfig(string $apiUrl = 'http://waha.test:3000', string $token = 'secret-api-key', ?string $deviceId = 'unit_session'): WaBlastConfig
    {
        $config = $this->createMock(WaBlastConfig::class);
        $config->method('getDecryptedToken')->willReturn($token);
        $config->method('getAttribute')->willReturnCallback(fn ($name) => match ($name) {
            'api_url'   => $apiUrl,
            'device_id' => $deviceId,
            default     => null,
        });
        $config->method('__get')->willReturnCallback(fn ($name) => match ($name) {
            'api_url'   => $apiUrl,
            'device_id' => $deviceId,
            default     => null,
        });
        $config->method('__isset')->willReturnCallback(fn ($name) => in_array($name, ['api_url', 'device_id']));
        return $config;
    }

    public function test_format_chat_id_handles_various_formats(): void
    {
        // Indonesian standard 62xxx
        $this->assertEquals('628123456789@c.us', $this->service->formatChatId('628123456789'));
        // Local 08xx converted to 628xx
        $this->assertEquals('628123456789@c.us', $this->service->formatChatId('08123456789'));
        // Strip plus sign
        $this->assertEquals('628123456789@c.us', $this->service->formatChatId('+628123456789'));
        // Preserves already formatted @c.us
        $this->assertEquals('628123456789@c.us', $this->service->formatChatId('628123456789@c.us'));
        // Preserves group @g.us
        $this->assertEquals('123456-7890@g.us', $this->service->formatChatId('123456-7890@g.us'));
    }

    public function test_send_text_calls_correct_endpoint_with_api_key(): void
    {
        Http::fake([
            'http://waha.test:3000/api/sendText' => Http::response(['id' => 'msg-123'], 200),
        ]);

        $config = $this->makeConfig();
        $result = $this->service->sendText('08123456789', 'Halo dari SIMMACI', $config);

        $this->assertTrue($result['success']);

        Http::assertSent(function (Request $request) {
            $this->assertStringEndsWith('/api/sendText', $request->url());
            $this->assertEquals('secret-api-key', $request->header('X-Api-Key')[0]);

            $data = $request->data();
            $this->assertEquals('unit_session', $data['session']);
            $this->assertEquals('628123456789@c.us', $data['chatId']);
            $this->assertEquals('Halo dari SIMMACI', $data['text']);

            return true;
        });
    }

    public function test_send_text_works_without_api_key_when_token_empty(): void
    {
        Http::fake([
            'http://waha.test:3000/api/sendText' => Http::response(['id' => 'msg-123'], 200),
        ]);

        $config = $this->makeConfig(token: '', deviceId: null);
        $result = $this->service->sendText('628123456789', 'Halo', $config);

        $this->assertTrue($result['success']);

        Http::assertSent(function (Request $request) {
            $this->assertEmpty($request->header('X-Api-Key'));
            $data = $request->data();
            $this->assertEquals('default', $data['session']);
            $this->assertEquals('628123456789@c.us', $data['chatId']);

            return true;
        });
    }

    public function test_send_text_returns_success_false_on_error(): void
    {
        Http::fake([
            'http://waha.test:3000/api/sendText' => Http::response(['error' => 'Invalid session'], 400),
        ]);

        $result = $this->service->sendText('628123456789', 'Halo', $this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertEquals(400, $result['status_code']);
    }

    public function test_send_text_handles_connection_exception(): void
    {
        Http::fake(function () {
            throw new ConnectionException('Connection timed out');
        });

        $result = $this->service->sendText('628123456789', 'Halo', $this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('tidak dapat dihubungi', $result['message']);
    }

    public function test_send_file_calls_correct_endpoint_with_base64_payload(): void
    {
        Http::fake([
            'http://waha.test:3000/api/sendFile' => Http::response(['id' => 'file-123'], 200),
        ]);

        Storage::fake('local');
        Storage::disk('local')->put('wa-blasts/attachments/sample.pdf', 'fake-pdf-content');

        $config = $this->makeConfig();
        $result = $this->service->sendFile('628123456789', 'Lampiran Dokumen', 'wa-blasts/attachments/sample.pdf', $config);

        $this->assertTrue($result['success']);

        Http::assertSent(function (Request $request) {
            $this->assertStringEndsWith('/api/sendFile', $request->url());
            $this->assertEquals('secret-api-key', $request->header('X-Api-Key')[0]);

            $data = $request->data();
            $this->assertEquals('unit_session', $data['session']);
            $this->assertEquals('628123456789@c.us', $data['chatId']);
            $this->assertEquals('Lampiran Dokumen', $data['caption']);

            $this->assertIsArray($data['file']);
            $this->assertEquals('sample.pdf', $data['file']['filename']);
            $this->assertEquals(base64_encode('fake-pdf-content'), $data['file']['data']);

            return true;
        });
    }

    public function test_send_file_returns_error_when_file_not_found(): void
    {
        Storage::fake('local');

        $result = $this->service->sendFile('628123456789', 'Dokumen', 'nonexistent.pdf', $this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('tidak ditemukan', $result['message']);
    }

    public function test_test_connection_returns_success_when_session_working(): void
    {
        Http::fake([
            'http://waha.test:3000/api/sessions/unit_session' => Http::response([
                'name'   => 'unit_session',
                'status' => 'WORKING',
            ], 200),
        ]);

        $result = $this->service->testConnection($this->makeConfig());

        $this->assertTrue($result['success']);
        $this->assertStringContainsString('WORKING', $result['message']);
    }

    public function test_test_connection_handles_scan_qr_code_status(): void
    {
        Http::fake([
            'http://waha.test:3000/api/sessions/unit_session' => Http::response([
                'name'   => 'unit_session',
                'status' => 'SCAN_QR_CODE',
            ], 200),
        ]);

        $result = $this->service->testConnection($this->makeConfig());

        $this->assertTrue($result['success']);
        $this->assertStringContainsString('scan QR code', $result['message']);
    }

    public function test_test_connection_handles_401_unauthorized(): void
    {
        Http::fake([
            'http://waha.test:3000/api/sessions/unit_session' => Http::response('Unauthorized', 401),
        ]);

        $result = $this->service->testConnection($this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertEquals(401, $result['status_code']);
        $this->assertStringContainsString('API Key', $result['message']);
    }

    public function test_test_connection_falls_back_to_server_status_on_404(): void
    {
        Http::fake([
            'http://waha.test:3000/api/sessions/unit_session' => Http::response('Not Found', 404),
            'http://waha.test:3000/api/server/status' => Http::response(['status' => 'OK'], 200),
        ]);

        $result = $this->service->testConnection($this->makeConfig());

        $this->assertTrue($result['success']);
        $this->assertStringContainsString('Server WAHA aktif', $result['message']);
    }

    public function test_test_connection_handles_connection_exception(): void
    {
        Http::fake(function () {
            throw new ConnectionException('Cannot connect');
        });

        $result = $this->service->testConnection($this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('tidak dapat dihubungi', $result['message']);
    }
}
