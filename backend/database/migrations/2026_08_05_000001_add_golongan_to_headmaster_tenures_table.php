<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('headmaster_tenures', function (Blueprint $table) {
            $table->string('golongan')->nullable()->after('keterangan')
                ->comment('Golongan/ruang PNS, diisi hanya untuk kepala madrasah PNS/ASN');
        });
    }

    public function down(): void
    {
        Schema::table('headmaster_tenures', function (Blueprint $table) {
            $table->dropColumn('golongan');
        });
    }
};
