<?php

namespace Database\Factories;

use App\Models\School;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

class StudentFactory extends Factory
{
    protected $model = Student::class;

    public function definition(): array
    {
        return [
            'school_id' => School::factory(),
            'nisn' => $this->faker->unique()->numerify('##########'),
            'nama' => $this->faker->name(),
            'jenis_kelamin' => $this->faker->randomElement(['L', 'P']),
            'tempat_lahir' => $this->faker->city(),
            'tanggal_lahir' => $this->faker->date(),
            'kelas' => $this->faker->randomElement(['1A', '1B', '2A', '2B', '3A']),
            'alamat' => $this->faker->optional()->address(),
            'nama_ayah' => $this->faker->optional()->name('male'),
            'nama_ibu' => $this->faker->optional()->name('female'),
        ];
    }
}
