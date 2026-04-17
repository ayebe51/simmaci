<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\School;
use App\Models\Teacher;
use App\Models\SkDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NormalizeDataCommandTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that the command normalizes existing school names correctly
     * Requirements: 8.1, 8.2
     */
    public function test_command_normalizes_existing_school_names(): void
    {
        // Create schools with various non-normalized names
        $schools = [
            School::factory()->create(['nama' => 'mi darwata glempang']),
            School::factory()->create(['nama' => 'MA NURUL HUDA']),
            School::factory()->create(['nama' => 'mts al-ikhlas']),
            School::factory()->create(['nama' => 'SMP negeri 1']),
        ];

        // Run the normalization command
        $this->artisan('normalize:data')
            ->expectsOutput('🚀 Starting data normalization...')
            ->expectsOutput('✏️  LIVE MODE - Database will be updated')
            ->expectsOutput('📚 Normalizing school names...')
            ->expectsOutput('✅ Normalization complete!')
            ->assertExitCode(0);

        // Verify schools were normalized correctly
        $schools[0]->refresh();
        $schools[1]->refresh();
        $schools[2]->refresh();
        $schools[3]->refresh();

        $this->assertEquals('MI Darwata Glempang', $schools[0]->nama);
        $this->assertEquals('MA Nurul Huda', $schools[1]->nama);
        $this->assertEquals('MTs Al-Ikhlas', $schools[2]->nama);
        $this->assertEquals('SMP Negeri 1', $schools[3]->nama);
    }

    /**
     * Test that the command normalizes existing teacher names correctly
     * Requirements: 8.1, 8.3
     */
    public function test_command_normalizes_existing_teacher_names(): void
    {
        $school = School::factory()->create(['nama' => 'MI Test School']);

        // Create teachers with various non-normalized names
        $teachers = [
            Teacher::factory()->create([
                'nama' => 'ahmad dahlan, s.pd',
                'unit_kerja' => 'mi test school',
                'school_id' => $school->id,
            ]),
            Teacher::factory()->create([
                'nama' => 'SITI AMINAH M.PD',
                'unit_kerja' => 'ma test school',
                'school_id' => $school->id,
            ]),
            Teacher::factory()->create([
                'nama' => 'dr. abdul rahman, s.ag, m.ag',
                'unit_kerja' => 'mts test school',
                'school_id' => $school->id,
            ]),
            Teacher::factory()->create([
                'nama' => 'fatimah zahra',
                'unit_kerja' => 'smp test school',
                'school_id' => $school->id,
            ]),
        ];

        // Run the normalization command
        $this->artisan('normalize:data')
            ->expectsOutput('👨‍🏫 Normalizing teacher names...')
            ->assertExitCode(0);

        // Verify teachers were normalized correctly
        foreach ($teachers as $teacher) {
            $teacher->refresh();
        }

        $this->assertEquals('AHMAD DAHLAN, S.Pd.', $teachers[0]->nama);
        $this->assertEquals('MI Test School', $teachers[0]->unit_kerja);
        
        $this->assertEquals('SITI AMINAH, M.Pd.', $teachers[1]->nama);
        $this->assertEquals('MA Test School', $teachers[1]->unit_kerja);
        
        $this->assertEquals('Dr. ABDUL RAHMAN, S.Ag., M.Ag.', $teachers[2]->nama);
        $this->assertEquals('MTs Test School', $teachers[2]->unit_kerja);
        
        $this->assertEquals('FATIMAH ZAHRA', $teachers[3]->nama);
        $this->assertEquals('SMP Test School', $teachers[3]->unit_kerja);
    }

    /**
     * Test that the command normalizes SK document names correctly
     * Requirements: 8.1, 8.4
     */
    public function test_command_normalizes_sk_document_names(): void
    {
        $school = School::factory()->create(['nama' => 'MI Test School']);
        $teacher = Teacher::factory()->create(['school_id' => $school->id]);

        // Create SK documents with various non-normalized names
        $skDocuments = [
            SkDocument::factory()->create([
                'nama' => 'ahmad dahlan, s.pd',
                'unit_kerja' => 'mi test school',
                'school_id' => $school->id,
                'teacher_id' => $teacher->id,
            ]),
            SkDocument::factory()->create([
                'nama' => 'SITI AMINAH M.PD',
                'unit_kerja' => 'ma test school',
                'school_id' => $school->id,
                'teacher_id' => $teacher->id,
            ]),
            SkDocument::factory()->create([
                'nama' => 'dr. abdul rahman, s.ag',
                'unit_kerja' => 'mts test school',
                'school_id' => $school->id,
                'teacher_id' => $teacher->id,
            ]),
        ];

        // Run the normalization command
        $this->artisan('normalize:data')
            ->expectsOutput('📄 Normalizing SK document names...')
            ->assertExitCode(0);

        // Verify SK documents were normalized correctly
        foreach ($skDocuments as $doc) {
            $doc->refresh();
        }

        $this->assertEquals('AHMAD DAHLAN, S.Pd.', $skDocuments[0]->nama);
        $this->assertEquals('MI Test School', $skDocuments[0]->unit_kerja);
        
        $this->assertEquals('SITI AMINAH, M.Pd.', $skDocuments[1]->nama);
        $this->assertEquals('MA Test School', $skDocuments[1]->unit_kerja);
        
        $this->assertEquals('Dr. ABDUL RAHMAN, S.Ag.', $skDocuments[2]->nama);
        $this->assertEquals('MTs Test School', $skDocuments[2]->unit_kerja);
    }

    /**
     * Test that --dry-run flag does not modify database
     * Requirements: 8.5
     */
    public function test_dry_run_flag_does_not_modify_database(): void
    {
        // Create test data with non-normalized names
        $school = School::factory()->create(['nama' => 'mi test school']);
        $teacher = Teacher::factory()->create([
            'nama' => 'ahmad dahlan, s.pd',
            'unit_kerja' => 'ma test school',
            'school_id' => $school->id,
        ]);
        $skDocument = SkDocument::factory()->create([
            'nama' => 'siti aminah, m.pd',
            'unit_kerja' => 'smp test school',
            'school_id' => $school->id,
            'teacher_id' => $teacher->id,
        ]);

        // Store original values
        $originalSchoolName = $school->nama;
        $originalTeacherName = $teacher->nama;
        $originalTeacherUnit = $teacher->unit_kerja;
        $originalSkDocName = $skDocument->nama;
        $originalSkDocUnit = $skDocument->unit_kerja;

        // Run the normalization command in dry-run mode
        $this->artisan('normalize:data --dry-run')
            ->expectsOutput('🚀 Starting data normalization...')
            ->expectsOutput('📋 DRY RUN MODE - No changes will be saved')
            ->expectsOutput('📚 Normalizing school names...')
            ->expectsOutput('👨‍🏫 Normalizing teacher names...')
            ->expectsOutput('📄 Normalizing SK document names...')
            ->expectsOutput('✅ Normalization complete!')
            ->assertExitCode(0);

        // Verify data was NOT changed
        $school->refresh();
        $teacher->refresh();
        $skDocument->refresh();

        $this->assertEquals($originalSchoolName, $school->nama);
        $this->assertEquals($originalTeacherName, $teacher->nama);
        $this->assertEquals($originalTeacherUnit, $teacher->unit_kerja);
        $this->assertEquals($originalSkDocName, $skDocument->nama);
        $this->assertEquals($originalSkDocUnit, $skDocument->unit_kerja);

        // Verify NO activity logs were created in dry-run mode
        $summaryLog = ActivityLog::where('event', 'normalize_data')->first();
        $this->assertNull($summaryLog);

        $batchLogs = ActivityLog::where('event', 'batch_normalize_data')->get();
        $this->assertEquals(0, $batchLogs->count());
    }

    /**
     * Test that command outputs summary statistics
     * Requirements: 8.6
     */
    public function test_command_outputs_summary_statistics(): void
    {
        // Create test data with some normalized and some non-normalized names
        School::factory()->create(['nama' => 'mi test school']); // needs normalization
        School::factory()->create(['nama' => 'MA Already Normalized']); // already normalized
        
        $school = School::factory()->create(['nama' => 'MI Test School']);
        Teacher::factory()->create([
            'nama' => 'ahmad dahlan, s.pd', // needs normalization
            'unit_kerja' => 'MI Test School', // already normalized - won't add to count
            'school_id' => $school->id,
        ]);
        Teacher::factory()->create([
            'nama' => 'ALREADY NORMALIZED TEACHER', // already normalized
            'unit_kerja' => 'MA Already Normalized', // already normalized
            'school_id' => $school->id,
        ]);

        // Run the normalization command and capture output
        $this->artisan('normalize:data')
            ->expectsOutputToContain('✅ Normalization complete!')
            ->expectsTable(['Entity', 'Records Updated'], [
                ['Schools', '1'],
                ['Teachers', '1'],
                ['SK Documents', '0'],
                ['Total', '2'],
            ])
            ->assertExitCode(0);
    }

    /**
     * Test error handling for individual record failures
     * The command catches per-record errors, logs them, and continues processing remaining records.
     * Requirements: 8.9
     */
    public function test_error_handling_for_individual_record_failures(): void
    {
        // Create a mix of schools: one that will fail and others that should succeed
        $goodSchool1 = School::factory()->create(['nama' => 'mi test school']);
        $goodSchool2 = School::factory()->create(['nama' => 'ma test school']);

        // Partially mock NormalizationService to throw on the first call, succeed on the rest
        $realService = app(\App\Services\NormalizationService::class);
        $callCount = 0;

        $mockService = $this->partialMock(\App\Services\NormalizationService::class, function ($mock) use (&$callCount, $realService) {
            $mock->shouldReceive('normalizeSchoolName')
                ->andReturnUsing(function ($name) use (&$callCount, $realService) {
                    $callCount++;
                    if ($callCount === 1) {
                        throw new \Exception('Simulated per-record failure');
                    }
                    return $realService->normalizeSchoolName($name);
                });
        });

        // Command should still exit successfully — individual errors don't abort the run
        $this->artisan('normalize:data')
            ->expectsOutput('🚀 Starting data normalization...')
            ->expectsOutput('✅ Normalization complete!')
            ->assertExitCode(0);

        // The second school should still have been processed despite the first failing
        $goodSchool2->refresh();
        $this->assertEquals('MA Test School', $goodSchool2->nama);
    }

    /**
     * Test command with custom batch size option
     * Requirements: 8.7
     */
    public function test_command_with_custom_batch_size(): void
    {
        // Create multiple schools to test batching
        School::factory()->count(5)->create(['nama' => 'mi test school']);

        // Run with custom batch size
        $this->artisan('normalize:data --batch=2')
            ->expectsOutput('🚀 Starting data normalization...')
            ->expectsOutput('✅ Normalization complete!')
            ->assertExitCode(0);

        // Verify all schools were normalized despite custom batch size
        $normalizedCount = School::where('nama', 'MI Test School')->count();
        $this->assertEquals(5, $normalizedCount);
    }

    /**
     * Test command creates activity logs for normalization changes
     * Requirements: 12.1, 12.2, 12.4
     */
    public function test_command_creates_activity_logs(): void
    {
        // Create test data with non-normalized names
        $school = School::factory()->create(['nama' => 'mi test school']);
        $teacher = Teacher::factory()->create([
            'nama' => 'ahmad dahlan, s.pd',
            'unit_kerja' => 'ma test school',
            'school_id' => $school->id,
        ]);
        $skDocument = SkDocument::factory()->create([
            'nama' => 'siti aminah, m.pd',
            'unit_kerja' => 'smp test school',
            'school_id' => $school->id,
            'teacher_id' => $teacher->id,
        ]);

        // Run the normalization command
        $this->artisan('normalize:data')
            ->assertExitCode(0);

        // Check that summary activity log was created
        $summaryLog = ActivityLog::where('event', 'normalize_data')->first();
        $this->assertNotNull($summaryLog);
        $this->assertStringContainsString('Data normalization completed', $summaryLog->description);
        $this->assertStringContainsString('1 schools, 1 teachers, 1 SK documents updated', $summaryLog->description);

        // Check that batch normalization logs were created
        $batchLogs = ActivityLog::where('event', 'batch_normalize_data')->get();
        $this->assertGreaterThan(0, $batchLogs->count());

        // Verify batch log structure and content
        foreach ($batchLogs as $batchLog) {
            $properties = $batchLog->properties;
            $this->assertArrayHasKey('entity_type', $properties);
            $this->assertArrayHasKey('changes', $properties);
            $this->assertArrayHasKey('batch_size', $properties);
            
            // Verify changes structure includes original and normalized values
            foreach ($properties['changes'] as $change) {
                $this->assertArrayHasKey('table', $change);
                $this->assertArrayHasKey('record_id', $change);
                $this->assertArrayHasKey('field', $change);
                $this->assertArrayHasKey('original', $change);
                $this->assertArrayHasKey('normalized', $change);
                
                // Verify the change actually represents a normalization
                $this->assertNotEquals($change['original'], $change['normalized']);
            }
        }
    }

    /**
     * Test command handles empty database gracefully
     */
    public function test_command_handles_empty_database(): void
    {
        // Run command on empty database
        $this->artisan('normalize:data')
            ->expectsOutput('📚 Normalizing school names...')
            ->expectsOutput('  No schools found to normalize.')
            ->expectsOutput('👨‍🏫 Normalizing teacher names...')
            ->expectsOutput('  No teachers found to normalize.')
            ->expectsOutput('📄 Normalizing SK document names...')
            ->expectsOutput('  No SK documents found to normalize.')
            ->expectsOutput('✅ Normalization complete!')
            ->expectsTable(['Entity', 'Records Updated'], [
                ['Schools', '0'],
                ['Teachers', '0'],
                ['SK Documents', '0'],
                ['Total', '0'],
            ])
            ->assertExitCode(0);

        // Verify summary log is still created even with no changes
        $summaryLog = ActivityLog::where('event', 'normalize_data')->first();
        $this->assertNotNull($summaryLog);
        $this->assertStringContainsString('0 schools, 0 teachers, 0 SK documents updated', $summaryLog->description);
    }

    /**
     * Test command with already normalized data
     */
    public function test_command_with_already_normalized_data(): void
    {
        // Create test data with already normalized names
        $school = School::factory()->create(['nama' => 'MI Already Normalized']);
        $teacher = Teacher::factory()->create([
            'nama' => 'ALREADY NORMALIZED TEACHER',
            'unit_kerja' => 'MA Already Normalized',
            'school_id' => $school->id,
        ]);
        $skDocument = SkDocument::factory()->create([
            'nama' => 'ALREADY NORMALIZED TEACHER',
            'unit_kerja' => 'SMP Already Normalized',
            'school_id' => $school->id,
            'teacher_id' => $teacher->id,
        ]);

        // Run the normalization command
        $this->artisan('normalize:data')
            ->expectsOutput('✅ Normalization complete!')
            ->expectsTable(['Entity', 'Records Updated'], [
                ['Schools', '0'],
                ['Teachers', '0'],
                ['SK Documents', '0'],
                ['Total', '0'],
            ])
            ->assertExitCode(0);

        // Verify data remains unchanged
        $school->refresh();
        $teacher->refresh();
        $skDocument->refresh();

        $this->assertEquals('MI Already Normalized', $school->nama);
        $this->assertEquals('ALREADY NORMALIZED TEACHER', $teacher->nama);
        $this->assertEquals('MA Already Normalized', $teacher->unit_kerja);
        $this->assertEquals('ALREADY NORMALIZED TEACHER', $skDocument->nama);
        $this->assertEquals('SMP Already Normalized', $skDocument->unit_kerja);

        // Check that summary log was still created (even with 0 updates)
        $summaryLog = ActivityLog::where('event', 'normalize_data')->first();
        $this->assertNotNull($summaryLog);
        $this->assertStringContainsString('0 schools, 0 teachers, 0 SK documents updated', $summaryLog->description);

        // Check that no batch logs were created (no changes)
        $batchLogs = ActivityLog::where('event', 'batch_normalize_data')->get();
        $this->assertEquals(0, $batchLogs->count());
    }
}