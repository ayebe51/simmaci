<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wa_blasts', function (Blueprint $table) {
            $table->id();
            $table->string('title', 255);

            // Kategori penerima: 'kepala_sekolah', 'gtk', 'both'
            $table->string('recipient_category', 20);

            // JSON array of school IDs yang dipilih; null = semua sekolah
            $table->jsonb('school_ids')->nullable();

            // JSON array of jenjang yang dipilih; null = semua jenjang. Contoh: ["MI", "MTs"]
            $table->jsonb('jenjang_filter')->nullable();

            $table->text('message_body');

            // Path file PDF di Laravel Storage (nullable jika tidak ada lampiran)
            $table->string('attachment_path', 500)->nullable();
            $table->string('attachment_name', 255)->nullable();

            // Status blast: draft, scheduled, sending, completed, failed
            $table->string('blast_status', 20)->default('draft');

            // Waktu pengiriman terjadwal; null = segera
            $table->timestampTz('scheduled_at')->nullable();

            // Waktu pengiriman benar-benar dimulai
            $table->timestampTz('sent_at')->nullable();

            // Waktu pengiriman selesai (semua recipient diproses)
            $table->timestampTz('completed_at')->nullable();

            // Snapshot jumlah penerima saat blast dibuat
            $table->integer('total_recipients')->default(0);
            $table->integer('sent_count')->default(0);
            $table->integer('failed_count')->default(0);
            $table->integer('invalid_count')->default(0);

            // Referensi ke blast asal jika ini adalah retry blast
            $table->foreignId('parent_blast_id')
                ->nullable()
                ->references('id')
                ->on('wa_blasts')
                ->nullOnDelete();

            // User yang membuat blast
            $table->foreignId('created_by')
                ->constrained('users')
                ->restrictOnDelete();

            $table->text('error_message')->nullable();

            $table->timestampsTz();
            $table->softDeletesTz();
        });

        // Indexes
        DB::statement('CREATE INDEX idx_wa_blasts_status ON wa_blasts(blast_status)');
        DB::statement('CREATE INDEX idx_wa_blasts_scheduled_at ON wa_blasts(scheduled_at) WHERE blast_status = \'scheduled\'');
        DB::statement('CREATE INDEX idx_wa_blasts_created_by ON wa_blasts(created_by)');
        DB::statement('CREATE INDEX idx_wa_blasts_created_at ON wa_blasts(created_at)');
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_blasts');
    }
};
