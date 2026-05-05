<?php

namespace Database\Factories;

use App\Models\School;
use App\Models\SchoolClass;
use App\Models\StudentAttendanceLog;
use App\Models\Subject;
use Illuminate\Database\Eloquent\Factories\Factory;

class StudentAttendanceLogFactory extends Factory
{
    protected $model = StudentAttendanceLog::class;

    public function definition(): array
    {
        return [
            'school_id' => School::factory(),
            'class_id' => SchoolClass::factory(),
            'subject_id' => Subject::factory(),
            'tanggal' => $this->faker->date(),
            'jam_ke' => $this->faker->numberBetween(1, 8),
            'logs' => [
                [
                    'student_id' => $this->faker->numberBetween(1, 100),
                    'status' => $this->faker->randomElement(['Hadir', 'Sakit', 'Izin', 'Alpha']),
                ],
            ],
        ];
    }
}
