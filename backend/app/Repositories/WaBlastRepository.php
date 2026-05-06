<?php

namespace App\Repositories;

use App\Models\WaBlast;
use App\Repositories\Contracts\WaBlastRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;

class WaBlastRepository implements WaBlastRepositoryInterface
{
    /**
     * Paginate WaBlast records with optional filters.
     *
     * @param array $filters Filter options: blast_status, created_at_from, created_at_to, page, per_page
     * @return LengthAwarePaginator
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = WaBlast::query();

        // Filter by blast_status
        if (!empty($filters['blast_status'])) {
            $query->where('blast_status', $filters['blast_status']);
        }

        // Filter by created_at range
        if (!empty($filters['created_at_from'])) {
            $query->whereDate('created_at', '>=', $filters['created_at_from']);
        }

        if (!empty($filters['created_at_to'])) {
            $query->whereDate('created_at', '<=', $filters['created_at_to']);
        }

        // Pagination
        $perPage = $filters['per_page'] ?? 15;
        $page = $filters['page'] ?? 1;

        return $query->orderBy('created_at', 'desc')->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * Find a WaBlast by ID.
     *
     * @param int $id
     * @return WaBlast|null
     */
    public function findById(int $id): ?WaBlast
    {
        return WaBlast::find($id);
    }

    /**
     * Create a new WaBlast record.
     *
     * @param array $data
     * @return WaBlast
     */
    public function create(array $data): WaBlast
    {
        return WaBlast::create($data);
    }

    /**
     * Update the status of a WaBlast record.
     *
     * @param int $id
     * @param string $status
     * @param array $extra Additional fields to update
     * @return WaBlast
     */
    public function updateStatus(int $id, string $status, array $extra = []): WaBlast
    {
        $blast = WaBlast::findOrFail($id);

        $updateData = array_merge(['blast_status' => $status], $extra);
        $blast->update($updateData);

        return $blast;
    }

    /**
     * Delete a WaBlast record (soft delete).
     *
     * @param int $id
     * @return bool
     */
    public function delete(int $id): bool
    {
        $blast = WaBlast::find($id);

        if (!$blast) {
            return false;
        }

        return $blast->delete();
    }
}
