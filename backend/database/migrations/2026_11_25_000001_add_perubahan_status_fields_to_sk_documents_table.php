<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sk_documents', function (Blueprint $table) {
            $table->foreignId('sk_lama_id')
                ->nullable()
                ->after('teacher_id')
                ->constrained('sk_documents')
                ->nullOnDelete()
                ->comment('Referensi ID SK Tendik lama yang dicabut');

            $table->string('nomor_sk_lama')
                ->nullable()
                ->after('sk_lama_id')
                ->comment('Nomor SK lama (diisi otomatis atau manual)');

            $table->string('gelar_baru')
                ->nullable()
                ->after('nomor_sk_lama')
                ->comment('Gelar baru yang diajukan (misal: S.Pd.)');
        });
    }

    public function down(): void
    {
        Schema::table('sk_documents', function (Blueprint $table) {
            $table->dropForeign(['sk_lama_id']);
            $table->dropColumn(['sk_lama_id', 'nomor_sk_lama', 'gelar_baru']);
        });
    }
};
