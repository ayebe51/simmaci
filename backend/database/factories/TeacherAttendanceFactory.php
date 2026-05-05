<?php

namespace Database\Factories;

use App\Models\School;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use Illuminate\Database\Eloquent\Factories\Factory;

class TeacherAttendanceFactory extends Factory
{
    protected $model = TeacherAttendance::class;

    public function definition(): array
    {
        return [
            'school_id' => School::factory(),
            'teacher_id' => Teacher::factory(),
            'tanggal' => $this->faker->date(),
            'jam_masuk' => $this->faker->time('H:i'),
            'jam_pulang' => $this->faker->optional()->time('H:i'),
            'status' => $this->faker->randomElement(['Hadir', 'Sakit', 'Izin', 'Alpha']),
            'keterangan' => $this->faker->optional()->sentence(),
            'scanned_by' => $this->faker->optional()->name(),
        ];
    }
}
