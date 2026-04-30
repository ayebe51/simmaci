<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('approval_histories', function (Blueprint $table) {
            // SQLite tidak support ->after() dan ->constrained() via ALTER TABLE,
            // jadi kita tambah kolom nullable biasa — FK constraint hanya di pgsql.
            $table->unsignedBigInteger('school_id')->nullable();
            $table->index('school_id');
        });

        // FK constraint hanya untuk PostgreSQL (production)
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('
                ALTER TABLE approval_histories
                ADD CONSTRAINT approval_histories_school_id_foreign
                FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL
            ');
        }

        // Backfill school_id dari sk_documents berdasarkan document_id.
        // Hanya di pgsql karena pakai ::bigint cast dan subquery syntax.
        // Di test (SQLite :memory:) tabel selalu kosong, tidak perlu backfill.
        if (DB::getDriverName() === 'pgsql') {
            $hasData = DB::table('approval_histories')
                ->where('document_type', 'sk_document')
                ->whereNull('school_id')
                ->exists();

            if ($hasData) {
                DB::unprepared("
                    UPDATE approval_histories
                    SET school_id = (
                        SELECT sd.school_id
                        FROM sk_documents sd
                        WHERE sd.id = approval_histories.document_id::bigint
                          AND sd.school_id IS NOT NULL
                        LIMIT 1
                    )
                    WHERE document_type = 'sk_document'
                      AND school_id IS NULL
                ");
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('
                ALTER TABLE approval_histories
                DROP CONSTRAINT IF EXISTS approval_histories_school_id_foreign
            ');
        }

        Schema::table('approval_histories', function (Blueprint $table) {
            $table->dropIndex(['school_id']);
            $table->dropColumn('school_id');
        });
    }
};
