<?php

namespace App\Console\Commands;

use App\Models\School;
use App\Models\User;
use Illuminate\Console\Command;

class GenerateOperatorAccounts extends Command
{
    protected $signature = 'schools:generate-accounts {--force : Regenerate even if account exists}';
    protected $description = 'Generate operator accounts for all schools (NSM@simmaci.com / NSM)';

    public function handle(): int
    {
        $schools = School::all();
        $created = 0;
        $skipped = 0;

        $this->info("Processing {$schools->count()} schools...");
        $bar = $this->output->createProgressBar($schools->count());
        $bar->start();

        foreach ($schools as $school) {
            $nsm = $school->nsm ? strtolower(trim($school->nsm)) : null;
            $email = $nsm ? "{$nsm}@simmaci.com" : ('school' . $school->id . '@simmaci.com');
            $passwordPlain = $school->nsm ?: ('school' . $school->id);

            if (! $this->option('force') && User::where('email', $email)->exists()) {
                $skipped++;
                $bar->advance();
                continue;
            }

            User::updateOrCreate(
                ['email' => $email],
                [
                    'name'      => $school->nama,
                    'password'  => $passwordPlain,
                    'role'      => 'operator',
                    'is_active' => true,
                    'school_id' => $school->id,
                ]
            );

            $created++;
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("Done! Created: {$created}, Skipped: {$skipped}");

        return Command::SUCCESS;
    }
}
