<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meetings', function (Blueprint $table) {
            $table->id();

            // Basic meeting information
            $table->string('title', 255);
            $table->text('agenda')->nullable();
            $table->string('location', 255)->nullable();

            // Meeting timing
            $table->timestampTz('started_at');
            $table->timestampTz('ended_at');

            // Geolocation settings
            $table->boolean('geolocation_enabled')->default(false);
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->integer('geolocation_radius_meters')->nullable();

            // QR tokens — stored as TEXT because signed URLs can exceed 255 chars
            $table->text('qr_umum_token')->nullable();

            // WA Blast references
            $table->foreignId('invitation_blast_id')
                ->nullable()
                ->references('id')
                ->on('wa_blasts')
                ->nullOnDelete();

            $table->foreignId('reminder_blast_id')
                ->nullable()
                ->references('id')
                ->on('wa_blasts')
                ->nullOnDelete();

            // Reminder scheduling
            $table->timestampTz('reminder_scheduled_at')->nullable();

            // Creator reference
            $table->foreignId('created_by')
                ->constrained('users')
                ->restrictOnDelete();

            // Timestamps and soft deletes
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        // Add constraints (only for databases that support ALTER TABLE ADD CONSTRAINT)
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement('ALTER TABLE meetings ADD CONSTRAINT check_ended_at_greater_than_started_at CHECK (ended_at > started_at)');
            DB::statement('ALTER TABLE meetings ADD CONSTRAINT check_geolocation_radius_valid CHECK (geolocation_radius_meters >= 10 OR geolocation_radius_meters IS NULL)');
        }

        // Add indexes
        DB::statement('CREATE INDEX idx_meetings_created_by ON meetings(created_by)');
        DB::statement('CREATE INDEX idx_meetings_started_at ON meetings(started_at)');
    }

    public function down(): void
    {
        Schema::dropIfExists('meetings');
    }
};
