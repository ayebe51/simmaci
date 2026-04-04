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
        Schema::create('attendance_archives', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('type'); // student or teacher
            $table->integer('year');
            $table->string('month');
            $table->string('storage_id')->nullable();
            $table->string('file_url')->nullable(); // Exported file (CSV/JSON)
            $table->integer('total_records')->default(0);
            $table->json('summary_data')->nullable(); // Mini summary of the period
            $table->foreignId('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['school_id', 'year']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendance_archives');
    }
};
