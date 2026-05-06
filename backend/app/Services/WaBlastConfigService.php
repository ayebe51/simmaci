<?php

namespace App\Services;

use App\Models\WaBlastConfig;
use App\Repositories\Contracts\WaBlastConfigRepositoryInterface;
use Illuminate\Support\Facades\Crypt;

/**
 * WaBlastConfigService
 *
 * Manages Go-WA Gateway configuration with encryption/decryption of API tokens.
 * Provides singleton pattern for configuration management.
 */
class WaBlastConfigService
{
    public function __construct(
        private WaBlastConfigRepositoryInterface $configRepository
    ) {}

    /**
     * Get the current WaBlastConfig.
     *
     * @return WaBlastConfig|null
     */
    public function get(): ?WaBlastConfig
    {
        return $this->configRepository->get();
    }

    /**
     * Save or update WaBlastConfig with encrypted token.
     *
     * @param array $data Configuration data (api_url, api_token, sender_number, max_recipients_per_session, max_daily_messages, updated_by)
     * @return WaBlastConfig
     */
    public function save(array $data): WaBlastConfig
    {
        // Encrypt the API token before saving
        if (isset($data['api_token'])) {
            $data['api_token_encrypted'] = Crypt::encryptString($data['api_token']);
            unset($data['api_token']);
        }

        return $this->configRepository->save($data);
    }

    /**
     * Get the decrypted API token from the current configuration.
     *
     * @return string|null
     */
    public function getDecryptedToken(): ?string
    {
        $config = $this->get();

        if (!$config) {
            return null;
        }

        try {
            return Crypt::decryptString($config->api_token_encrypted);
        } catch (\Exception $e) {
            // Log decryption error if needed
            return null;
        }
    }
}
