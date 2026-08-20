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
        if (Schema::hasTable('staff_attendances')) {
            Schema::table('staff_attendances', function (Blueprint $table) {
                if (!Schema::hasColumn('staff_attendances', 'keterangan')) {
                    $table->string('keterangan', 500)->nullable();
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('staff_attendances')) {
            Schema::table('staff_attendances', function (Blueprint $table) {
                if (Schema::hasColumn('staff_attendances', 'keterangan')) {
                    $table->dropColumn('keterangan');
                }
            });
        }
    }
};
