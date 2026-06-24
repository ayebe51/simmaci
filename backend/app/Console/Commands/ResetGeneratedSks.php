<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\SkDocument;

class ResetGeneratedSks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:reset-generated-sks';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Reset generated SK documents (clear file_url and nomor_sk)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $count = SkDocument::where('file_url', 'like', 'Generated via Bulk%')
            ->update([
                'file_url' => null,
                'nomor_sk' => null,
            ]);

        $this->info("Successfully reset $count SK documents.");
    }
}
