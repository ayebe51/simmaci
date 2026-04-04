<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Headmaster Tenures
        Schema::create('headmaster_tenures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->string('teacher_name');
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('school_name');
            $table->string('periode');
            $table->string('start_date');
            $table->string('end_date');
            $table->string('status')->default('pending'); // pending, active, expired
            $table->string('nomor_sk')->nullable();
            $table->string('sk_url')->nullable();
            $table->string('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->string('created_by');
            $table->timestamps();
            $table->softDeletes();

            $table->index('teacher_id');
            $table->index('status');
            $table->index('periode');
        });

        // Notifications
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type');
            $table->string('title');
            $table->text('message');
            $table->boolean('is_read')->default(false);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index(['user_id', 'is_read']);
        });


        // Approval History
        Schema::create('approval_histories', function (Blueprint $table) {
            $table->id();
            $table->string('document_id');
            $table->string('document_type');
            $table->string('action');
            $table->string('from_status')->nullable();
            $table->string('to_status')->nullable();
            $table->string('performed_by');
            $table->timestamp('performed_at');
            $table->text('comment')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('document_id');
            $table->index('document_type');
            $table->index('performed_by');
            $table->index('performed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_histories');

        Schema::dropIfExists('notifications');
        Schema::dropIfExists('headmaster_tenures');
    }
};
