<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wa_blast_recipients', function (Blueprint $table) {
            $table->id();

            $table->foreignId('wa_blast_id')
                ->constrained('wa_blasts')
                ->cascadeOnDelete();

            // Nama penerima (snapshot saat blast dibuat)
            $table->string('recipient_name', 255);

            // Nama sekolah penerima (snapshot)
            $table->string('school_name', 255);

            // Nomor WA yang sudah dinormalisasi (format: 62xxxxxxxxx)
            $table->string('phone_number', 20);

            // Tipe sumber: 'kepala_sekolah' atau 'gtk'
            $table->string('recipient_type', 20);

            // Status pengiriman: pending, sent, failed, invalid_number
            $table->string('delivery_status', 20)->default('pending');

            // Pesan error dari Go-WA jika gagal
            $table->text('error_message')->nullable();

            // Waktu pesan berhasil terkirim
            $table->timestampTz('sent_at')->nullable();

            $table->timestampsTz();
            $table->softDeletesTz();
        });

        // Indexes
        DB::statement('CREATE INDEX idx_wa_blast_recipients_blast_id ON wa_blast_recipients(wa_blast_id)');
        DB::statement('CREATE INDEX idx_wa_blast_recipients_status ON wa_blast_recipients(delivery_status)');
        DB::statement('CREATE INDEX idx_wa_blast_recipients_phone ON wa_blast_recipients(phone_number)');
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_blast_recipients');
    }
};
