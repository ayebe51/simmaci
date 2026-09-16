<?php

namespace Tests\Feature;

use App\Models\AnugerahRegistration;
use App\Models\Competition;
use App\Models\CompetitionJuryScore;
use App\Models\Event;
use App\Services\CompetitionRankingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FixMuhtaromGuruScoresTest extends TestCase
{
    use RefreshDatabase;

    public function test_prunes_only_non_mi_scores_for_muhtarom_and_recalculates_ranks(): void
    {
        $event = Event::create([
            'name'     => 'Harlah LP Ma\'arif 97',
            'slug'     => 'harlah-97-test',
            'category' => 'Anugerah',
            'date'     => '2026-09-19',
            'status'   => 'OPEN',
        ]);

        $guruComp = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Anugerah Guru Berprestasi',
            'category'   => 'Akademik',
            'type'       => 'Individual',
            'lomba_type' => 'guru_berprestasi',
            'status'     => 'OPEN',
            'scoring_criteria' => [
                ['component' => 'Prestasi', 'weight' => 40],
                ['component' => 'Naskah', 'weight' => 30],
                ['component' => 'Aswaja', 'weight' => 15],
                ['component' => 'Wawancara', 'weight' => 15],
            ],
        ]);

        // 1. Peserta Jenjang MI/SD (Muhtarom SOULD score this)
        $regMi = AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $guruComp->id,
            'category'       => 'Guru',
            'jenjang'        => 'MI/SD',
            'applicant_name' => 'Guru MI Teladan',
            'school_name'    => 'MI Ma\'arif 01',
            'status'         => 'submitted',
        ]);

        // 2. Peserta Jenjang MTs/SMP (Muhtarom SHOULD NOT score this)
        $regMts = AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $guruComp->id,
            'category'       => 'Guru',
            'jenjang'        => 'MTs/SMP',
            'applicant_name' => 'Guru MTs Hebat',
            'school_name'    => 'MTs Ma\'arif 01',
            'status'         => 'submitted',
        ]);

        // 3. Peserta Jenjang MA/SMA/SMK (Muhtarom SHOULD NOT score this)
        $regMa = AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $guruComp->id,
            'category'       => 'Guru',
            'jenjang'        => 'MA/SMA/SMK',
            'applicant_name' => 'Guru MA Inspiratif',
            'school_name'    => 'MA Ma\'arif 01',
            'status'         => 'submitted',
        ]);

        // Input nilai oleh Muhtarom untuk ketiga jenjang:
        // MI: Muhtarom beri nilai 88
        CompetitionJuryScore::create([
            'competition_id'           => $guruComp->id,
            'anugerah_registration_id' => $regMi->id,
            'jury_name'                => 'Drs. H. Muhtarom, M.Pd.',
            'score'                    => 88.00,
        ]);

        // MTs: Muhtarom beri nilai 70, Juri B beri nilai 90 -> Rata-rata awal: 80.00
        CompetitionJuryScore::create([
            'competition_id'           => $guruComp->id,
            'anugerah_registration_id' => $regMts->id,
            'jury_name'                => 'Drs. H. Muhtarom, M.Pd.',
            'score'                    => 70.00,
        ]);
        CompetitionJuryScore::create([
            'competition_id'           => $guruComp->id,
            'anugerah_registration_id' => $regMts->id,
            'jury_name'                => 'Dr. Siti Aminah',
            'score'                    => 90.00,
        ]);

        // MA: Muhtarom SAJA yang beri nilai 75
        CompetitionJuryScore::create([
            'competition_id'           => $guruComp->id,
            'anugerah_registration_id' => $regMa->id,
            'jury_name'                => 'Muhtarom',
            'score'                    => 75.00,
        ]);

        // Hitung awal
        $regMi->update(['total_score' => 88.00]);
        $regMts->update(['total_score' => 80.00]); // (70 + 90) / 2
        $regMa->update(['total_score' => 75.00]);
        CompetitionRankingService::autoRank($guruComp);

        $this->assertEquals(1, $regMi->fresh()->rank);
        $this->assertEquals(1, $regMts->fresh()->rank);
        $this->assertEquals(1, $regMa->fresh()->rank);

        // Test 1: Jalankan dengan --dry-run
        $this->artisan('competition:fix-guru-muhtarom --dry-run')
            ->expectsOutputToContain('MODE DRY-RUN AKTIF')
            ->expectsOutputToContain('Guru MTs Hebat')
            ->expectsOutputToContain('Guru MA Inspiratif')
            ->assertExitCode(0);

        // Pastikan belum ada data yang terhapus
        $this->assertCount(4, CompetitionJuryScore::where('competition_id', $guruComp->id)->get());

        // Test 2: Jalankan eksekusi nyata dengan --force
        $this->artisan('competition:fix-guru-muhtarom --force')
            ->expectsOutputToContain('NILAI YANG DIPERTAHANKAN (Jenjang MI)')
            ->expectsOutputToContain('NILAI YANG AKAN DIHAPUS (Bukan Jenjang MI)')
            ->assertExitCode(0);

        // Verifikasi tabel CompetitionJuryScore:
        // Nilai Muhtarom di MTs dan MA harus terhapus, sedangkan nilai Muhtarom di MI dan Juri B di MTs tetap ada!
        $remainingScores = CompetitionJuryScore::where('competition_id', $guruComp->id)->get();
        $this->assertCount(2, $remainingScores);

        // Cek nilai MI masih ada dan milik Muhtarom
        $miScores = CompetitionJuryScore::where('anugerah_registration_id', $regMi->id)->get();
        $this->assertCount(1, $miScores);
        $this->assertEquals(88.00, (float) $miScores->first()->score);

        // Cek nilai MTs sekarang hanya ada 1 (dari Dr. Siti Aminah dengan nilai 90.00)
        $mtsScores = CompetitionJuryScore::where('anugerah_registration_id', $regMts->id)->get();
        $this->assertCount(1, $mtsScores);
        $this->assertEquals('Dr. Siti Aminah', $mtsScores->first()->jury_name);
        $this->assertEquals(90.00, (float) $mtsScores->first()->score);

        // Cek nilai MA sekarang 0 (karena hanya dinilai Muhtarom)
        $maScores = CompetitionJuryScore::where('anugerah_registration_id', $regMa->id)->get();
        $this->assertCount(0, $maScores);

        // Verifikasi pembaruan total_score dan rank di AnugerahRegistration
        $regMiFresh = $regMi->fresh();
        $this->assertEquals(88.00, (float) $regMiFresh->total_score);
        $this->assertEquals(1, $regMiFresh->rank);

        $regMtsFresh = $regMts->fresh();
        $this->assertEquals(90.00, (float) $regMtsFresh->total_score); // Naik dari 80 ke 90 karena nilai 70 dihapus
        $this->assertEquals(1, $regMtsFresh->rank);

        $regMaFresh = $regMa->fresh();
        $this->assertNull($regMaFresh->total_score);
        $this->assertNull($regMaFresh->rank);

        // Test 3: Jalankan kedua kali saat data sudah bersih
        $this->artisan('competition:fix-guru-muhtarom --force')
            ->expectsOutputToContain('Data sudah bersih!')
            ->assertExitCode(0);
    }
}
