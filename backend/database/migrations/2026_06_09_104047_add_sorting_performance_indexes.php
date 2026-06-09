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
        // Add indexes to improve pagination and sorting performance
        // especially for TeacherController::index and SkDocumentController::index

        try {
            Schema::table('teachers', function (Blueprint $table) {
                // For general sorting
                $table->index('updated_at', 'teachers_updated_at_index');
                // For operator filtering + sorting
                $table->index(['school_id', 'updated_at'], 'teachers_school_id_updated_at_index');
            });
        } catch (\Exception $e) {}

        try {
            Schema::table('sk_documents', function (Blueprint $table) {
                // For general sorting
                $table->index('created_at', 'sk_documents_created_at_index');
                // For SK Generator (where status = 'approved' order by created_at desc)
                $table->index(['status', 'created_at'], 'sk_documents_status_created_at_index');
            });
        } catch (\Exception $e) {}
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->dropIndexIfExists('teachers_updated_at_index');
            $table->dropIndexIfExists('teachers_school_id_updated_at_index');
        });

        Schema::table('sk_documents', function (Blueprint $table) {
            $table->dropIndexIfExists('sk_documents_created_at_index');
            $table->dropIndexIfExists('sk_documents_status_created_at_index');
        });
    }
};
