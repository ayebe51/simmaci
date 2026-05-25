<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Approval Histories — filter by document reference
        try {
            Schema::table('approval_histories', function (Blueprint $table) {
                $table->index(['document_id', 'document_type'], 'approval_histories_document_id_document_type_index');
            });
        } catch (\Exception $e) {}

        // SK Documents — tenant-scoped reverse chronological listing
        try {
            Schema::table('sk_documents', function (Blueprint $table) {
                $table->index(['school_id', 'created_at'], 'sk_documents_school_id_created_at_index');
            });
        } catch (\Exception $e) {}
    }

    public function down(): void
    {
        Schema::table('approval_histories', function (Blueprint $table) {
            $table->dropIndexIfExists('approval_histories_document_id_document_type_index');
        });
        Schema::table('sk_documents', function (Blueprint $table) {
            $table->dropIndexIfExists('sk_documents_school_id_created_at_index');
        });
    }
};
