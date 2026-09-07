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
        Schema::create('competition_jury_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('competition_id')->constrained()->cascadeOnDelete();
            $table->foreignId('participant_id')->nullable()->constrained('competition_participants')->cascadeOnDelete();
            $table->foreignId('anugerah_registration_id')->nullable()->constrained('anugerah_registrations')->cascadeOnDelete();
            $table->string('jury_name', 100);
            $table->decimal('score', 8, 2);
            $table->json('score_breakdown')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            // Indexes for fast lookup
            $table->index(['competition_id', 'participant_id']);
            $table->index(['competition_id', 'anugerah_registration_id']);

            // Unique constraint: one score per jury per participant
            $table->unique(['competition_id', 'participant_id', 'jury_name'], 'uq_jury_festival_participant');
            $table->unique(['competition_id', 'anugerah_registration_id', 'jury_name'], 'uq_jury_anugerah_participant');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('competition_jury_scores');
    }
};
