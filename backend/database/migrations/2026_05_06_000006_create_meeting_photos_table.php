<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meeting_photos', function (Blueprint $table) {
            $table->id();

            // Foreign key to meetings table
            $table->foreignId('meeting_id')
                ->constrained('meetings')
                ->cascadeOnDelete();

            // Photo file information
            $table->string('original_filename', 255); // Original filename from upload
            $table->string('storage_path', 500); // Path in Laravel Storage (meetings/{meeting_id}/photos/{filename})
            $table->string('thumbnail_path', 500)->nullable(); // Path to thumbnail (meetings/{meeting_id}/photos/thumbnails/{filename})

            // Photo metadata
            $table->bigInteger('file_size'); // File size in bytes
            $table->integer('width'); // Image width in pixels
            $table->integer('height'); // Image height in pixels
            $table->string('mime_type', 50); // MIME type (image/jpeg, image/png, etc.)

            // Audit trail
            $table->foreignId('uploaded_by')
                ->constrained('users')
                ->restrictOnDelete();

            // Timestamps and soft deletes
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        // Add indexes for performance
        DB::statement('CREATE INDEX idx_meeting_photos_meeting_id ON meeting_photos(meeting_id)');
        DB::statement('CREATE INDEX idx_meeting_photos_uploaded_by ON meeting_photos(uploaded_by)');
        DB::statement('CREATE INDEX idx_meeting_photos_created_at ON meeting_photos(created_at)');
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_photos');
    }
};
