<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // NUPTK Submissions
        Schema::create('nuptk_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('status')->default('Pending'); // Pending, Approved, Rejected
            $table->string('dokumen_ktp_id')->nullable();
            $table->string('dokumen_ijazah_id')->nullable();
            $table->string('dokumen_pengangkatan_id')->nullable();
            $table->string('dokumen_penugasan_id')->nullable();
            $table->string('nomor_surat_rekomendasi')->nullable();
            $table->string('tanggal_surat_rekomendasi')->nullable();
            $table->timestamp('submitted_at');
            $table->timestamp('approved_at')->nullable();
            $table->string('approver_id')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index('school_id');
            $table->index('teacher_id');
            $table->index('status');
            $table->index('submitted_at');
        });

        // Settings
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key');
            $table->text('value')->nullable();
            $table->string('storage_id')->nullable();
            $table->string('mime_type')->nullable();
            $table->foreignId('school_id')->nullable()->constrained('schools')->nullOnDelete();
            $table->timestamps();

            $table->unique(['key', 'school_id']);
            $table->index('key');
        });

        // SK Archives
        Schema::create('sk_archives', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('nomor_sk');
            $table->string('title');
            $table->string('year');
            $table->string('category');
            $table->string('storage_id')->nullable();
            $table->string('file_url')->nullable();
            $table->string('uploaded_by');
            $table->timestamps();

            $table->index('school_id');
            $table->index('year');
        });

        // Teacher Mutations (History)
        Schema::create('teacher_mutations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->string('from_unit');
            $table->string('to_unit');
            $table->text('reason')->nullable();
            $table->string('sk_number');
            $table->string('effective_date');
            $table->string('performed_by');
            $table->timestamps();

            $table->index('teacher_id');
            $table->index('from_unit');
            $table->index('to_unit');
        });

        // Debug Logs
        Schema::create('debug_logs', function (Blueprint $table) {
            $table->id();
            $table->string('action');
            $table->json('report')->nullable();
            $table->string('status');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('debug_logs');
        Schema::dropIfExists('teacher_mutations');
        Schema::dropIfExists('sk_archives');
        Schema::dropIfExists('settings');
        Schema::dropIfExists('nuptk_submissions');
    }
};
