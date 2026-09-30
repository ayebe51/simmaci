<?php

namespace Tests\Unit\Services;

use App\Models\WaBlastConfig;
use App\Services\GoWaGatewayService;
use App\Services\WahaGatewayService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * GoWaGatewayServiceTest
 *
 * Verifies that GoWaGatewayService inherits and operates via WAHA (WhatsApp HTTP API).
 */
class GoWaGatewayServiceTest extends TestCase
{
    private GoWaGatewayService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new GoWaGatewayService();
    }

    private function makeConfig(string $apiUrl = 'http://waha.test:3000', string $token = 'secret-api-key', ?string $deviceId = 'session_1'): WaBlastConfig
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

    public function test_it_extends_waha_gateway_service(): void
    {
        $this->assertInstanceOf(WahaGatewayService::class, $this->service);
    }

    public function test_send_text_calls_waha_endpoint(): void
    {
        Http::fake([
            'http://waha.test:3000/api/sendText' => Http::response(['status' => 'ok'], 200),
        ]);

        $config = $this->makeConfig();
        $result = $this->service->sendText('628123456789', 'Hello', $config);

        $this->assertTrue($result['success']);

        Http::assertSent(function (Request $request) {
            $this->assertStringEndsWith('/api/sendText', $request->url());
            $this->assertEquals('secret-api-key', $request->header('X-Api-Key')[0]);
            $this->assertEquals('session_1', $request->data()['session']);
            $this->assertEquals('628123456789@c.us', $request->data()['chatId']);
            return true;
        });
    }

    public function test_send_text_returns_success_false_on_non_2xx(): void
    {
        Http::fake([
            'http://waha.test:3000/api/sendText' => Http::response(['error' => 'bad request'], 400),
        ]);

        $result = $this->service->sendText('628123456789', 'Hello', $this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertEquals(400, $result['status_code']);
    }

    public function test_send_text_returns_error_on_connection_exception(): void
    {
        Http::fake(function () {
            throw new ConnectionException('Connection refused');
        });

        $result = $this->service->sendText('628123456789', 'Hello', $this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('tidak dapat dihubungi', $result['message']);
    }

    public function test_send_file_calls_waha_endpoint(): void
    {
        Http::fake([
            'http://waha.test:3000/api/sendFile' => Http::response(['status' => 'ok'], 200),
        ]);

        Storage::fake('local');
        Storage::disk('local')->put('wa-blasts/attachments/test.pdf', 'fake-pdf-content');

        $config = $this->makeConfig();
        $result = $this->service->sendFile('628123456789', 'Lihat lampiran', 'wa-blasts/attachments/test.pdf', $config);

        $this->assertTrue($result['success']);

        Http::assertSent(function (Request $request) {
            $this->assertStringEndsWith('/api/sendFile', $request->url());
            $this->assertEquals('session_1', $request->data()['session']);
            $this->assertEquals('628123456789@c.us', $request->data()['chatId']);
            $this->assertEquals('Lihat lampiran', $request->data()['caption']);
            return true;
        });
    }

    public function test_send_file_returns_error_when_file_not_found(): void
    {
        Storage::fake('local');

        $result = $this->service->sendFile('628123456789', 'Caption', 'nonexistent/file.pdf', $this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('tidak ditemukan', $result['message']);
    }

    public function test_test_connection_calls_waha_session_endpoint(): void
    {
        Http::fake([
            'http://waha.test:3000/api/sessions/session_1' => Http::response(['status' => 'WORKING'], 200),
        ]);

        $result = $this->service->testConnection($this->makeConfig());

        $this->assertTrue($result['success']);
    }

    public function test_test_connection_returns_descriptive_error_on_401(): void
    {
        Http::fake([
            'http://waha.test:3000/api/sessions/session_1' => Http::response('Unauthorized', 401),
        ]);

        $result = $this->service->testConnection($this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertEquals(401, $result['status_code']);
    }

    public function test_test_connection_returns_error_on_connection_exception(): void
    {
        Http::fake(function () {
            throw new ConnectionException('Connection refused');
        });

        $result = $this->service->testConnection($this->makeConfig());

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('tidak dapat dihubungi', $result['message']);
    }
}
