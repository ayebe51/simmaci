<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wa_blast_configs', function (Blueprint $table) {
            $table->id();

            // URL endpoint API Go-WA
            $table->string('api_url', 500);

            // API Token terenkripsi menggunakan Laravel encrypt()
            $table->text('api_token_encrypted');

            // Nomor pengirim (device/sender number) dalam format 62xxxxxxxxx
            $table->string('sender_number', 20);

            // Batas maksimal penerima per sesi (default: 500)
            $table->integer('max_recipients_per_session')->default(500);

            // Batas maksimal pesan per hari (default: 1000)
            $table->integer('max_daily_messages')->default(1000);

            $table->foreignId('updated_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            // Tidak menggunakan softDeletes — singleton, tidak dihapus
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_blast_configs');
    }
};
