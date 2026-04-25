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
        Schema::table('headmaster_tenures', function (Blueprint $table) {
            $table->string('surat_permohonan_number')->nullable()->after('sk_url');
            $table->string('surat_permohonan_date')->nullable()->after('surat_permohonan_number');
            $table->text('keterangan')->nullable()->after('surat_permohonan_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('headmaster_tenures', function (Blueprint $table) {
            $table->dropColumn(['surat_permohonan_number', 'surat_permohonan_date', 'keterangan']);
        });
    }
};
