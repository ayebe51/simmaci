<?php

namespace Database\Factories;

use App\Models\SkTemplate;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<SkTemplate>
 */
class SkTemplateFactory extends Factory
{
    protected $model = SkTemplate::class;

    public function definition(): array
    {
        return [
            'sk_type'           => fake()->randomElement(['gty', 'gtt', 'kamad', 'tendik']),
            'original_filename' => 'sk-template-' . Str::random(6) . '.docx',
            'file_path'         => 'sk-templates/' . Str::uuid() . '.docx',
            'disk'              => 'public',
            'is_active'         => false,
            'uploaded_by'       => fake()->safeEmail(),
        ];
    }

    public function active(): static
    {
        return $this->state(['is_active' => true]);
    }

    public function forType(string $skType): static
    {
        return $this->state(['sk_type' => $skType]);
    }
}
