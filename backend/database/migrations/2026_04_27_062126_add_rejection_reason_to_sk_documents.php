<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Guard: kolom ini mungkin sudah ada di production (ditambah manual sebelumnya)
        if (!Schema::hasColumn('sk_documents', 'rejection_reason')) {
            Schema::table('sk_documents', function (Blueprint $table) {
                $table->text('rejection_reason')->nullable()->after('revision_data');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sk_documents', function (Blueprint $table) {
            $table->dropColumn('rejection_reason');
        });
    }
};
