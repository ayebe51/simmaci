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
            $table->foreignId('school_id')
                ->nullable()
                ->after('id')
                ->constrained('schools')
                ->nullOnDelete();

            $table->index('school_id');
        });

        // Backfill school_id dari sk_documents berdasarkan document_id.
        // Dilewati jika tabel kosong (environment test/fresh install).
        // Di production dengan data existing, jalankan manual via tinker jika perlu:
        //   DB::unprepared("UPDATE approval_histories SET school_id = (SELECT sd.school_id FROM sk_documents sd WHERE sd.id = approval_histories.document_id::bigint LIMIT 1) WHERE document_type = 'sk_document' AND school_id IS NULL");
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
        Schema::table('approval_histories', function (Blueprint $table) {
            $table->dropForeign(['school_id']);
            $table->dropIndex(['school_id']);
            $table->dropColumn('school_id');
        });
    }
};
