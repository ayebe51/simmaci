<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meeting_participants', function (Blueprint $table) {
            $table->id();

            // Foreign key to meetings
            $table->foreignId('meeting_id')
                ->constrained('meetings')
                ->cascadeOnDelete();

            // Participant type: teacher, headmaster, external
            $table->enum('participant_type', ['teacher', 'headmaster', 'external']);

            // Foreign key to teachers (nullable for external participants)
            $table->foreignId('participant_id')
                ->nullable()
                ->references('id')
                ->on('teachers')
                ->nullOnDelete();

            // Snapshot data of participant at the time meeting was created
            $table->string('name', 255);
            $table->string('jabatan', 255);
            $table->string('instansi', 255);

            // Normalized phone number (format: 62xxxxxxxxx)
            $table->string('phone_number', 20);

            // Signed token for QR_Personal (full signed URL stored)
            $table->text('qr_token')->nullable();

            // One-time use tracking
            $table->boolean('is_token_used')->default(false);
            $table->timestampTz('token_used_at')->nullable();

            // Token revocation flag (after regenerate QR)
            $table->boolean('token_revoked')->default(false);

            // Version for optimistic locking fallback
            $table->integer('version')->default(0);

            // Timestamps and soft deletes
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        // Add indexes
        DB::statement('CREATE INDEX idx_meeting_participants_meeting_id ON meeting_participants(meeting_id)');
        DB::statement('CREATE INDEX idx_meeting_participants_participant_id ON meeting_participants(participant_id) WHERE participant_id IS NOT NULL');
        DB::statement('CREATE INDEX idx_meeting_participants_is_token_used ON meeting_participants(is_token_used)');
        DB::statement('CREATE UNIQUE INDEX idx_meeting_participants_qr_token ON meeting_participants(qr_token) WHERE deleted_at IS NULL AND qr_token IS NOT NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_participants');
    }
};
