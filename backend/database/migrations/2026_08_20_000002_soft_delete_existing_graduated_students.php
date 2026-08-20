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
        // Backfill soft delete for existing students with status 'Lulus' or 'Keluar' whose deleted_at IS NULL
        DB::table('students')
            ->whereIn('status', ['Lulus', 'Keluar'])
            ->whereNull('deleted_at')
            ->update([
                'deleted_at' => DB::raw('COALESCE(updated_at, NOW())')
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Restore soft-deleted students with status 'Lulus' or 'Keluar' if needed
        DB::table('students')
            ->whereIn('status', ['Lulus', 'Keluar'])
            ->whereNotNull('deleted_at')
            ->update([
                'deleted_at' => null
            ]);
    }
};
