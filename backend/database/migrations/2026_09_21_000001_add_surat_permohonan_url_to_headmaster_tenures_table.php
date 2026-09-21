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
            if (! Schema::hasColumn('headmaster_tenures', 'surat_permohonan_url')) {
                $table->string('surat_permohonan_url')->nullable()->after('sk_url');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('headmaster_tenures', function (Blueprint $table) {
            if (Schema::hasColumn('headmaster_tenures', 'surat_permohonan_url')) {
                $table->dropColumn('surat_permohonan_url');
            }
        });
    }
};
