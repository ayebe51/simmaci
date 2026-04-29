<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Adds ijazah_url column to sk_documents table for storing
     * the path/URL of the uploaded ijazah PDF file.
     */
    public function up(): void
    {
        Schema::table('sk_documents', function (Blueprint $table) {
            $table->string('ijazah_url', 500)->nullable()->after('revision_data');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sk_documents', function (Blueprint $table) {
            $table->dropColumn('ijazah_url');
        });
    }
};
