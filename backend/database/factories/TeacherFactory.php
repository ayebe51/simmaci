<?php

namespace Database\Factories;

use App\Models\School;
use App\Models\Teacher;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Teacher>
 */
class TeacherFactory extends Factory
{
    protected $model = Teacher::class;

    public function definition(): array
    {
        $tmt = fake()->dateTimeBetween('-10 years', '-1 year');
        $diffYears = now()->diffInYears($tmt);
        $status = $diffYears >= 2 ? 'GTY' : 'GTT';

        return [
            'nama'                => fake('id_ID')->name(),
            'nuptk'               => fake()->unique()->numerify('################'),
            'nip'                 => fake()->optional()->numerify('##################'),
            'nomor_induk_maarif'  => fake()->optional()->numerify('##########'),
            'jenis_kelamin'       => fake()->randomElement(['L', 'P']),
            'tempat_lahir'        => fake('id_ID')->city(),
            'tanggal_lahir'       => fake()->dateTimeBetween('-60 years', '-22 years')->format('Y-m-d'),
            'pendidikan_terakhir' => fake()->randomElement(['S1', 'S2', 'D3', 'SMA']),
            'mapel'               => fake()->randomElement(['Matematika', 'Bahasa Indonesia', 'IPA', 'IPS', 'PAI']),
            'unit_kerja'          => fake('id_ID')->company(),
            'school_id'           => School::factory(),
            'provinsi'            => 'Jawa Tengah',
            'kabupaten'           => 'Cilacap',
            'kecamatan'           => fake()->randomElement(['Cilacap Selatan', 'Kroya', 'Wanareja', 'Majenang']),
            'kelurahan'           => fake('id_ID')->city(),
            'status'              => $status,
            'tmt'                 => $tmt->format('Y-m-d'),
            'is_certified'        => fake()->boolean(),
            'is_active'           => true,
            'is_verified'         => false,
            'is_sk_generated'     => false,
            'phone_number'        => fake()->phoneNumber(),
            'email'               => fake()->optional()->safeEmail(),
            'pdpkpnu'             => fake()->randomElement(['Sudah', 'Belum']),
        ];
    }

    public function forSchool(School $school): static
    {
        return $this->state(fn() => ['school_id' => $school->id]);
    }

    public function certified(): static
    {
        return $this->state(fn() => ['is_certified' => true]);
    }

    public function notCertified(): static
    {
        return $this->state(fn() => ['is_certified' => false]);
    }
}

