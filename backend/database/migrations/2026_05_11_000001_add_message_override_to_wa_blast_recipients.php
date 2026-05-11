<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add message_override column to wa_blast_recipients.
 *
 * Allows per-recipient custom messages (e.g. meeting invitations with
 * personal QR links) to override the blast's shared message_body.
 * When NULL, SendBlastJob falls back to the blast's message_body with
 * {{nama}} / {{nama_sekolah}} substitution.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wa_blast_recipients', function (Blueprint $table) {
            $table->text('message_override')->nullable()->after('recipient_type');
        });
    }

    public function down(): void
    {
        Schema::table('wa_blast_recipients', function (Blueprint $table) {
            $table->dropColumn('message_override');
        });
    }
};
