<?php

namespace App\Repositories\Contracts;

use App\Models\WaBlast;
use Illuminate\Pagination\LengthAwarePaginator;

interface WaBlastRepositoryInterface
{
    /**
     * Paginate WaBlast records with optional filters.
     *
     * @param array $filters Filter options: blast_status, created_at_from, created_at_to, page, per_page
     * @return LengthAwarePaginator
     */
    public function paginate(array $filters): LengthAwarePaginator;

    /**
     * Find a WaBlast by ID.
     *
     * @param int $id
     * @return WaBlast|null
     */
    public function findById(int $id): ?WaBlast;

    /**
     * Create a new WaBlast record.
     *
     * @param array $data
     * @return WaBlast
     */
    public function create(array $data): WaBlast;

    /**
     * Update the status of a WaBlast record.
     *
     * @param int $id
     * @param string $status
     * @param array $extra Additional fields to update
     * @return WaBlast
     */
    public function updateStatus(int $id, string $status, array $extra = []): WaBlast;

    /**
     * Delete a WaBlast record (soft delete).
     *
     * @param int $id
     * @return bool
     */
    public function delete(int $id): bool;
}
