<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\WaBlast\StoreWaBlastConfigRequest;
use App\Services\GoWaGatewayService;
use App\Services\WaBlastConfigService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WaBlastConfigController extends Controller
{
    use ApiResponse;

    public function __construct(
        private WaBlastConfigService $configService,
        private GoWaGatewayService $gatewayService
    ) {}

    /**
     * GET /api/wa-blast-config
     * Get current Go-WA configuration. API token is masked as '***'.
     */
    public function show(): JsonResponse
    {
        $config = $this->configService->get();

        if (!$config) {
            return $this->successResponse(null, 'Konfigurasi Go-WA Gateway belum diatur.');
        }

        // Mask the token — never expose the encrypted value or the plaintext
        $data = [
            'id'                          => $config->id,
            'api_url'                     => $config->api_url,
            'api_token'                   => '***',
            'sender_number'               => $config->sender_number,
            'device_id'                   => $config->device_id,
            'max_recipients_per_session'  => $config->max_recipients_per_session,
            'max_daily_messages'          => $config->max_daily_messages,
            'updated_at'                  => $config->updated_at,
        ];

        return $this->successResponse($data, 'Konfigurasi Go-WA berhasil diambil.');
    }

    /**
     * POST /api/wa-blast-config
     * Save or update Go-WA configuration. API token is encrypted before storage.
     */
    public function store(StoreWaBlastConfigRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['updated_by'] = $request->user()->id;

        $config = $this->configService->save($data);

        // Return masked token in response
        $responseData = [
            'id'                          => $config->id,
            'api_url'                     => $config->api_url,
            'api_token'                   => '***',
            'sender_number'               => $config->sender_number,
            'device_id'                   => $config->device_id,
            'max_recipients_per_session'  => $config->max_recipients_per_session,
            'max_daily_messages'          => $config->max_daily_messages,
            'updated_at'                  => $config->updated_at,
        ];

        return $this->successResponse($responseData, 'Konfigurasi Go-WA berhasil disimpan.');
    }

    /**
     * POST /api/wa-blast-config/test
     * Test connection to Go-WA Gateway using the stored configuration.
     */
    public function testConnection(): JsonResponse
    {
        $config = $this->configService->get();

        if (!$config) {
            return $this->errorResponse('Konfigurasi Go-WA Gateway belum diatur.', null, 422);
        }

        $result = $this->gatewayService->testConnection($config);

        if ($result['success']) {
            return $this->successResponse($result['data'] ?? null, 'Koneksi ke Go-WA berhasil.');
        }

        return $this->errorResponse(
            $result['message'] ?? 'Koneksi ke Go-WA gagal.',
            $result['error'] ?? null,
            422
        );
    }
}
