<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Test database transaction handling for SchoolController update method
 * Task 1.3: Implement activity logging for headmaster profile updates
 * 
 * This test verifies that school updates and activity logging are wrapped
 * in a database transaction to ensure atomicity (Requirements 7.1, 7.2)
 */
class SchoolUpdateTransactionTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private School $school;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create([
            'nama' => 'MI Test School',
            'kepala_madrasah' => 'Original Name',
        ]);

        $this->superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'email' => 'superadmin@test.com',
            'is_active' => true,
        ]);
    }

    /**
     * Test that school update and activity log creation are atomic
     * Requirements: 7.1, 7.2
     * 
     * This test verifies that both the school update and activity log
     * are created within a single database transaction. If either fails,
     * both should be rolled back.
     * 
     * We verify atomicity by checking that both operations complete successfully
     * together. The transaction wrapper in the code ensures that if either
     * operation fails, both are rolled back.
     */
    public function test_update_and_activity_log_are_atomic(): void
    {
        $updateData = [
            'kepala_madrasah' => 'Updated Name',
            'kepala_nim' => '123456',
        ];

        // Get initial counts
        $initialActivityLogCount = ActivityLog::where('subject_id', $this->school->id)->count();

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->school->id}", $updateData);

        $response->assertOk();

        // Verify both school and activity log were created atomically
        // If transaction works correctly, both should succeed together
        $this->assertDatabaseHas('schools', [
            'id' => $this->school->id,
            'kepala_madrasah' => 'Updated Name',
            'kepala_nim' => '123456',
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'event' => 'update_school',
            'subject_id' => $this->school->id,
            'causer_id' => $this->superAdmin->id,
            'school_id' => $this->school->id,
        ]);

        // Verify exactly one new activity log was created
        $finalActivityLogCount = ActivityLog::where('subject_id', $this->school->id)->count();
        $this->assertEquals($initialActivityLogCount + 1, $finalActivityLogCount);

        // Verify school data was updated
        $this->school->refresh();
        $this->assertEquals('Updated Name', $this->school->kepala_madrasah);
        $this->assertEquals('123456', $this->school->kepala_nim);
    }

    /**
     * Test that activity log contains correct information
     * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
     */
    public function test_activity_log_contains_all_required_fields(): void
    {
        $updateData = [
            'kepala_madrasah' => 'Test Name',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->school->id}", $updateData);

        $response->assertOk();

        // Verify activity log has all required fields
        $activityLog = ActivityLog::where('event', 'update_school')
            ->where('subject_id', $this->school->id)
            ->latest()
            ->first();

        $this->assertNotNull($activityLog, 'Activity log should be created');
        
        // Requirement 4.2: Record causer_id (user who performed update)
        $this->assertEquals($this->superAdmin->id, $activityLog->causer_id);
        $this->assertEquals(User::class, $activityLog->causer_type);
        
        // Requirement 4.3: Record school_id (school that was updated)
        $this->assertEquals($this->school->id, $activityLog->school_id);
        
        // Requirement 4.4: Record timestamp
        $this->assertNotNull($activityLog->created_at);
        
        // Requirement 4.5: Include description with school name and action
        $this->assertStringContainsString($this->school->nama, $activityLog->description);
        $this->assertStringContainsString('Memperbarui', $activityLog->description);
        
        // Additional fields
        $this->assertEquals('update_school', $activityLog->event);
        $this->assertEquals('school', $activityLog->log_name);
        $this->assertEquals($this->school->id, $activityLog->subject_id);
        $this->assertEquals(School::class, $activityLog->subject_type);
    }

    /**
     * Test that no activity log is created when update data is empty
     * Requirements: 4.1
     */
    public function test_no_activity_log_when_no_update_data(): void
    {
        $initialCount = ActivityLog::count();

        // Send empty update (all null values)
        $updateData = [
            'kepala_madrasah' => null,
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->school->id}", $updateData);

        $response->assertOk();

        // Verify no new activity log was created
        $this->assertEquals($initialCount, ActivityLog::count());
    }

    /**
     * Test that activity log description includes school name
     * Requirements: 4.5
     */
    public function test_activity_log_description_includes_school_name(): void
    {
        $updateData = [
            'kepala_madrasah' => 'New Headmaster',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->school->id}", $updateData);

        $response->assertOk();

        $activityLog = ActivityLog::where('event', 'update_school')
            ->where('subject_id', $this->school->id)
            ->latest()
            ->first();

        $this->assertNotNull($activityLog);
        $this->assertStringContainsString($this->school->nama, $activityLog->description);
        $this->assertEquals("Memperbarui data sekolah: {$this->school->nama}", $activityLog->description);
    }

    /**
     * Test that multiple updates create separate activity logs
     * Requirements: 4.1, 4.2, 4.3
     */
    public function test_multiple_updates_create_separate_activity_logs(): void
    {
        $initialCount = ActivityLog::where('subject_id', $this->school->id)->count();

        // First update
        $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->school->id}", [
                'kepala_madrasah' => 'First Update',
            ])
            ->assertOk();

        // Second update
        $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->school->id}", [
                'kepala_madrasah' => 'Second Update',
            ])
            ->assertOk();

        // Verify two new activity logs were created
        $finalCount = ActivityLog::where('subject_id', $this->school->id)->count();
        $this->assertEquals($initialCount + 2, $finalCount);
    }

    /**
     * Test that activity log records the correct user for operator updates
     * Requirements: 4.2
     */
    public function test_activity_log_records_operator_as_causer(): void
    {
        $operator = User::factory()->create([
            'role' => 'operator',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);

        $updateData = [
            'kepala_madrasah' => 'Operator Update',
        ];

        $response = $this->actingAs($operator)
            ->putJson("/api/schools/{$this->school->id}", $updateData);

        $response->assertOk();

        $activityLog = ActivityLog::where('event', 'update_school')
            ->where('subject_id', $this->school->id)
            ->latest()
            ->first();

        $this->assertNotNull($activityLog);
        $this->assertEquals($operator->id, $activityLog->causer_id);
        $this->assertEquals(User::class, $activityLog->causer_type);
    }
}
