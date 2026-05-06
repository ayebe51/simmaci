<?php

namespace App\Services;

use App\Models\WaBlastTemplate;
use App\Repositories\Contracts\WaBlastTemplateRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

/**
 * WaBlastTemplateService
 *
 * Manages WA Blast message templates with uniqueness validation.
 */
class WaBlastTemplateService
{
    public function __construct(
        private WaBlastTemplateRepositoryInterface $templateRepository
    ) {}

    /**
     * Get all templates.
     *
     * @return Collection
     */
    public function list(): Collection
    {
        return $this->templateRepository->all();
    }

    /**
     * Create a new template.
     *
     * Validates that the template name is unique (case-insensitive) before creating.
     *
     * @param array $data Template data: name, body, created_by
     * @return WaBlastTemplate
     * @throws ValidationException if name already exists
     */
    public function create(array $data): WaBlastTemplate
    {
        if ($this->templateRepository->existsByName($data['name'])) {
            throw ValidationException::withMessages([
                'name' => ['Nama template sudah digunakan. Gunakan nama yang berbeda.'],
            ]);
        }

        return $this->templateRepository->create($data);
    }

    /**
     * Update an existing template.
     *
     * Validates that the new name is unique (case-insensitive), excluding the current template.
     *
     * @param int $id Template ID
     * @param array $data Updated data: name, body
     * @return WaBlastTemplate
     * @throws ValidationException if name already exists for another template
     */
    public function update(int $id, array $data): WaBlastTemplate
    {
        if (isset($data['name']) && $this->templateRepository->existsByName($data['name'], $id)) {
            throw ValidationException::withMessages([
                'name' => ['Nama template sudah digunakan. Gunakan nama yang berbeda.'],
            ]);
        }

        return $this->templateRepository->update($id, $data);
    }

    /**
     * Delete a template (soft delete).
     *
     * @param int $id Template ID
     * @return void
     */
    public function delete(int $id): void
    {
        $this->templateRepository->delete($id);
    }
}
