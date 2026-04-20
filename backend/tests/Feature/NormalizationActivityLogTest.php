<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NormalizationActivityLogTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected School $school;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->school = School::factory()->create(['nama' => 'MI Test School']);
        $this->user = User::factory()->create([
            'role' => 'operator',
            'school_id' => $this->school->id,
        ]);
    }

    public function test_sk_submission_logs_normalization_changes(): void
    {
        $payload = [
            'nama' => 'ahmad dahlan, s.pd',  // Will be normalized to "AHMAD DAHLAN, S.Pd"
            'nuptk' => '1234567890123456',
            'jenis_sk' => 'Pengangkatan',
            'unit_kerja' => 'mi test school',  // Will be normalized to "MI Test School"
            'surat_permohonan_url' => 'https://example.com/surat.pdf',
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/sk-documents/submit-request', $payload);

        $response->assertStatus(201);
        $skId = $response->json('id');

        // Check if activity log contains normalization details
        $activityLog = ActivityLog::where('subject_id', $skId)
            ->where('event', 'submit_sk_request')
            ->first();

        $this->assertNotNull($activityLog);
        
        // Check if normalization changes are logged in properties
        $properties = $activityLog->properties;
        $this->assertArrayHasKey('normalization', $properties);
        
        $normalization = $properties['normalization'];
        
        // Check nama normalization
        $this->assertArrayHasKey('nama', $normalization);
        $this->assertEquals('ahmad dahlan, s.pd', $normalization['nama']['original']);
        $this->assertEquals('AHMAD DAHLAN, S.Pd.', $normalization['nama']['normalized']);
        
        // Check unit_kerja normalization
        $this->assertArrayHasKey('unit_kerja', $normalization);
        $this->assertEquals('mi test school', $normalization['unit_kerja']['original']);
        $this->assertEquals('MI Test School', $normalization['unit_kerja']['normalized']);
    }

    public function test_teacher_creation_logs_normalization_changes(): void
    {
        $payload = [
            'nama' => 'siti aminah, m.pd',  // Will be normalized to "SITI AMINAH, M.Pd"
            'nuptk' => '9876543210987654',
            'unit_kerja' => 'ma test school',  // Will be normalized to "MA Test School"
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/teachers', $payload);

        $response->assertStatus(201);
        $teacherId = $response->json('data.id');

        // Check if activity log contains normalization details
        $activityLog = ActivityLog::where('subject_id', $teacherId)
            ->where('event', 'create_teacher')
            ->first();

        $this->assertNotNull($activityLog);
        
        // Check if normalization changes are logged in properties
        $properties = $activityLog->properties;
        $this->assertArrayHasKey('normalization', $properties);
        
        $normalization = $properties['normalization'];
        
        // Check nama normalization
        $this->assertArrayHasKey('nama', $normalization);
        $this->assertEquals('siti aminah, m.pd', $normalization['nama']['original']);
        $this->assertEquals('SITI AMINAH, M.Pd.', $normalization['nama']['normalized']);
        
        // Check unit_kerja normalization
        $this->assertArrayHasKey('unit_kerja', $normalization);
        $this->assertEquals('ma test school', $normalization['unit_kerja']['original']);
        $this->assertEquals('MA Test School', $normalization['unit_kerja']['normalized']);
    }

    public function test_teacher_update_logs_normalization_changes(): void
    {
        // Create a teacher first
        $teacher = Teacher::factory()->create([
            'nama' => 'ORIGINAL NAME',
            'school_id' => $this->school->id,
        ]);

        $payload = [
            'nama' => 'updated name, dr',  // Will be normalized to "UPDATED NAME, Dr"
        ];

        $response = $this->actingAs($this->user)
            ->putJson("/api/teachers/{$teacher->id}", $payload);

        $response->assertStatus(200);

        // Check if normalization activity log was created
        $activityLog = ActivityLog::where('subject_id', $teacher->id)
            ->where('event', 'normalize_teacher')
            ->first();

        $this->assertNotNull($activityLog);
        
        // Check if normalization changes are logged in properties
        $properties = $activityLog->properties;
        $this->assertArrayHasKey('normalization', $properties);
        
        $normalization = $properties['normalization'];
        
        // Check nama normalization
        $this->assertArrayHasKey('nama', $normalization);
        $this->assertEquals('updated name, dr', $normalization['nama']['original']);
        $this->assertEquals('Dr. UPDATED NAME', $normalization['nama']['normalized']);
    }

    public function test_no_normalization_log_when_no_changes(): void
    {
        // Create a teacher with already normalized name
        $teacher = Teacher::factory()->create([
            'nama' => 'ALREADY NORMALIZED NAME',
            'school_id' => $this->school->id,
        ]);

        $payload = [
            'nama' => 'ALREADY NORMALIZED NAME',  // No change needed
        ];

        $response = $this->actingAs($this->user)
            ->putJson("/api/teachers/{$teacher->id}", $payload);

        $response->assertStatus(200);

        // Check that no normalization activity log was created
        $activityLog = ActivityLog::where('subject_id', $teacher->id)
            ->where('event', 'normalize_teacher')
            ->first();

        $this->assertNull($activityLog, 'No normalization log should be created when no changes occur');
    }
}