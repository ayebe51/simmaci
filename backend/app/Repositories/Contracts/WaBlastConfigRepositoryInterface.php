<?php

namespace App\Repositories\Contracts;

use App\Models\WaBlastConfig;

interface WaBlastConfigRepositoryInterface
{
    /**
     * Get the singleton WaBlastConfig record.
     *
     * @return WaBlastConfig|null
     */
    public function get(): ?WaBlastConfig;

    /**
     * Save or update the singleton WaBlastConfig record (upsert).
     *
     * @param array $data
     * @return WaBlastConfig
     */
    public function save(array $data): WaBlastConfig;
}
