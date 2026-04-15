<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Teachers — most queried columns
        try {
            Schema::table('teachers', function (Blueprint $table) {
                $table->index(['school_id', 'is_active'], 'teachers_school_id_is_active_index');
            });
        } catch (\Exception $e) {}

        try {
            Schema::table('teachers', function (Blueprint $table) {
                $table->index(['school_id', 'status'], 'teachers_school_id_status_index');
            });
        } catch (\Exception $e) {}

        // Students
        try {
            Schema::table('students', function (Blueprint $table) {
                $table->index(['school_id', 'status'], 'students_school_id_status_index');
            });
        } catch (\Exception $e) {}

        // SK Documents
        try {
            Schema::table('sk_documents', function (Blueprint $table) {
                $table->index(['school_id', 'status'], 'sk_documents_school_id_status_index');
            });
        } catch (\Exception $e) {}

        // Notifications — unread count query
        try {
            Schema::table('notifications', function (Blueprint $table) {
                $table->index(['user_id', 'is_read'], 'notifications_user_id_is_read_index');
            });
        } catch (\Exception $e) {}

        // Activity logs
        try {
            Schema::table('activity_logs', function (Blueprint $table) {
                $table->index(['school_id', 'id'], 'activity_logs_school_id_id_index');
            });
        } catch (\Exception $e) {}
    }

    public function down(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->dropIndexIfExists('teachers_school_id_is_active_index');
            $table->dropIndexIfExists('teachers_school_id_status_index');
        });
        Schema::table('students', function (Blueprint $table) {
            $table->dropIndexIfExists('students_school_id_status_index');
        });
        Schema::table('sk_documents', function (Blueprint $table) {
            $table->dropIndexIfExists('sk_documents_school_id_status_index');
        });
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndexIfExists('notifications_user_id_is_read_index');
        });
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropIndexIfExists('activity_logs_school_id_id_index');
        });
    }
};
