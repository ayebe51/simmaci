<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class WarmupApplication extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:warmup';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Warm up application connections to prevent cold start timeouts';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Warming up application...');

        try {
            // Warm up database connection with real query
            $this->info('Testing database connection...');
            DB::select('SELECT 1');
            $this->info('✓ Database connection OK');

            // Warm up cache connection
            $this->info('Testing cache connection...');
            Cache::remember('warmup_' . now()->timestamp, 60, fn() => 'ok');
            $this->info('✓ Cache connection OK');

            // Warm up config
            $this->info('Loading config...');
            config('app.name');
            config('database.default');
            $this->info('✓ Config loaded');

            // Probe local HTTP API worker if available
            try {
                $response = Http::timeout(2)->get('http://127.0.0.1/api/health');
                if ($response->successful()) {
                    $this->info('✓ HTTP PHP-FPM worker pool probe OK');
                }
            } catch (\Throwable $e) {
                // Ignore if running outside the web container (e.g. separate scheduler)
            }

            $this->newLine();
            $this->info('Application warmed up successfully!');

            return 0;
        } catch (\Exception $e) {
            $this->error('Warmup failed: ' . $e->getMessage());
            return 1;
        }
    }
}
