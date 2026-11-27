<?php

namespace Tests\Feature;

use App\Jobs\ProcessBulkSkSubmission;
use App\Models\ActivityLog;
use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\User;
use App\Services\NormalizationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class BulkSkDateValidationP0Test extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private User $operator;

    public function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama'                   => 'MI Ma\'arif NU 01 P0 Test',
            'sk_submission_unlocked' => true,
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator-p0@example.com',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);
    }

    /**
     * Helper membuat N baris guru valid dengan variasi tanggal teks bahasa Indonesia.
     */
    private function makeValidTeacherRows(int $count, bool $injectLegacyPermohonan = false): array
    {
        $birthDates = [
            '03 Agustus 1992',
            '20 Februari 1984',
            '11 Nov 1990',
            '11 November 1988',
            '11 Nopember 1991',
            '05 Januari 1995',
            '21 Agu 1993',
            '12 Mei 1987',
        ];
        $tmtDates = [
            '15 Juli 2013',
            '02 Desember 2018',
            '01 Juli 2015',
            '05 Januari 2023',
            '21 Agustus 2024',
            '10 Oktober 2019',
            '17 Juni 2016',
            '19 September 2020',
        ];

        $rows = [];
        for ($i = 0; $i < $count; $i++) {
            $row = [
                'nama'                => 'Guru Uji P0 ' . ($i + 1),
                'tempat_lahir'        => 'Cilacap',
                'tanggal_lahir'       => $birthDates[$i % count($birthDates)],
                'nomor_induk_maarif'  => '113490' . str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT),
                'pendidikan_terakhir' => 'S1 PAI',
                'unit_kerja'          => $this->school->nama,
                'tmt'                 => $tmtDates[$i % count($tmtDates)],
                'status'              => 'GTY',
                'status_kepegawaian'  => 'GTY',
                'jenis_pengajuan'     => 'Perpanjangan',
            ];

            if ($injectLegacyPermohonan) {
                $row['nomor_permohonan']   = '001/SK/2026';
                $row['tanggal_permohonan'] = '2026-08-11';
            }

            $rows[] = $row;
        }

        return $rows;
    }

    public function test_bulk_sk_sync_accepts_root_tanggal_permohonan_with_valid_indonesian_excel_dates(): void
    {
        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', [
                'surat_permohonan_url' => 'https://example.com/surat-permohonan.pdf',
                'nomor_permohonan'     => '001/SK/2026',
                'tanggal_permohonan'   => '2026-08-11',
                'documents'            => $this->makeValidTeacherRows(2),
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'count'   => 2,
                'skipped' => 0,
            ]);

        $this->assertDatabaseCount('sk_documents', 2);
        $this->assertDatabaseHas('sk_documents', [
            'nama'               => 'GURU UJI P0 1',
            'nomor_permohonan'   => '001/SK/2026',
            'tanggal_permohonan' => '2026-08-11',
            'status'             => 'pending',
        ]);
        $this->assertDatabaseHas('teachers', [
            'nomor_induk_maarif' => '113490001',
            'tanggal_lahir'      => '1992-08-03',
            'tmt'                => '2013-07-15',
        ]);
    }

    public function test_bulk_sk_backward_compatible_per_row_tanggal_permohonan_does_not_trigger_excel_error(): void
    {
        // Reproduksi persis payload legacy frontend sebelum pemisahan root payload
        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', [
                'surat_permohonan_url' => 'https://example.com/surat-permohonan.pdf',
                'documents'            => $this->makeValidTeacherRows(2, injectLegacyPermohonan: true),
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'count'   => 2,
                'skipped' => 0,
            ]);

        $this->assertDatabaseHas('sk_documents', [
            'nama'               => 'GURU UJI P0 1',
            'nomor_permohonan'   => '001/SK/2026',
            'tanggal_permohonan' => '2026-08-11',
        ]);
    }

    public function test_bulk_sk_with_8_teachers_and_tanggal_permohonan_queues_and_processes_all_8_rows(): void
    {
        Queue::fake();

        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', [
                'surat_permohonan_url' => 'https://example.com/surat-permohonan-8.pdf',
                'nomor_permohonan'     => '008/SK/2026',
                'tanggal_permohonan'   => '2026-08-11',
                'documents'            => $this->makeValidTeacherRows(8),
            ]);

        $response->assertStatus(202)
            ->assertJson([
                'success' => true,
                'queued'  => true,
                'count'   => 8,
            ]);

        $dispatchedJob = null;
        Queue::assertPushed(ProcessBulkSkSubmission::class, function (ProcessBulkSkSubmission $job) use (&$dispatchedJob) {
            $dispatchedJob = $job;
            return count($job->documents) === 8
                && $job->nomorPermohonan === '008/SK/2026'
                && $job->tanggalPermohonan === '2026-08-11';
        });

        $this->assertNotNull($dispatchedJob);

        // Jalankan job secara langsung untuk memastikan seluruh 8 SK tersimpan sempurna
        $dispatchedJob->handle(app(NormalizationService::class));

        $this->assertDatabaseCount('sk_documents', 8);
        $this->assertEquals(
            8,
            SkDocument::withoutTenantScope()
                ->where('nomor_permohonan', '008/SK/2026')
                ->where('tanggal_permohonan', '2026-08-11')
                ->where('status', 'pending')
                ->count()
        );
    }

    public function test_bulk_sk_with_12_teachers_processes_all_without_progress_log_crash(): void
    {
        Queue::fake();

        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', [
                'surat_permohonan_url' => 'https://example.com/surat-permohonan-12.pdf',
                'nomor_permohonan'     => '012/SK/2026',
                'tanggal_permohonan'   => '2026-08-11',
                'documents'            => $this->makeValidTeacherRows(12),
            ]);

        $response->assertStatus(202);

        $dispatchedJob = null;
        Queue::assertPushed(ProcessBulkSkSubmission::class, function (ProcessBulkSkSubmission $job) use (&$dispatchedJob) {
            $dispatchedJob = $job;
            return count($job->documents) === 12;
        });

        $dispatchedJob->handle(app(NormalizationService::class));

        $this->assertDatabaseCount('sk_documents', 12);
        $log = ActivityLog::where('event', 'bulk_sk_request')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertStringContainsString('12 permohonan dibuat', $log->description);
        $this->assertStringNotContainsString('dilewati', $log->description);
    }

    public function test_bulk_sk_rejects_invalid_form_tanggal_permohonan_as_form_error_not_excel_error(): void
    {
        $invalidFormDates = ['11/08/2026', '2026-02-30', '11 Agustus 2026', 'invalid-date'];

        foreach ($invalidFormDates as $badDate) {
            $response = $this->actingAs($this->operator)
                ->postJson('/api/sk-documents/bulk-request', [
                    'surat_permohonan_url' => 'https://example.com/surat.pdf',
                    'nomor_permohonan'     => '001/SK/2026',
                    'tanggal_permohonan'   => $badDate,
                    'documents'            => $this->makeValidTeacherRows(2),
                ]);

            $response->assertStatus(422)
                ->assertJsonValidationErrors(['tanggal_permohonan']);

            // Wajib TIDAK mengembalikan date_errors Excel sehingga modal error Excel tidak muncul
            $this->assertNull($response->json('date_errors'), "Bad form date '{$badDate}' must not return Excel date_errors");
            $this->assertStringNotContainsString('Excel', (string) $response->json('message'));
        }

        $this->assertDatabaseCount('sk_documents', 0);
    }

    public function test_bulk_sk_still_strictly_rejects_ambiguous_numeric_dates_in_excel_teacher_rows(): void
    {
        $docs = $this->makeValidTeacherRows(2);
        $docs[0]['tanggal_lahir'] = '11/12/2022'; // Ambiguous numeric slash
        $docs[1]['tmt']           = '2022-12-11'; // ISO numeric in Excel

        $response = $this->actingAs($this->operator)
            ->postJson('/api/sk-documents/bulk-request', [
                'surat_permohonan_url' => 'https://example.com/surat.pdf',
                'nomor_permohonan'     => '001/SK/2026',
                'tanggal_permohonan'   => '2026-08-11',
                'documents'            => $docs,
            ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'source'  => 'excel',
            ]);

        $dateErrors = $response->json('date_errors');
        $this->assertCount(2, $dateErrors);

        $columns = array_column($dateErrors, 'column');
        $this->assertContains('Tanggal Lahir', $columns);
        $this->assertContains('Tanggal Mulai Tugas (TMT)', $columns);
        $this->assertNotContains('Tanggal Permohonan', $columns);

        // Pastikan seluruh transaksi dibatalkan tanpa partial import
        $this->assertDatabaseCount('sk_documents', 0);
        $this->assertDatabaseCount('teachers', 0);
    }
}
