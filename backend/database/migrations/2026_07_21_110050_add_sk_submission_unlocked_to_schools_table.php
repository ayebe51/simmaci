<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tambahkan flag sk_submission_unlocked ke tabel schools.
     *
     * Default NULL = ikuti aturan global (RA/TK buka, MI ke atas tutup).
     * true  = pengajuan diizinkan (admin buka khusus untuk madrasah ini).
     * false = pengajuan ditutup paksa (override global).
     *
     * Admin dapat toggle field ini dari panel admin / endpoint API tanpa perlu deploy ulang.
     */
    public function up(): void
    {
        Schema::table('schools', function (Blueprint $table) {
            $table->boolean('sk_submission_unlocked')
                ->nullable()
                ->default(null)
                ->after('jenjang')
                ->comment('null=ikuti aturan global, true=unlocked oleh admin, false=locked paksa');
        });
    }

    public function down(): void
    {
        Schema::table('schools', function (Blueprint $table) {
            $table->dropColumn('sk_submission_unlocked');
        });
    }
};
