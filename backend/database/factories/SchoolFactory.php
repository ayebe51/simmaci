<?php

namespace Database\Factories;

use App\Models\School;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<School>
 */
class SchoolFactory extends Factory
{
    protected $model = School::class;

    public function definition(): array
    {
        $jenjang = fake()->randomElement(['MI', 'MTs', 'MA', 'SMK']);

        return [
            'nsm'              => fake()->unique()->numerify('##############'),
            'npsn'             => fake()->unique()->numerify('########'),
            'nama'             => "{$jenjang} " . fake('id_ID')->company(),
            'alamat'           => fake('id_ID')->address(),
            'provinsi'         => 'Jawa Tengah',
            'kabupaten'        => 'Cilacap',
            'kecamatan'        => fake()->randomElement(['Cilacap Selatan', 'Kroya', 'Wanareja', 'Majenang']),
            'kelurahan'        => fake('id_ID')->city(),
            'telepon'          => fake()->phoneNumber(),
            'email'            => fake()->unique()->safeEmail(),
            'kepala_madrasah'  => fake('id_ID')->name(),
            'akreditasi'       => fake()->randomElement(['A', 'B', 'C', null]),
            'status'           => 'active',
        ];
    }
}
