<?php

namespace Database\Factories;

use App\Models\AttendanceSetting;
use App\Models\School;
use Illuminate\Database\Eloquent\Factories\Factory;

class AttendanceSettingFactory extends Factory
{
    protected $model = AttendanceSetting::class;

    public function definition(): array
    {
        return [
            'school_id' => School::factory(),
            'absensi_guru_aktif' => $this->faker->boolean(),
            'absensi_siswa_aktif' => $this->faker->boolean(),
            'scanner_pin' => $this->faker->optional()->numerify('######'),
            'qr_scan_aktif' => $this->faker->boolean(),
            'gowa_url' => $this->faker->optional()->url(),
            'gowa_device_id' => $this->faker->optional()->uuid(),
        ];
    }
}
