<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Otomatis sinkronkan kepala madrasah aktif ke profil tabel schools saat proses deploy.
     */
    public function up(): void
    {
        if (Schema::hasTable('headmaster_tenures') && Schema::hasTable('schools')) {
            try {
                Artisan::call('headmaster:sync-to-schools');
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Migration sync-to-schools skipped/failed: ' . $e->getMessage());
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op
    }
};
