<?php

namespace Database\Factories;

use App\Models\School;
use App\Models\SkDocument;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SkDocument>
 */
class SkDocumentFactory extends Factory
{
    protected $model = SkDocument::class;

    public function definition(): array
    {
        return [
            'nomor_sk'          => 'SK/' . fake()->unique()->numerify('###') . '/' . date('Y'),
            'jenis_sk'          => fake()->randomElement(['Pengangkatan', 'Mutasi', 'Pemberhentian', 'Kenaikan Pangkat']),
            'nama'              => fake('id_ID')->name(),
            'jabatan'           => fake()->randomElement(['Guru Kelas', 'Guru Mapel', 'Kepala Sekolah', 'Wakil Kepala']),
            'unit_kerja'        => fake('id_ID')->company(),
            'tanggal_penetapan' => fake()->date(),
            'status'            => fake()->randomElement(['draft', 'pending', 'approved', 'rejected']),
            'created_by'        => fake()->safeEmail(),
            'school_id'         => School::factory(),
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => ['status' => 'draft']);
    }

    public function approved(): static
    {
        return $this->state(fn () => ['status' => 'approved']);
    }

    public function rejected(): static
    {
        return $this->state(fn () => ['status' => 'rejected']);
    }
}
