<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Reopen registration for Anugerah Guru & Madrasah Berprestasi until 11 September 2026.
     */
    public function up(): void
    {
        try {
            // 1. Update deadline & ensure OPEN status for Anugerah & related competitions
            DB::table('competitions')
                ->whereIn('lomba_type', ['guru_berprestasi', 'madrasah_berprestasi', 'oskanu'])
                ->update([
                    'deadline'   => '2026-09-11 23:59:00',
                    'status'     => 'OPEN',
                    'updated_at' => now(),
                ]);

            // 2. Ensure all parent events are OPEN and registration_end is set to 2026-09-11
            $eventIds = DB::table('competitions')
                ->whereIn('lomba_type', ['guru_berprestasi', 'madrasah_berprestasi', 'oskanu'])
                ->pluck('event_id')
                ->filter()
                ->unique();

            if ($eventIds->isNotEmpty()) {
                DB::table('events')
                    ->whereIn('id', $eventIds)
                    ->update([
                        'status'           => 'OPEN',
                        'registration_end' => '2026-09-11',
                        'updated_at'       => now(),
                    ]);
            }

            // 3. Update any events with Anugerah or Harlah in name
            DB::table('events')
                ->where(function ($q) {
                    $q->whereRaw('LOWER(name) LIKE ?', ['%anugerah%'])
                      ->orWhereRaw('LOWER(name) LIKE ?', ['%harlah%']);
                })
                ->update([
                    'status'           => 'OPEN',
                    'registration_end' => '2026-09-11',
                    'updated_at'       => now(),
                ]);
        } catch (\Throwable $e) {
            Log::warning('Migration reopen anugerah warning: ' . $e->getMessage());
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
