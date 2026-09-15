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
        // 1. Schools table: optimize public PPDB portal listing & jam'iyyah reports
        try {
            Schema::table('schools', function (Blueprint $table) {
                $table->index(['kecamatan', 'nama'], 'schools_kecamatan_nama_idx');
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('schools', function (Blueprint $table) {
                $table->index('status_jamiyyah', 'schools_status_jamiyyah_idx');
            });
        } catch (\Throwable $e) {}

        // 2. Students table: optimize student listing pagination, status aggregation & soft-delete filtering
        try {
            Schema::table('students', function (Blueprint $table) {
                $table->index(['school_id', 'status', 'deleted_at'], 'students_school_status_del_idx');
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('students', function (Blueprint $table) {
                $table->index(['school_id', 'updated_at'], 'students_school_updated_idx');
            });
        } catch (\Throwable $e) {}

        // 3. PPDB Periods: optimize active period checks on public and operator portal
        try {
            Schema::table('ppdb_periods', function (Blueprint $table) {
                $table->index(['school_id', 'is_active', 'start_date', 'end_date'], 'ppdb_periods_lookup_idx');
            });
        } catch (\Throwable $e) {}

        // 4. PPDB Registrations: optimize registration lookup, duplicate checks, and status filtering
        try {
            Schema::table('ppdb_registrations', function (Blueprint $table) {
                $table->index(['school_id', 'period_id', 'status'], 'ppdb_reg_school_period_status_idx');
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('ppdb_registrations', function (Blueprint $table) {
                $table->index('registration_number', 'ppdb_reg_number_idx');
            });
        } catch (\Throwable $e) {}

        // 5. Activity Logs: optimize recent activity feeds and export sorting
        try {
            Schema::table('activity_logs', function (Blueprint $table) {
                $table->index('created_at', 'activity_logs_created_at_idx');
            });
        } catch (\Throwable $e) {}

        try {
            Schema::table('activity_logs', function (Blueprint $table) {
                $table->index(['school_id', 'created_at'], 'activity_logs_school_created_idx');
            });
        } catch (\Throwable $e) {}

        // 6. SK Documents: optimize status filtering and created_at sorting
        try {
            Schema::table('sk_documents', function (Blueprint $table) {
                $table->index(['school_id', 'status', 'created_at'], 'sk_docs_school_status_created_idx');
            });
        } catch (\Throwable $e) {}
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('schools', function (Blueprint $table) {
            $table->dropIndexIfExists('schools_kecamatan_nama_idx');
            $table->dropIndexIfExists('schools_status_jamiyyah_idx');
        });

        Schema::table('students', function (Blueprint $table) {
            $table->dropIndexIfExists('students_school_status_del_idx');
            $table->dropIndexIfExists('students_school_updated_idx');
        });

        Schema::table('ppdb_periods', function (Blueprint $table) {
            $table->dropIndexIfExists('ppdb_periods_lookup_idx');
        });

        Schema::table('ppdb_registrations', function (Blueprint $table) {
            $table->dropIndexIfExists('ppdb_reg_school_period_status_idx');
            $table->dropIndexIfExists('ppdb_reg_number_idx');
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropIndexIfExists('activity_logs_created_at_idx');
            $table->dropIndexIfExists('activity_logs_school_created_idx');
        });

        Schema::table('sk_documents', function (Blueprint $table) {
            $table->dropIndexIfExists('sk_docs_school_status_created_idx');
        });
    }
};
