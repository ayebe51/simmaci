<?php

namespace Database\Seeders;

use App\Models\School;
use Illuminate\Database\Seeder;

class SchoolSeeder extends Seeder
{
    public function run(): void
    {
        \Illuminate\Support\Facades\DB::table('schools')->updateOrInsert(
            ['nsm' => '121233010001'],
            [
                'npsn' => '20363301',
                'nama' => 'MA Maarif NU 1 Cilacap',
                'alamat' => 'Jl. Rayat No. 1, Cilacap',
                'status' => 'Swasta',
                'kecamatan' => 'Cilacap Tengah',
                'kabupaten' => 'Cilacap',
                'provinsi' => 'Jawa Tengah',
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        $this->command->info('Default school created via DB::table');
    }
}
