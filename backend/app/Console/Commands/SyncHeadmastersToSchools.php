<?php

namespace App\Console\Commands;

use App\Models\HeadmasterTenure;
use App\Models\School;
use App\Models\Teacher;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncHeadmastersToSchools extends Command
{
    protected $signature = 'headmaster:sync-to-schools
                            {--school-id= : ID sekolah tertentu yang ingin disinkronkan}
                            {--dry-run : Jalankan simulasi tanpa mengubah data di database}';

    protected $description = 'Sinkronkan data kepala madrasah aktif dari tabel headmaster_tenures ke profil tabel schools';

    public function handle(): int
    {
        $schoolId = $this->option('school-id');
        $isDryRun = (bool) $this->option('dry-run');

        $this->info($isDryRun ? '🔍 Menjalankan SIMULASI sinkronisasi kepala madrasah...' : '🚀 Menjalankan sinkronisasi kepala madrasah ke tabel schools...');
        $this->newLine();

        $query = HeadmasterTenure::withoutTenantScope()
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->orderByDesc('start_date')
            ->orderByDesc('id');

        if ($schoolId) {
            $query->where('school_id', $schoolId);
        }

        $activeTenures = $query->get();

        if ($activeTenures->isEmpty()) {
            $this->warn('Tidak ditemukan data headmaster_tenures aktif.');
            return self::SUCCESS;
        }

        // Kelompokkan per school_id (ambil yang paling baru jika ada multiple active)
        $groupedBySchool = $activeTenures->groupBy('school_id');
        $syncedCount = 0;
        $tableRows = [];

        foreach ($groupedBySchool as $sId => $tenures) {
            if (!$sId) {
                continue;
            }

            /** @var HeadmasterTenure $latestTenure */
            $latestTenure = $tenures->first();

            // Jika ada lebih dari 1 active tenure untuk sekolah yang sama, jadikan yang lama 'completed'
            if ($tenures->count() > 1 && !$isDryRun) {
                $oldTenureIds = $tenures->slice(1)->pluck('id');
                HeadmasterTenure::withoutTenantScope()
                    ->whereIn('id', $oldTenureIds)
                    ->update(['status' => 'completed']);
            }

            $school = School::find($sId);
            if (!$school) {
                continue;
            }

            $teacher = $latestTenure->teacher_id 
                ? Teacher::withoutTenantScope()->find($latestTenure->teacher_id) 
                : null;

            $newKamad = $latestTenure->teacher_name ?: ($teacher?->nama ?? $school->kepala_madrasah);
            $newNim = $teacher?->nomor_induk_maarif ?: $school->kepala_nim;
            $newNuptk = $teacher?->nuptk ?: $school->kepala_nuptk;
            $newWa = $teacher?->phone_number ?: $school->kepala_whatsapp;
            $newMulai = $latestTenure->start_date ?: $latestTenure->tanggal_penetapan;
            $newSelesai = $latestTenure->end_date;

            if (!$newSelesai && $newMulai) {
                try {
                    $newSelesai = Carbon::parse($newMulai)->addYears(4)->toDateString();
                } catch (\Throwable) {
                    $newSelesai = null;
                }
            }

            $isDifferent = (
                $school->kepala_madrasah !== $newKamad ||
                ($newWa && $school->kepala_whatsapp !== $newWa) ||
                ($newMulai && $school->kepala_jabatan_mulai !== $newMulai)
            );

            $statusText = $isDifferent ? ($isDryRun ? 'Perlu Update' : 'Tersinkron') : 'Sudah Sesuai';

            $tableRows[] = [
                $school->id,
                $school->nama,
                $school->kepala_madrasah ?? '-',
                $newKamad ?? '-',
                $newWa ?? '-',
                $statusText,
            ];

            if ($isDifferent && !$isDryRun) {
                $updateData = ['kepala_madrasah' => $newKamad];
                if ($newNim) $updateData['kepala_nim'] = $newNim;
                if ($newNuptk) $updateData['kepala_nuptk'] = $newNuptk;
                if ($newWa) $updateData['kepala_whatsapp'] = $newWa;
                if ($newMulai) $updateData['kepala_jabatan_mulai'] = $newMulai;
                if ($newSelesai) $updateData['kepala_jabatan_selesai'] = $newSelesai;

                $school->update($updateData);
                $syncedCount++;
            } elseif ($isDifferent && $isDryRun) {
                $syncedCount++;
            }
        }

        $this->table(
            ['ID', 'Lembaga', 'Kepala Lama', 'Kepala Baru (Tenure)', 'No WA Baru', 'Status'],
            $tableRows
        );

        $this->newLine();
        if ($isDryRun) {
            $this->info("Simulasi selesai. Sebanyak {$syncedCount} sekolah perlu diperbarui datanya.");
            $this->comment("Jalankan tanpa --dry-run untuk menerapkan perubahan.");
        } else {
            $this->info("✅ Berhasil menyinkronkan {$syncedCount} sekolah ke profil kepala madrasah aktif terbaru.");
        }

        return self::SUCCESS;
    }
}
