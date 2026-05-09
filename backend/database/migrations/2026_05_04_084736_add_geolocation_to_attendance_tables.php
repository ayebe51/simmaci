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
        // Add geolocation columns to teacher_attendances
        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->decimal('latitude', 10, 8)->nullable()->after('scanned_by');
            $table->decimal('longitude', 11, 8)->nullable()->after('latitude');
            $table->boolean('location_verified')->nullable()->after('longitude');
        });

        // Add geolocation columns to student_attendance_logs
        Schema::table('student_attendance_logs', function (Blueprint $table) {
            $table->decimal('latitude', 10, 8)->nullable()->after('logs');
            $table->decimal('longitude', 11, 8)->nullable()->after('latitude');
            $table->boolean('location_verified')->nullable()->after('longitude');
        });

        // Add geofencing settings to attendance_settings
        Schema::table('attendance_settings', function (Blueprint $table) {
            $table->boolean('geolocation_enabled')->default(false)->after('gowa_device_id');
            $table->decimal('school_latitude', 10, 8)->nullable()->after('geolocation_enabled');
            $table->decimal('school_longitude', 11, 8)->nullable()->after('school_latitude');
            $table->integer('geofence_radius_meters')->default(100)->after('school_longitude');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->dropColumn(['latitude', 'longitude', 'location_verified']);
        });

        Schema::table('student_attendance_logs', function (Blueprint $table) {
            $table->dropColumn(['latitude', 'longitude', 'location_verified']);
        });

        Schema::table('attendance_settings', function (Blueprint $table) {
            $table->dropColumn(['geolocation_enabled', 'school_latitude', 'school_longitude', 'geofence_radius_meters']);
        });
    }
};
