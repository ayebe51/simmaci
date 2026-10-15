<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AnalyzeUnlinkedTeachersTest extends TestCase
{
    use RefreshDatabase;

    public function test_analyze_unlinked_teachers_when_all_teachers_are_linked(): void
    {
        $school = School::create([
            'nama'            => 'MI Ma\'arif 01 Cilacap',
            'npsn'            => '12345678',
            'jenjang'         => 'MI',
            'kecamatan'       => 'Cilacap Tengah',
            'status_jamiyyah' => 'Jam\'iyyah',
        ]);

        Teacher::create([
            'nama'       => 'Ahmad Fauzi, S.Pd.',
            'school_id'  => $school->id,
            'unit_kerja' => 'MI Ma\'arif 01 Cilacap',
            'is_active'  => true,
        ]);

        $this->artisan('teachers:analyze-unlinked')
            ->expectsOutputToContain('Terhubung Normal ke Sekolah Aktif')
            ->assertExitCode(0);
    }

    public function test_analyze_unlinked_teachers_detects_all_categories(): void
    {
        // 1. Sekolah aktif
        $schoolA = School::create([
            'nama'            => 'MTs Ma\'arif NU 01 Kroya',
            'npsn'            => '20000001',
            'jenjang'         => 'MTs',
            'kecamatan'       => 'Kroya',
            'status_jamiyyah' => 'Jam\'iyyah',
        ]);

        // 2. Sekolah soft-deleted
        $schoolDeleted = School::create([
            'nama'            => 'MA Ma\'arif NU 01 Gandrungmangu',
            'npsn'            => '20000002',
            'jenjang'         => 'MA',
            'kecamatan'       => 'Gandrungmangu',
            'status_jamiyyah' => 'Jama\'ah',
        ]);
        $schoolDeleted->delete(); // Soft delete

        // Teacher 1: Normal
        Teacher::create([
            'nama'       => 'Guru Satu, S.Pd.',
            'school_id'  => $schoolA->id,
            'unit_kerja' => 'MTs Ma\'arif NU 01 Kroya',
            'is_active'  => true,
        ]);

        // Teacher 2: school_id NULL dengan unit_kerja
        Teacher::create([
            'nama'       => 'Guru Dua, S.Pd.I.',
            'school_id'  => null,
            'unit_kerja' => 'MTs Ma\'arif NU 01 Kroya',
            'is_active'  => true,
        ]);

        // Teacher 3: school_id NULL tanpa unit_kerja (Yatim Piatu)
        Teacher::create([
            'nama'       => 'Guru Tiga, M.Pd.',
            'school_id'  => null,
            'unit_kerja' => null,
            'is_active'  => true,
        ]);

        // Teacher 4: Mismatch antara unit_kerja dengan nama sekolah terhubung
        Teacher::create([
            'nama'       => 'Guru Empat (Mismatch Unit)',
            'school_id'  => $schoolA->id,
            'unit_kerja' => 'Pondok Pesantren Al-Huda Terpisah',
            'is_active'  => true,
        ]);

        // Teacher 5: school_id ke sekolah soft-deleted
        Teacher::create([
            'nama'       => 'Guru Lima (Soft Deleted School)',
            'school_id'  => $schoolDeleted->id,
            'unit_kerja' => 'MA Ma\'arif NU 01 Gandrungmangu',
            'is_active'  => true,
        ]);

        $this->artisan('teachers:analyze-unlinked', ['--details' => true, '--match' => true])
            ->expectsOutputToContain('school_id NULL, tapi Memiliki Nama Unit Kerja')
            ->expectsOutputToContain('school_id NULL dan Unit Kerja KOSONG (Yatim Piatu)')
            ->expectsOutputToContain('school_id Terhubung ke Sekolah Soft-Deleted')
            ->expectsOutputToContain('Potensi Mismatch (Unit Kerja ≠ Nama Sekolah Terhubung)')
            ->assertExitCode(0);
    }

    public function test_auto_link_with_dry_run_and_actual_execution(): void
    {
        $school = School::create([
            'nama'            => 'MI Ma\'arif NU 02 Kesugihan',
            'npsn'            => '30000001',
            'jenjang'         => 'MI',
            'kecamatan'       => 'Kesugihan',
            'status_jamiyyah' => 'Jam\'iyyah',
        ]);

        $teacher = Teacher::create([
            'nama'       => 'Siti Aminah, S.Pd.I.',
            'school_id'  => null,
            'unit_kerja' => 'MI Ma\'arif NU 02 Kesugihan',
            'is_active'  => true,
        ]);

        // 1. Dry run: school_id tetap null
        $this->artisan('teachers:analyze-unlinked', ['--auto-link' => true, '--dry-run' => true])
            ->assertExitCode(0);

        $teacher->refresh();
        $this->assertNull($teacher->school_id);

        // 2. Real auto link: konfirmasi 'yes'
        $this->artisan('teachers:analyze-unlinked', ['--auto-link' => true])
            ->expectsConfirmation('Apakah Anda yakin ingin melanjutkan penautan otomatis (auto-link)?', 'yes')
            ->expectsOutputToContain('berhasil ditautkan ke sekolah')
            ->assertExitCode(0);

        $teacher->refresh();
        $this->assertEquals($school->id, $teacher->school_id);
    }

    public function test_csv_export_generates_file(): void
    {
        $csvPath = storage_path('framework/testing/test_unlinked.csv');
        if (file_exists($csvPath)) {
            unlink($csvPath);
        }

        Teacher::create([
            'nama'       => 'Guru Test CSV',
            'school_id'  => null,
            'unit_kerja' => 'SD Islam Terpadu',
            'is_active'  => true,
        ]);

        $this->artisan('teachers:analyze-unlinked', ['--csv' => $csvPath])
            ->assertExitCode(0);

        $this->assertFileExists($csvPath);
        $content = file_get_contents($csvPath);
        $this->assertStringContainsString('Guru Test CSV', $content);
        $this->assertStringContainsString('NULL_DENGAN_UNIT_KERJA', $content);

        if (file_exists($csvPath)) {
            unlink($csvPath);
        }
    }
}
