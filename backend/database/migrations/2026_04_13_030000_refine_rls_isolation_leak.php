<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        // Tables that should NOT allow orphaned operators (empty string '')
        // because they contain sensitive data that should be strictly isolated.
        $tables = [
            'teachers' => 'school_id',
            'students' => 'school_id',
            'sk_documents' => 'school_id',
        ];

        foreach ($tables as $table => $column) {
            $policyName = "tenant_isolation_{$table}";

            // Drop existing loose policy
            DB::statement("DROP POLICY IF EXISTS {$policyName} ON {$table}");

            // Create refined policy:
            // 1. IS NULL -> Super Admin (via SET TO DEFAULT)
            // 2. school_id matches -> Linked Operator
            // Note: We REMOVED the 'OR current_setting(...) = ''' part.
            DB::statement("
                CREATE POLICY {$policyName} ON {$table}
                USING (
                    current_setting('app.current_school_id', true) IS NULL
                    OR {$column} = (NULLIF(current_setting('app.current_school_id', true), '')::bigint)
                )
            ");
        }
        
        // Final check: MI Ma'arif Gandrungmanis (User 59) MUST be linked to School 62.
        // I already did this in the debug script, but doing it again in migration for permanence.
        DB::table('users')
          ->where('name', 'MI Ma\'arif Gandrungmanis')
          ->whereNull('school_id')
          ->update(['school_id' => 62]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $tables = [
            'teachers' => 'school_id',
            'students' => 'school_id',
            'sk_documents' => 'school_id',
        ];

        foreach ($tables as $table => $column) {
            $policyName = "tenant_isolation_{$table}";
            DB::statement("DROP POLICY IF EXISTS {$policyName} ON {$table}");
            
            // Revert to loose policy if needed (but usually we don't want to revert to a leak)
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
};
