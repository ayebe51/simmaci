<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Extend registration for Anugerah Pendidikan & Festival Aswaja until 13 September 2026 23:59:00 WIB.
     */
    public function up(): void
    {
        try {
            $newDeadline = '2026-09-13 23:59:00';
            $newEndDate  = '2026-09-13';

            // 1. Update deadline & ensure OPEN status for Anugerah & Festival Aswaja competitions
            DB::table('competitions')
                ->where(function ($q) {
                    $q->whereIn('lomba_type', [
                        'guru_berprestasi',
                        'madrasah_berprestasi',
                        'oskanu',
                        'mars_maarif',
                        'mtq',
                        'mtq_pa',
                        'mtq_pi',
                        'puji_pujian',
                        'film_dokumenter',
                    ])
                    ->orWhereRaw('LOWER(name) LIKE ?', ['%mars maarif%'])
                    ->orWhereRaw('LOWER(name) LIKE ?', ['%mars ma\'arif%'])
                    ->orWhereRaw('LOWER(name) LIKE ?', ['%anugerah%'])
                    ->orWhereRaw('LOWER(name) LIKE ?', ['%festival%'])
                    ->orWhereRaw('LOWER(name) LIKE ?', ['%aswaja%']);
                })
                ->update([
                    'deadline'   => $newDeadline,
                    'status'     => 'OPEN',
                    'updated_at' => now(),
                ]);

            // 2. Ensure all parent events are OPEN and registration_end & video_deadline are extended
            $eventIds = DB::table('competitions')
                ->whereIn('lomba_type', [
                    'guru_berprestasi',
                    'madrasah_berprestasi',
                    'oskanu',
                    'mars_maarif',
                    'mtq',
                    'mtq_pa',
                    'mtq_pi',
                    'puji_pujian',
                    'film_dokumenter',
                ])
                ->pluck('event_id')
                ->filter()
                ->unique();

            if ($eventIds->isNotEmpty()) {
                DB::table('events')
                    ->whereIn('id', $eventIds)
                    ->update([
                        'status'           => 'OPEN',
                        'registration_end' => $newEndDate,
                        'video_deadline'   => $newDeadline,
                        'updated_at'       => now(),
                    ]);
            }

            // 3. Update any events with Anugerah, Festival, Aswaja, or Harlah in name
            DB::table('events')
                ->where(function ($q) {
                    $q->whereRaw('LOWER(name) LIKE ?', ['%anugerah%'])
                      ->orWhereRaw('LOWER(name) LIKE ?', ['%festival%'])
                      ->orWhereRaw('LOWER(name) LIKE ?', ['%aswaja%'])
                      ->orWhereRaw('LOWER(name) LIKE ?', ['%harlah%']);
                })
                ->update([
                    'status'           => 'OPEN',
                    'registration_end' => $newEndDate,
                    'video_deadline'   => $newDeadline,
                    'updated_at'       => now(),
                ]);
        } catch (\Throwable $e) {
            Log::warning('Migration extend registration 13 September warning: ' . $e->getMessage());
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No destructive rollback needed
    }
};
