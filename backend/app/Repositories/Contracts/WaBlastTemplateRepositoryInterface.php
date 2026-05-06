<?php

namespace App\Repositories\Contracts;

use App\Models\WaBlastTemplate;
use Illuminate\Database\Eloquent\Collection;

interface WaBlastTemplateRepositoryInterface
{
    /**
     * Get all templates.
     *
     * @return Collection
     */
    public function all(): Collection;

    /**
     * Find a template by ID.
     *
     * @param int $id
     * @return WaBlastTemplate|null
     */
    public function findById(int $id): ?WaBlastTemplate;

    /**
     * Create a new template.
     *
     * @param array $data
     * @return WaBlastTemplate
     */
    public function create(array $data): WaBlastTemplate;

    /**
     * Update a template.
     *
     * @param int $id
     * @param array $data
     * @return WaBlastTemplate
     */
    public function update(int $id, array $data): WaBlastTemplate;

    /**
     * Delete a template (soft delete).
     *
     * @param int $id
     * @return bool
     */
    public function delete(int $id): bool;

    /**
     * Check if a template name exists (case-insensitive).
     *
     * @param string $name
     * @param int|null $excludeId Exclude a specific template ID from the check
     * @return bool
     */
    public function existsByName(string $name, ?int $excludeId = null): bool;
}
