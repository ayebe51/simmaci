<?php

namespace App\Repositories;

use App\Models\WaBlastTemplate;
use App\Repositories\Contracts\WaBlastTemplateRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

class WaBlastTemplateRepository implements WaBlastTemplateRepositoryInterface
{
    /**
     * Get all templates.
     *
     * @return Collection
     */
    public function all(): Collection
    {
        return WaBlastTemplate::orderBy('created_at', 'desc')->get();
    }

    /**
     * Find a template by ID.
     *
     * @param int $id
     * @return WaBlastTemplate|null
     */
    public function findById(int $id): ?WaBlastTemplate
    {
        return WaBlastTemplate::find($id);
    }

    /**
     * Create a new template.
     *
     * @param array $data
     * @return WaBlastTemplate
     */
    public function create(array $data): WaBlastTemplate
    {
        return WaBlastTemplate::create($data);
    }

    /**
     * Update a template.
     *
     * @param int $id
     * @param array $data
     * @return WaBlastTemplate
     */
    public function update(int $id, array $data): WaBlastTemplate
    {
        $template = WaBlastTemplate::findOrFail($id);
        $template->update($data);

        return $template;
    }

    /**
     * Delete a template (soft delete).
     *
     * @param int $id
     * @return bool
     */
    public function delete(int $id): bool
    {
        $template = WaBlastTemplate::find($id);

        if (!$template) {
            return false;
        }

        return $template->delete();
    }

    /**
     * Check if a template name exists (case-insensitive).
     *
     * @param string $name
     * @param int|null $excludeId Exclude a specific template ID from the check
     * @return bool
     */
    public function existsByName(string $name, ?int $excludeId = null): bool
    {
        $query = WaBlastTemplate::whereRaw('LOWER(name) = ?', [strtolower($name)]);

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }
}
