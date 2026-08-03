<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('competition_participants', function (Blueprint $table) {
            if (! Schema::hasColumn('competition_participants', 'members')) {
                // JSON array: [{"name":"Ahmad","nim":"1234"},...]
                $table->json('members')->nullable()->after('member_count');
            }
        });
    }

    public function down(): void
    {
        Schema::table('competition_participants', function (Blueprint $table) {
            if (Schema::hasColumn('competition_participants', 'members')) {
                $table->dropColumn('members');
            }
        });
    }
};
