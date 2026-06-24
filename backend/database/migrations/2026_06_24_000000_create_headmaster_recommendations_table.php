<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('headmaster_recommendations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->foreignId('teacher_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('Pending'); // Pending, Approved, Rejected
            $table->json('documents')->nullable(); // Store the 16 document IDs
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('rejection_reason')->nullable();
            $table->boolean('is_reappointment')->default(false); // Whether the teacher has been a headmaster before
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('headmaster_recommendations');
    }
};
