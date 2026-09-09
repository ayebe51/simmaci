<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Reopen registration for Anugerah Guru & Madrasah Berprestasi until 11 September 2026.
     */
    public function up(): void
    {
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

        // 3. Update any events with Anugerah/Harlah in name
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

        // 4. Restore and populate event 4 if soft-deleted (local DB recovery)
        $event4 = DB::table('events')->where('id', 4)->first();
        if ($event4) {
            DB::table('events')->where('id', 4)->update([
                'deleted_at'         => null,
                'name'               => "Anugerah Pendidikan & Festival Aswaja LP Ma'arif NU Cilacap 2026",
                'slug'               => "anugerah-pendidikan-festival-aswaja-lp-maarif-nu-cilacap-2026",
                'category'           => 'Anugerah Pendidikan',
                'type'               => 'Individual',
                'date'               => '2026-09-19',
                'location'           => "Gedung PCNU Cilacap / Aula PC LP Ma'arif NU Cilacap",
                'description'        => "Penyelenggaraan Anugerah Guru Berprestasi, Madrasah/Sekolah Berprestasi, dan Festival Aswaja Siswa dalam rangka Harlah LP Ma'arif NU ke-97 Tahun 2026.",
                'status'             => 'OPEN',
                'registration_start' => '2026-08-15',
                'registration_end'   => '2026-09-11',
                'video_deadline'     => '2026-09-11 23:59:00',
                'announcement_date'  => '2026-09-19',
                'announcement_place' => "Resepsi Harlah LP Ma'arif NU Cilacap",
                'contact_name'       => 'Sekretariat Panitia Harlah ke-97',
                'contact_phone'      => '081234567890',
                'updated_at'         => now(),
            ]);

            // Ensure madrasah_berprestasi exists on event 4
            $hasMadrasah = DB::table('competitions')
                ->where('event_id', 4)
                ->where('lomba_type', 'madrasah_berprestasi')
                ->exists();

            if (! $hasMadrasah) {
                DB::table('competitions')->insert([
                    'event_id'         => 4,
                    'name'             => 'Anugerah Madrasah/Sekolah Berprestasi',
                    'category'         => 'Akademik',
                    'type'             => 'Individual',
                    'jenjang'          => 'MI/SD, MTs/SMP, MA/SMA/SMK',
                    'lomba_type'       => 'madrasah_berprestasi',
                    'status'           => 'OPEN',
                    'deadline'         => '2026-09-11 23:59:00',
                    'scoring_criteria' => json_encode([
                        ['component' => 'Akumulasi Skor Kejuaraan Lembaga',                        'weight' => 45],
                        ['component' => 'Tata Kelola Institusi & Penguatan Karakter Aswaja',       'weight' => 25],
                        ['component' => 'Kemitraan, Keaktifan SIMNU & SIMMACI, Kontribusi Sosial', 'weight' => 15],
                        ['component' => 'Presentasi Kepala Madrasah & Visitasi / Fact Checking',   'weight' => 15],
                    ]),
                    'max_per_school'   => null,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ]);
            }
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
