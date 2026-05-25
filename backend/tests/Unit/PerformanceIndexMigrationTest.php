<?php

namespace Tests\Unit;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PerformanceIndexMigrationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that migration runs without error on fresh database.
     * Requirements: 5.4, 5.5
     */
    public function test_migration_runs_without_error_on_fresh_database(): void
    {
        // The RefreshDatabase trait already runs all migrations including ours.
        // Verify the tables exist and the migration was recorded successfully.
        $this->assertTrue(
            Schema::hasTable('approval_histories'),
            'approval_histories table should exist after migration'
        );

        $this->assertTrue(
            Schema::hasTable('sk_documents'),
            'sk_documents table should exist after migration'
        );

        // Verify the migration completed by checking it was recorded in the migrations table
        $this->assertDatabaseHas('migrations', [
            'migration' => '2026_06_01_000001_add_performance_optimization_indexes',
        ]);
    }

    /**
     * Test that running migration twice does not throw (idempotency).
     * The try/catch pattern in the migration ensures duplicate index creation is silently skipped.
     * Requirements: 5.4, 5.5
     */
    public function test_running_migration_twice_does_not_throw(): void
    {
        // The migration has already run via RefreshDatabase.
        // Now run the migration up() logic again manually to test idempotency.
        $migration = require database_path('migrations/2026_06_01_000001_add_performance_optimization_indexes.php');

        // Running up() again should not throw thanks to try/catch pattern
        $exception = null;
        try {
            $migration->up();
        } catch (\Throwable $e) {
            $exception = $e;
        }

        $this->assertNull(
            $exception,
            'Running migration up() twice should not throw an exception (idempotency). Got: ' . ($exception?->getMessage() ?? '')
        );
    }
}
