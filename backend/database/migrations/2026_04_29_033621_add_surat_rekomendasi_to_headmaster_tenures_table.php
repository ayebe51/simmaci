<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('headmaster_tenures', function (Blueprint $table) {
            $table->string('nomor_surat_rekomendasi')->nullable()->after('surat_permohonan_date');
            $table->string('tanggal_surat_rekomendasi')->nullable()->after('nomor_surat_rekomendasi');
        });
    }

    public function down(): void
    {
        Schema::table('headmaster_tenures', function (Blueprint $table) {
            $table->dropColumn(['nomor_surat_rekomendasi', 'tanggal_surat_rekomendasi']);
        });
    }
};
