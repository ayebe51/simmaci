<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            SchoolSeeder::class,
        ]);

        $defaultSchool = \App\Models\School::first();

        // 1. Super Admin
        User::updateOrCreate(
            ['email' => 'admin@maarif.nu'],
            [
                'name'      => 'Super Admin',
                'password'  => 'admin123',
                'role'      => 'super_admin',
                'is_active' => true,
            ]
        );

        // 2. Admin Yayasan
        User::updateOrCreate(
            ['email' => 'yayasan@maarif.nu'],
            [
                'name'      => 'Admin Yayasan',
                'password'  => 'admin123',
                'role'      => 'admin_yayasan',
                'is_active' => true,
            ]
        );

        // 3. Operator
        User::updateOrCreate(
            ['email' => 'operator@maarif.nu'],
            [
                'name'      => 'Operator Sekolah',
                'password'  => 'admin123',
                'role'      => 'operator',
                'school_id' => $defaultSchool?->id,
                'is_active' => true,
            ]
        );

        $this->command->info('Users created:');
        $this->command->info('- Superadmin: admin@maarif.nu / admin123');
        $this->command->info('- Admin Yayasan: yayasan@maarif.nu / admin123');
        $this->command->info('- Operator: operator@maarif.nu / admin123');
    }
}
