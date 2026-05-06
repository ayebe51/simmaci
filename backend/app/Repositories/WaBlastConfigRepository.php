<?php

namespace App\Repositories;

use App\Models\WaBlastConfig;
use App\Repositories\Contracts\WaBlastConfigRepositoryInterface;

class WaBlastConfigRepository implements WaBlastConfigRepositoryInterface
{
    /**
     * Get the singleton WaBlastConfig record.
     *
     * @return WaBlastConfig|null
     */
    public function get(): ?WaBlastConfig
    {
        return WaBlastConfig::first();
    }

    /**
     * Save or update the singleton WaBlastConfig record (upsert).
     *
     * @param array $data
     * @return WaBlastConfig
     */
    public function save(array $data): WaBlastConfig
    {
        // Since this is a singleton, we either update the existing record or create a new one
        $config = WaBlastConfig::first();

        if ($config) {
            $config->update($data);
            return $config;
        }

        return WaBlastConfig::create($data);
    }
}
