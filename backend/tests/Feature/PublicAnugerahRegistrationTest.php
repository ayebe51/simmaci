<?php

namespace Tests\Feature;

use App\Models\Competition;
use App\Models\Event;
use App\Models\AnugerahRegistration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicAnugerahRegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_anugerah_registration_persists_phone_and_document_urls(): void
    {
        $event = Event::create([
            'name'               => 'Harlah LP Ma\'arif NU 2026',
            'slug'               => 'harlah-maarif-2026',
            'category'           => 'Festival',
            'date'               => '2026-09-19',
            'location'           => 'Cilacap',
            'status'             => 'OPEN',
            'registration_start' => now()->subDays(5),
            'registration_end'   => now()->addDays(20),
        ]);

        $competition = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Anugerah Guru Berprestasi',
            'category'   => 'Akademik',
            'type'       => 'Individual',
            'jenjang'    => 'MI/SD, MTs/SMP, MA/SMA/SMK',
            'lomba_type' => 'guru_berprestasi',
            'status'     => 'OPEN',
        ]);

        $payload = [
            'competition_id'                  => $competition->id,
            'category'                        => 'guru',
            'jenjang'                         => 'MI/SD',
            'applicant_name'                  => 'Ahmad Fauzi, S.Pd.',
            'applicant_nuptk'                 => '1234567890',
            'school_name'                     => 'MI Ma\'arif NU 01 Cilacap',
            'kecamatan'                       => 'Cilacap Selatan',
            'contact_phone'                   => '081234567890',
            'surat_keterangan_aktif_url'      => 'https://drive.google.com/file/d/aktif123/view',
            'sertifikat_pkpnu_url'            => 'https://drive.google.com/file/d/pkpnu123/view',
            'surat_rekomendasi_url'           => 'https://drive.google.com/file/d/rekom123/view',
            'surat_keterangan_integritas_url' => 'https://drive.google.com/file/d/integritas123/view',
            'bukti_prestasi_url'              => 'https://drive.google.com/file/d/prestasi123/view',
            'esai_reflektif_url'              => 'https://drive.google.com/file/d/esai123/view',
            'karya_ilmiah_url'                => 'https://drive.google.com/file/d/karya123/view',
        ];

        $response = $this->postJson("/api/public/events/{$event->id}/daftar", $payload);

        $response->assertStatus(201);

        $this->assertDatabaseHas('anugerah_registrations', [
            'event_id'                        => $event->id,
            'competition_id'                  => $competition->id,
            'applicant_name'                  => 'Ahmad Fauzi, S.Pd.',
            'school_name'                     => 'MI Ma\'arif NU 01 Cilacap',
            'contact_phone'                   => '081234567890',
            'surat_keterangan_aktif_url'      => 'https://drive.google.com/file/d/aktif123/view',
            'sertifikat_pkpnu_url'            => 'https://drive.google.com/file/d/pkpnu123/view',
            'surat_rekomendasi_url'           => 'https://drive.google.com/file/d/rekom123/view',
            'surat_keterangan_integritas_url' => 'https://drive.google.com/file/d/integritas123/view',
            'bukti_prestasi_url'              => 'https://drive.google.com/file/d/prestasi123/view',
            'esai_reflektif_url'              => 'https://drive.google.com/file/d/esai123/view',
            'karya_ilmiah_url'                => 'https://drive.google.com/file/d/karya123/view',
            'status'                          => 'submitted',
        ]);
    }

    public function test_public_event_show_counts_anugerah_registrations_in_participants_count(): void
    {
        $event = Event::create([
            'name'     => 'Anugerah Pendidikan 2026',
            'slug'     => 'anugerah-pendidikan-2026',
            'category' => 'Anugerah',
            'date'     => '2026-09-19',
            'status'   => 'OPEN',
        ]);

        $compGuru = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Anugerah Guru Berprestasi',
            'category'   => 'Akademik',
            'type'       => 'Individual',
            'lomba_type' => 'guru_berprestasi',
            'status'     => 'OPEN',
        ]);

        $compMadrasah = Competition::create([
            'event_id'   => $event->id,
            'name'       => 'Anugerah Madrasah/Sekolah Berprestasi',
            'category'   => 'Akademik',
            'type'       => 'Individual',
            'lomba_type' => 'madrasah_berprestasi',
            'status'     => 'OPEN',
        ]);

        // Add 2 registrations to guru
        AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $compGuru->id,
            'category'       => 'guru',
            'jenjang'        => 'MI/SD',
            'applicant_name' => 'Guru 1',
            'school_name'    => 'MI 1',
            'status'         => 'submitted',
        ]);
        AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $compGuru->id,
            'category'       => 'guru',
            'jenjang'        => 'MTs/SMP',
            'applicant_name' => 'Guru 2',
            'school_name'    => 'MTs 1',
            'status'         => 'submitted',
        ]);

        // Add 1 registration to madrasah
        AnugerahRegistration::create([
            'event_id'       => $event->id,
            'competition_id' => $compMadrasah->id,
            'category'       => 'madrasah',
            'jenjang'        => 'MA/SMA/SMK',
            'applicant_name' => 'Kepala MA 1',
            'school_name'    => 'MA 1',
            'status'         => 'submitted',
        ]);

        $response = $this->getJson("/api/public/events/{$event->id}");

        $response->assertStatus(200);

        $competitions = collect($response->json('data.competitions'));
        $guruData = $competitions->firstWhere('id', $compGuru->id);
        $madrasahData = $competitions->firstWhere('id', $compMadrasah->id);

        $this->assertEquals(2, $guruData['participants_count']);
        $this->assertEquals(1, $madrasahData['participants_count']);
    }
}
