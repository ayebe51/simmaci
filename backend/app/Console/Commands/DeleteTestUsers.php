<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class DeleteTestUsers extends Command
{
    protected $signature = 'users:delete-test-users';

    protected $description = 'Permanently delete test users (MI Wahidiyah and MI Testing)';

    public function handle()
    {
        $this->info('Mencari user untuk dihapus...');

        $emails = [
            '112334456712@simmaci.com',
            '112233445566@simmaci.com',
        ];

        $users = User::whereIn('email', $emails)->get();

        if ($users->isEmpty()) {
            $this->warn('Tidak ada user yang ditemukan dengan email tersebut.');
            return Command::SUCCESS;
        }

        $this->newLine();
        $this->info('User yang akan dihapus:');
        foreach ($users as $user) {
            $this->line("- {$user->name} ({$user->email}) - Role: {$user->role}");
        }
        $this->newLine();

        if (!$this->confirm('Apakah Anda yakin ingin menghapus user ini secara PERMANENT?', false)) {
            $this->info('Penghapusan dibatalkan.');
            return Command::SUCCESS;
        }

        $deletedCount = 0;
        foreach ($users as $user) {
            $name = $user->name;
            $email = $user->email;
            
            // Delete related notifications first
            $user->notifications()->delete();
            
            // Delete the user
            $user->delete();
            
            $this->info("✓ User '{$name}' ({$email}) berhasil dihapus.");
            $deletedCount++;
        }

        $this->newLine();
        $this->info("Total {$deletedCount} user berhasil dihapus.");

        return Command::SUCCESS;
    }
}
