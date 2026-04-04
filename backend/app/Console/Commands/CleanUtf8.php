<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CleanUtf8 extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:clean-utf8';
    protected $description = 'Clean malformed UTF-8 characters from the database';

    public function handle()
    {
        $tables = ['schools', 'notifications', 'teachers', 'students', 'users', 'activity_logs', 'sk_documents'];
        foreach ($tables as $table) {
            if (!\Illuminate\Support\Facades\Schema::hasTable($table)) continue;
            $this->info("Checking table: $table");
            
            \Illuminate\Support\Facades\DB::table($table)->orderBy('id')->chunk(100, function ($rows) use ($table) {
                foreach ($rows as $row) {
                    $updates = [];
                    foreach ($row as $key => $val) {
                        if (is_string($val) && !empty($val)) {
                            $clean = htmlspecialchars_decode(htmlspecialchars($val, ENT_SUBSTITUTE, 'UTF-8'));
                            if ($clean !== $val) {
                                $updates[$key] = $clean;
                            }
                        }
                    }
                    if (!empty($updates)) {
                        $this->line("Fixing ID {$row->id} in $table");
                        \Illuminate\Support\Facades\DB::table($table)->where('id', $row->id)->update($updates);
                    }
                }
            });
        }
        $this->info("Database sanitization complete.");
    }
}
