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
        Schema::table('sk_documents', function (Blueprint $row) {
            if (!Schema::hasColumn('sk_documents', 'nomor_permohonan')) {
                $row->string('nomor_permohonan')->nullable();
            }
            if (!Schema::hasColumn('sk_documents', 'tanggal_permohonan')) {
                $row->date('tanggal_permohonan')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sk_documents', function (Blueprint $row) {
            $row->dropColumn(['nomor_permohonan', 'tanggal_permohonan']);
        });
    }
};
