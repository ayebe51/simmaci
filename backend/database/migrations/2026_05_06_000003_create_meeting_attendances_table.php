<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meeting_attendances', function (Blueprint $table) {
            $table->id();

            // Foreign key to meetings
            $table->foreignId('meeting_id')
                ->constrained('meetings')
                ->cascadeOnDelete();

            // Foreign key to meeting_participants (nullable for walk-in)
            $table->foreignId('participant_id')
                ->nullable()
                ->references('id')
                ->on('meeting_participants')
                ->nullOnDelete();

            // Attendance type: qr_personal, qr_umum, manual
            $table->enum('attendance_type', ['qr_personal', 'qr_umum', 'manual']);

            // Delegation flag
            $table->boolean('is_delegation')->default(false);

            // Participant being represented (if delegation)
            $table->foreignId('delegated_for_participant_id')
                ->nullable()
                ->references('id')
                ->on('meeting_participants')
                ->nullOnDelete();

            // Path to delegation letter file in Laravel Storage
            $table->string('delegation_letter_path', 500)->nullable();

            // Walk-in participant data (nullable, only for qr_umum)
            $table->string('walk_in_name', 255)->nullable();
            $table->string('walk_in_jabatan', 255)->nullable();
            $table->string('walk_in_instansi', 255)->nullable();
            $table->string('walk_in_phone', 20)->nullable();

            // Check-in timestamp with microsecond precision
            $table->timestampTz('checked_in_at', precision: 6);

            // Admin who performed manual check-in (nullable)
            $table->foreignId('checked_in_by_admin_id')
                ->nullable()
                ->references('id')
                ->on('users')
                ->nullOnDelete();

            // Device information (JSON)
            $table->jsonb('device_info')->nullable();

            // IP address of check-in
            $table->string('ip_address', 45)->nullable();

            // Version for optimistic locking fallback
            $table->integer('version')->default(0);

            // Timestamps and soft deletes
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        // Add indexes
        DB::statement('CREATE INDEX idx_meeting_attendances_meeting_id ON meeting_attendances(meeting_id)');
        DB::statement('CREATE INDEX idx_meeting_attendances_participant_id ON meeting_attendances(participant_id) WHERE participant_id IS NOT NULL');
        DB::statement('CREATE INDEX idx_meeting_attendances_checked_in_at ON meeting_attendances(checked_in_at)');
        DB::statement('CREATE INDEX idx_meeting_attendances_attendance_type ON meeting_attendances(attendance_type)');
        DB::statement('CREATE INDEX idx_meeting_attendances_ip_address ON meeting_attendances(ip_address)');
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_attendances');
    }
};
