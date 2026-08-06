<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('headmaster_tenures', function (Blueprint $table) {
            $table->date('tanggal_penetapan')->nullable()->after('nomor_sk')
                ->comment('Tanggal penetapan SK kepala madrasah, diisi saat SK dicetak');
        });
    }

    public function down(): void
    {
        Schema::table('headmaster_tenures', function (Blueprint $table) {
            $table->dropColumn('tanggal_penetapan');
        });
    }
};
