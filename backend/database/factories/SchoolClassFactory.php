<?php

namespace Database\Factories;

use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Teacher;
use Illuminate\Database\Eloquent\Factories\Factory;

class SchoolClassFactory extends Factory
{
    protected $model = SchoolClass::class;

    public function definition(): array
    {
        return [
            'school_id' => School::factory(),
            'nama' => $this->faker->randomElement(['1A', '1B', '2A', '2B', '3A']),
            'tingkat' => $this->faker->randomElement(['1', '2', '3', '4', '5', '6']),
            'tahun_ajaran' => $this->faker->randomElement(['2023/2024', '2024/2025']),
            'wali_kelas_id' => null, // Optional
            'is_active' => true,
        ];
    }
}
