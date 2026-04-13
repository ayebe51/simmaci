<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sk_documents', function (Blueprint $table) {
            $table->string('tahun_ajaran')->nullable()->after('unit_kerja');
            $table->index('tahun_ajaran');
        });
    }

    public function down(): void
    {
        Schema::table('sk_documents', function (Blueprint $table) {
            $table->dropIndex(['tahun_ajaran']);
            $table->dropColumn('tahun_ajaran');
        });
    }
};
