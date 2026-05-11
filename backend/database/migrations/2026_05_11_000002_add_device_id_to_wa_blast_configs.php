<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add device_id column to wa_blast_configs.
 *
 * GoWA v8 requires X-Device-Id header for all API calls.
 * The device_id is the device name shown in GoWA dashboard (e.g. "Maarif Cilacap").
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wa_blast_configs', function (Blueprint $table) {
            $table->string('device_id', 255)->nullable()->after('sender_number');
        });
    }

    public function down(): void
    {
        Schema::table('wa_blast_configs', function (Blueprint $table) {
            $table->dropColumn('device_id');
        });
    }
};
