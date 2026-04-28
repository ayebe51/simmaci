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

        // 1. Super Admin
        User::updateOrCreate(
            ['email' => 'admin@simmaci.com'],
            [
                'name'      => 'Super Admin',
                'password'  => 'admin123',
                'role'      => 'super_admin',
                'is_active' => true,
            ]
        );

        // 2. Admin Yayasan
        User::updateOrCreate(
            ['email' => 'yayasan@simmaci.com'],
            [
                'name'      => 'Admin Yayasan',
                'password'  => 'admin123',
                'role'      => 'admin_yayasan',
                'is_active' => true,
            ]
        );

        User::updateOrCreate(
            ['email' => 'yayasan2@simmaci.com'],
            [
                'name'      => 'Admin Yayasan 2',
                'password'  => 'admin123',
                'role'      => 'admin_yayasan',
                'is_active' => true,
            ]
        );

        User::updateOrCreate(
            ['email' => 'yayasan3@simmaci.com'],
            [
                'name'      => 'Admin Yayasan 3',
                'password'  => 'admin123',
                'role'      => 'admin_yayasan',
                'is_active' => true,
            ]
        );

        User::updateOrCreate(
            ['email' => 'yayasan4@simmaci.com'],
            [
                'name'      => 'Admin Yayasan 4',
                'password'  => 'admin123',
                'role'      => 'admin_yayasan',
                'is_active' => true,
            ]
        );

        // Operator accounts are generated per-school after school data is uploaded

        $this->command->info('Users created:');
        $this->command->info('- Superadmin: admin@simmaci.com / admin123');
        $this->command->info('- Admin Yayasan: yayasan@simmaci.com / admin123');
        $this->command->info('- Admin Yayasan 2: yayasan2@simmaci.com / admin123');
        $this->command->info('- Admin Yayasan 3: yayasan3@simmaci.com / admin123');
        $this->command->info('- Admin Yayasan 4: yayasan4@simmaci.com / admin123');
    }
}
