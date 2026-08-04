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
        Schema::table('anugerah_registrations', function (Blueprint $table) {
            $table->json('score_breakdown')->nullable()->after('reviewer_notes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('anugerah_registrations', function (Blueprint $table) {
            $table->dropColumn('score_breakdown');
        });
    }
};
