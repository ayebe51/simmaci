<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('anugerah_registrations')) {
            return;
        }

        // Cari data pendaftar Guru Berprestasi MI Slamet Pamuji
        $registrations = DB::table('anugerah_registrations')
            ->where(function ($q) {
                $q->where('applicant_name', 'like', '%Slamet%')
                  ->where('applicant_name', 'like', '%Pamuji%');
            })
            ->get();

        foreach ($registrations as $reg) {
            DB::table('anugerah_registrations')
                ->where('id', $reg->id)
                ->update([
                    'total_score'     => 30.90,
                    'rank'            => null,
                    'status'          => in_array($reg->status, ['finalis', 'winner']) ? 'submitted' : $reg->status,
                    'score_breakdown' => null,
                ]);

            if (Schema::hasTable('competition_jury_scores')) {
                DB::table('competition_jury_scores')
                    ->where('anugerah_registration_id', $reg->id)
                    ->where('score', '>', 30.90)
                    ->update(['score' => 30.90]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Data correction does not require reversing
    }
};
