<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SchoolSeeder extends Seeder
{
    public function run(): void
    {
        $schools = [
            [
                'nsm' => '121233010001',
                'npsn' => '20363301',
                'nama' => 'MA Maarif NU 1 Cilacap',
                'alamat' => 'Jl. Dr. Soetomo No. 12, Sidakaya',
                'status' => 'Swasta',
                'status_jamiyyah' => 'Jam\'iyyah',
                'kecamatan' => 'Cilacap Tengah',
                'kabupaten' => 'Cilacap',
                'provinsi' => 'Jawa Tengah',
                'jenjang' => 'MA',
            ],
            [
                'nsm' => '111233010032',
                'npsn' => '60707101',
                'nama' => 'MI Ya Bakii Kesugihan 01',
                'alamat' => 'Jl. Kemerdekaan Timur No. 45',
                'status' => 'Swasta',
                'status_jamiyyah' => 'Jama\'ah',
                'kecamatan' => 'Kesugihan',
                'kabupaten' => 'Cilacap',
                'provinsi' => 'Jawa Tengah',
                'jenjang' => 'MI',
            ],
            [
                'nsm' => '111233010033',
                'npsn' => '60707102',
                'nama' => 'MI Ma\'arif NU 02 Kesugihan',
                'alamat' => 'Jl. Pesantren No. 9, Kesugihan Kidul',
                'status' => 'Swasta',
                'status_jamiyyah' => 'Jam\'iyyah',
                'kecamatan' => 'Kesugihan',
                'kabupaten' => 'Cilacap',
                'provinsi' => 'Jawa Tengah',
                'jenjang' => 'MI',
            ],
            [
                'nsm' => '121233010015',
                'npsn' => '20363315',
                'nama' => 'MTs Ma\'arif NU 01 Kroya',
                'alamat' => 'Jl. Yos Sudarso No. 100, Kroya',
                'status' => 'Swasta',
                'status_jamiyyah' => 'Jam\'iyyah',
                'kecamatan' => 'Kroya',
                'kabupaten' => 'Cilacap',
                'provinsi' => 'Jawa Tengah',
                'jenjang' => 'MTs',
            ],
            [
                'nsm' => '131233010020',
                'npsn' => '20363320',
                'nama' => 'SMK Ma\'arif 1 Kroya',
                'alamat' => 'Jl. Bhayangkara No. 25, Kroya',
                'status' => 'Swasta',
                'status_jamiyyah' => 'Jam\'iyyah',
                'kecamatan' => 'Kroya',
                'kabupaten' => 'Cilacap',
                'provinsi' => 'Jawa Tengah',
                'jenjang' => 'SMK',
            ],
            [
                'nsm' => '111233010037',
                'npsn' => '60707105',
                'nama' => 'MI Ma\'arif NU 03 Karangkemiri',
                'alamat' => 'Jl. Raya Karangkemiri, Jeruklegi',
                'status' => 'Swasta',
                'status_jamiyyah' => 'Jam\'iyyah',
                'kecamatan' => 'Jeruklegi',
                'kabupaten' => 'Cilacap',
                'provinsi' => 'Jawa Tengah',
                'jenjang' => 'MI',
            ],
            [
                'nsm' => '121233010077',
                'npsn' => '20363377',
                'nama' => 'MTs PP El-Bayan Majenang',
                'alamat' => 'Jl. Bantarpanjang No. 1, Padangsari',
                'status' => 'Swasta',
                'status_jamiyyah' => 'Jama\'ah',
                'kecamatan' => 'Majenang',
                'kabupaten' => 'Cilacap',
                'provinsi' => 'Jawa Tengah',
                'jenjang' => 'MTs',
            ],
            [
                'nsm' => '121233010078',
                'npsn' => '20363378',
                'nama' => 'MA Ma\'arif NU 1 Majenang',
                'alamat' => 'Jl. Diponegoro No. 88, Majenang',
                'status' => 'Swasta',
                'status_jamiyyah' => 'Jam\'iyyah',
                'kecamatan' => 'Majenang',
                'kabupaten' => 'Cilacap',
                'provinsi' => 'Jawa Tengah',
                'jenjang' => 'MA',
            ],
            [
                'nsm' => '131233010050',
                'npsn' => '20363350',
                'nama' => 'SMK Ma\'arif 1 Cilacap',
                'alamat' => 'Jl. Angsana No. 15, Cilacap Selatan',
                'status' => 'Swasta',
                'status_jamiyyah' => 'Jam\'iyyah',
                'kecamatan' => 'Cilacap Selatan',
                'kabupaten' => 'Cilacap',
                'provinsi' => 'Jawa Tengah',
                'jenjang' => 'SMK',
            ],
            [
                'nsm' => '111233010055',
                'npsn' => '60707110',
                'nama' => 'MI Ma\'arif NU 01 Gandrungmangu',
                'alamat' => 'Jl. Kutilang No. 7, Gandrungmangu',
                'status' => 'Swasta',
                'status_jamiyyah' => 'Jam\'iyyah',
                'kecamatan' => 'Gandrungmangu',
                'kabupaten' => 'Cilacap',
                'provinsi' => 'Jawa Tengah',
                'jenjang' => 'MI',
            ],
            [
                'nsm' => '121233010060',
                'npsn' => '20363360',
                'nama' => 'MTs Ma\'arif NU 01 Sidareja',
                'alamat' => 'Jl. Raya Kunci No. 12, Sidareja',
                'status' => 'Swasta',
                'status_jamiyyah' => 'Jam\'iyyah',
                'kecamatan' => 'Sidareja',
                'kabupaten' => 'Cilacap',
                'provinsi' => 'Jawa Tengah',
                'jenjang' => 'MTs',
            ],
            [
                'nsm' => '111233010070',
                'npsn' => '60707120',
                'nama' => 'MI Ma\'arif NU 01 Adipala',
                'alamat' => 'Jl. Laut No. 3, Adipala',
                'status' => 'Swasta',
                'status_jamiyyah' => 'Jam\'iyyah',
                'kecamatan' => 'Adipala',
                'kabupaten' => 'Cilacap',
                'provinsi' => 'Jawa Tengah',
                'jenjang' => 'MI',
            ],
        ];

        foreach ($schools as $school) {
            DB::table('schools')->updateOrInsert(
                ['nsm' => $school['nsm']],
                array_merge($school, [
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
            );
        }

        // Pastikan ada gelombang serentak aktif (school_id = null)
        DB::table('ppdb_periods')->updateOrInsert(
            [
                'academic_year' => '2026/2027',
                'wave_name' => 'Gelombang 1 - Serentak LP Ma\'arif',
                'school_id' => null,
            ],
            [
                'quota' => 100,
                'start_date' => now()->subDays(5)->toDateString(),
                'end_date' => now()->addDays(60)->toDateString(),
                'announcement_date' => now()->addDays(65)->toDateString(),
                'reregistration_end_date' => now()->addDays(75)->toDateString(),
                'is_active' => true,
                'available_tracks' => json_encode(['reguler', 'prestasi', 'afirmasi', 'tahfidz']),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        $this->command->info('Representative Ma\'arif NU Cilacap schools and global PPDB period created.');
    }
}
