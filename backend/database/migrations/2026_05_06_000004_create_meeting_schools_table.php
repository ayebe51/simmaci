<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meeting_schools', function (Blueprint $table) {
            $table->id();

            // Foreign keys
            $table->foreignId('meeting_id')
                ->constrained('meetings')
                ->cascadeOnDelete();

            $table->foreignId('school_id')
                ->constrained('schools')
                ->cascadeOnDelete();

            // Timestamps
            $table->timestampsTz();

            // Unique constraint on (meeting_id, school_id)
            $table->unique(['meeting_id', 'school_id']);
        });

        // Add indexes
        DB::statement('CREATE INDEX idx_meeting_schools_meeting_id ON meeting_schools(meeting_id)');
        DB::statement('CREATE INDEX idx_meeting_schools_school_id ON meeting_schools(school_id)');
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_schools');
    }
};
