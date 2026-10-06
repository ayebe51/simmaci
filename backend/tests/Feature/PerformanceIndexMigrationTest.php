<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PerformanceIndexMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_optimize_performance_indexes_migration_up_and_down(): void
    {
        $migration = require database_path('migrations/2026_10_06_000001_optimize_performance_indexes.php');

        // Test up() runs cleanly
        $migration->up();
        $this->assertTrue(Schema::hasTable('meeting_attendances'));
        $this->assertTrue(Schema::hasTable('meeting_participants'));
        $this->assertTrue(Schema::hasTable('sk_documents'));
        $this->assertTrue(Schema::hasTable('activity_logs'));
        $this->assertTrue(Schema::hasTable('headmaster_tenures'));

        // Test down() runs cleanly
        $migration->down();
        $this->assertTrue(true);

        // Re-run up() to leave database in clean state
        $migration->up();
        $this->assertTrue(true);
    }
}
