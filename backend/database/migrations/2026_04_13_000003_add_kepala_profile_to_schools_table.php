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
        Schema::table('schools', function (Blueprint $table) {
            $table->string('kepala_nim')->nullable()->after('kepala_madrasah');
            $table->string('kepala_nuptk')->nullable()->after('kepala_nim');
            $table->string('kepala_whatsapp')->nullable()->after('kepala_nuptk');
            $table->date('kepala_jabatan_mulai')->nullable()->after('kepala_whatsapp');
            $table->date('kepala_jabatan_selesai')->nullable()->after('kepala_whatsapp');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('schools', function (Blueprint $table) {
            $table->dropColumn([
                'kepala_nim',
                'kepala_nuptk',
                'kepala_whatsapp',
                'kepala_jabatan_mulai',
                'kepala_jabatan_selesai'
            ]);
        });
    }
};
