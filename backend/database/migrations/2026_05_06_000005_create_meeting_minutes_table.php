<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meeting_minutes', function (Blueprint $table) {
            $table->id();

            // Foreign key to meetings table
            $table->foreignId('meeting_id')
                ->constrained('meetings')
                ->cascadeOnDelete();

            // Minutes information
            $table->string('title', 255);
            $table->longText('content'); // HTML content from rich text editor

            // Audit trail
            $table->foreignId('created_by')
                ->constrained('users')
                ->restrictOnDelete();

            $table->foreignId('updated_by')
                ->nullable()
                ->references('id')
                ->on('users')
                ->nullOnDelete();

            // Timestamps and soft deletes
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        // Add indexes
        DB::statement('CREATE INDEX idx_meeting_minutes_meeting_id ON meeting_minutes(meeting_id)');
        DB::statement('CREATE INDEX idx_meeting_minutes_created_by ON meeting_minutes(created_by)');
        DB::statement('CREATE INDEX idx_meeting_minutes_updated_by ON meeting_minutes(updated_by)');
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_minutes');
    }
};
