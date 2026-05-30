<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        // Step 1: Clean up existing duplicates before creating the unique index.
        // For each group of duplicate nomor_induk_maarif values, keep the most recently
        // updated record and set the others to NULL.
        DB::statement("
            UPDATE teachers
            SET nomor_induk_maarif = NULL
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY nomor_induk_maarif
                               ORDER BY updated_at DESC NULLS LAST, id DESC
                           ) AS rn
                    FROM teachers
                    WHERE nomor_induk_maarif IS NOT NULL
                      AND nomor_induk_maarif != ''
                      AND deleted_at IS NULL
                ) ranked
                WHERE rn > 1
            )
        ");

        // Also clean up duplicates among soft-deleted records to avoid index conflicts
        DB::statement("
            UPDATE teachers
            SET nomor_induk_maarif = NULL
            WHERE deleted_at IS NOT NULL
              AND nomor_induk_maarif IS NOT NULL
              AND nomor_induk_maarif != ''
              AND nomor_induk_maarif IN (
                  SELECT nomor_induk_maarif
                  FROM teachers
                  WHERE deleted_at IS NULL
                    AND nomor_induk_maarif IS NOT NULL
                    AND nomor_induk_maarif != ''
              )
        ");

        // Step 2: Create partial unique index.
        // Only enforces uniqueness for non-NULL, non-empty, non-deleted records.
        DB::statement("
            CREATE UNIQUE INDEX teachers_nomor_induk_maarif_unique
            ON teachers (nomor_induk_maarif)
            WHERE nomor_induk_maarif IS NOT NULL
              AND nomor_induk_maarif != ''
              AND deleted_at IS NULL
        ");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS teachers_nomor_induk_maarif_unique');
    }
};
