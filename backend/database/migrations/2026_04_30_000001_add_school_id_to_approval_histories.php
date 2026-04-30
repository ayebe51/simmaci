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

        // Backfill school_id dari sk_documents berdasarkan document_id
        DB::statement("
            UPDATE approval_histories ah
            SET school_id = sd.school_id
            FROM sk_documents sd
            WHERE ah.document_id::bigint = sd.id
              AND ah.document_type = 'sk_document'
              AND sd.school_id IS NOT NULL
        ");
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
