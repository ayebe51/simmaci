<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * This migration fixes the RLS policies to be more robust against casting errors.
     * Instead of raw CAST, we use NULLIF to handle empty strings gracefully.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            $tables = ['schools', 'teachers', 'students', 'sk_documents'];

            foreach ($tables as $table) {
                // Determine ID column name (mostly school_id, except for schools table itself)
                $column = ($table === 'schools') ? 'id' : 'school_id';
                $policyName = "tenant_isolation_{$table}";

                DB::statement("DROP POLICY IF EXISTS {$policyName} ON {$table}");
                
                // New robust policy
                // current_setting(..., true) returns NULL or string
                // NULLIF converts '' to NULL
                // Cast to bigint only if not NULL
                DB::statement("
                    CREATE POLICY {$policyName} ON {$table}
                    USING (
                        current_setting('app.current_school_id', true) IS NULL
                        OR current_setting('app.current_school_id', true) = ''
                        OR {$column} = (NULLIF(current_setting('app.current_school_id', true), '')::bigint)
                    )
                ");
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            $tables = ['schools', 'teachers', 'students', 'sk_documents'];

            foreach ($tables as $table) {
                $column = ($table === 'schools') ? 'id' : 'school_id';
                $policyName = "tenant_isolation_{$table}";

                DB::statement("DROP POLICY IF EXISTS {$policyName} ON {$table}");
                
                // Revert to original potentially brittle policy (for consistency with old migrations)
                DB::statement("
                    CREATE POLICY {$policyName} ON {$table}
                    USING (
                        current_setting('app.current_school_id', true) IS NULL
                        OR current_setting('app.current_school_id', true) = ''
                        OR {$column} = current_setting('app.current_school_id', true)::bigint
                    )
                ");
            }
        }
    }
};
