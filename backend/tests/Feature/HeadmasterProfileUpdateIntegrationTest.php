<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Integration tests for headmaster profile update end-to-end workflow
 * Task 9.1: Write backend integration tests
 * 
 * Tests the complete workflow from API request to database update and activity logging
 * Requirements: 4.1, 4.2, 4.3, 7.1, 7.2
 */
class HeadmasterProfileUpdateIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $adminYayasan;
    private User $operator;
    private School $operatorSchool;
    private School $otherSchool;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test schools
        $this->operatorSchool = School::factory()->create([
            'nama' => 'MI Test Operator School',
            'kecamatan' => 'Cilacap Tengah',
            'kepala_madrasah' => 'Original Headmaster',
            'kepala_nim' => '111111',
            'kepala_jabatan_mulai' => '2020-01-01',
        ]);

        $this->otherSchool = School::factory()->create([
            'nama' => 'MI Test Other School',
            'kecamatan' => 'Cilacap Selatan',
            'kepala_madrasah' => 'Other Headmaster',
        ]);

        // Create users with different roles
        $this->superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'email' => 'superadmin@test.com',
            'is_active' => true,
        ]);

        $this->adminYayasan = User::factory()->create([
            'role' => 'admin_yayasan',
            'email' => 'adminyayasan@test.com',
            'is_active' => true,
        ]);

        $this->operator = User::factory()->create([
            'role' => 'operator',
            'email' => 'operator@test.com',
            'school_id' => $this->operatorSchool->id,
            'is_active' => true,
        ]);
    }

    /**
     * Test admin can complete full update workflow
     * Requirements: 4.1, 4.2, 4.3, 7.1, 7.2
     * 
     * This test verifies the complete end-to-end workflow:
     * 1. Admin authenticates
     * 2. Admin selects a school
     * 3. Admin updates headmaster profile
     * 4. System validates input
     * 5. System updates database
     * 6. System creates activity log
     * 7. System returns updated data
     */
    public function test_admin_can_complete_full_update_workflow(): void
    {
        // Step 1: Get initial state
        $initialSchoolData = $this->otherSchool->fresh();
        $initialActivityLogCount = ActivityLog::where('subject_id', $this->otherSchool->id)->count();

        // Step 2: Prepare complete headmaster profile update
        $updateData = [
            'kepala_madrasah' => 'Ahmad Dahlan',
            'kepala_nim' => '123456',
            'kepala_nuptk' => '1234567890123456',
            'kepala_whatsapp' => '081234567890',
            'kepala_jabatan_mulai' => '2020-01-01',
            'kepala_jabatan_selesai' => '2024-12-31',
        ];

        // Step 3: Execute update as super admin
        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        // Step 4: Verify response
        $response->assertOk();
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'id',
                'nama',
                'kepala_madrasah',
                'kepala_nim',
                'kepala_nuptk',
                'kepala_whatsapp',
                'kepala_jabatan_mulai',
                'kepala_jabatan_selesai',
                'updated_at',
            ],
        ]);

        $response->assertJson([
            'success' => true,
        ]);

        // Step 5: Verify database was updated
        $this->assertDatabaseHas('schools', [
            'id' => $this->otherSchool->id,
            'kepala_madrasah' => 'Ahmad Dahlan',
            'kepala_nim' => '123456',
            'kepala_nuptk' => '1234567890123456',
            'kepala_whatsapp' => '081234567890',
            'kepala_jabatan_mulai' => '2020-01-01',
            'kepala_jabatan_selesai' => '2024-12-31',
        ]);

        // Step 6: Verify activity log was created (Requirement 4.1)
        $finalActivityLogCount = ActivityLog::where('subject_id', $this->otherSchool->id)->count();
        $this->assertEquals($initialActivityLogCount + 1, $finalActivityLogCount);

        // Step 7: Verify activity log contains correct information
        $activityLog = ActivityLog::where('event', 'update_school')
            ->where('subject_id', $this->otherSchool->id)
            ->latest()
            ->first();

        $this->assertNotNull($activityLog);
        
        // Requirement 4.2: Record causer_id (user who performed update)
        $this->assertEquals($this->superAdmin->id, $activityLog->causer_id);
        $this->assertEquals(User::class, $activityLog->causer_type);
        
        // Requirement 4.3: Record school_id (school that was updated)
        $this->assertEquals($this->otherSchool->id, $activityLog->school_id);
        $this->assertEquals($this->otherSchool->id, $activityLog->subject_id);
        $this->assertEquals(School::class, $activityLog->subject_type);
        
        // Verify description includes school name
        $this->assertStringContainsString($this->otherSchool->nama, $activityLog->description);

        // Step 8: Verify returned data matches database
        $updatedSchool = $this->otherSchool->fresh();
        $this->assertEquals('Ahmad Dahlan', $updatedSchool->kepala_madrasah);
        $this->assertEquals('123456', $updatedSchool->kepala_nim);
        $this->assertEquals('1234567890123456', $updatedSchool->kepala_nuptk);
        $this->assertEquals('081234567890', $updatedSchool->kepala_whatsapp);
        $this->assertEquals('2020-01-01', $updatedSchool->kepala_jabatan_mulai);
        $this->assertEquals('2024-12-31', $updatedSchool->kepala_jabatan_selesai);

        // Verify other fields were not modified
        $this->assertEquals($initialSchoolData->nama, $updatedSchool->nama);
        $this->assertEquals($initialSchoolData->kecamatan, $updatedSchool->kecamatan);
    }

    /**
     * Test operator can update own school profile
     * Requirements: 4.1, 4.2, 4.3, 7.1, 7.2
     */
    public function test_operator_can_update_own_school_profile(): void
    {
        $initialActivityLogCount = ActivityLog::where('subject_id', $this->operatorSchool->id)->count();

        $updateData = [
            'kepala_madrasah' => 'Muhammad Ali',
            'kepala_nim' => '789012',
            'kepala_nuptk' => '9876543210987654',
            'kepala_whatsapp' => '089876543210',
            'kepala_jabatan_mulai' => '2022-01-01',
            'kepala_jabatan_selesai' => '2026-12-31',
        ];

        $response = $this->actingAs($this->operator)
            ->putJson("/api/schools/{$this->operatorSchool->id}", $updateData);

        $response->assertOk();

        // Verify database update
        $this->assertDatabaseHas('schools', [
            'id' => $this->operatorSchool->id,
            'kepala_madrasah' => 'Muhammad Ali',
            'kepala_nim' => '789012',
        ]);

        // Verify activity log was created
        $finalActivityLogCount = ActivityLog::where('subject_id', $this->operatorSchool->id)->count();
        $this->assertEquals($initialActivityLogCount + 1, $finalActivityLogCount);

        // Verify activity log records operator as causer
        $activityLog = ActivityLog::where('event', 'update_school')
            ->where('subject_id', $this->operatorSchool->id)
            ->latest()
            ->first();

        $this->assertNotNull($activityLog);
        $this->assertEquals($this->operator->id, $activityLog->causer_id);
        $this->assertEquals($this->operatorSchool->id, $activityLog->school_id);
    }

    /**
     * Test update flow with database transaction
     * Requirements: 7.1, 7.2
     * 
     * This test verifies that the update and activity log creation
     * are wrapped in a database transaction for atomicity
     */
    public function test_update_flow_with_database_transaction(): void
    {
        $updateData = [
            'kepala_madrasah' => 'Transaction Test',
            'kepala_nim' => '555555',
        ];

        // Count queries to verify transaction usage
        DB::enableQueryLog();

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $response->assertOk();

        // Verify both school and activity log were updated
        $this->assertDatabaseHas('schools', [
            'id' => $this->otherSchool->id,
            'kepala_madrasah' => 'Transaction Test',
            'kepala_nim' => '555555',
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'event' => 'update_school',
            'subject_id' => $this->otherSchool->id,
            'causer_id' => $this->superAdmin->id,
        ]);

        // Verify school data is consistent
        $school = School::find($this->otherSchool->id);
        $this->assertEquals('Transaction Test', $school->kepala_madrasah);
        $this->assertEquals('555555', $school->kepala_nim);

        // Verify activity log exists for this update
        $activityLog = ActivityLog::where('subject_id', $this->otherSchool->id)
            ->where('event', 'update_school')
            ->latest()
            ->first();
        
        $this->assertNotNull($activityLog);
    }

    /**
     * Test activity log creation on successful update
     * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
     */
    public function test_activity_log_creation_on_successful_update(): void
    {
        $updateData = [
            'kepala_madrasah' => 'Activity Log Test',
            'kepala_jabatan_mulai' => '2023-06-01',
        ];

        $response = $this->actingAs($this->adminYayasan)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertOk();

        // Verify activity log was created with all required fields
        $activityLog = ActivityLog::where('event', 'update_school')
            ->where('subject_id', $this->otherSchool->id)
            ->latest()
            ->first();

        $this->assertNotNull($activityLog, 'Activity log should be created');

        // Requirement 4.1: Activity log entry created
        $this->assertEquals('update_school', $activityLog->event);
        $this->assertEquals('school', $activityLog->log_name);

        // Requirement 4.2: Record causer_id (user who performed update)
        $this->assertEquals($this->adminYayasan->id, $activityLog->causer_id);
        $this->assertEquals(User::class, $activityLog->causer_type);

        // Requirement 4.3: Record school_id (school that was updated)
        $this->assertEquals($this->otherSchool->id, $activityLog->school_id);
        $this->assertEquals($this->otherSchool->id, $activityLog->subject_id);
        $this->assertEquals(School::class, $activityLog->subject_type);

        // Requirement 4.4: Record timestamp
        $this->assertNotNull($activityLog->created_at);
        $this->assertInstanceOf(\Illuminate\Support\Carbon::class, $activityLog->created_at);

        // Requirement 4.5: Include description with school name and action
        $this->assertStringContainsString($this->otherSchool->nama, $activityLog->description);
        $this->assertStringContainsString('Memperbarui', $activityLog->description);
    }

    /**
     * Test no activity log created on failed update
     * Requirements: 7.1, 7.2
     * 
     * When validation fails, no activity log should be created
     * and no database changes should occur (transaction rollback)
     */
    public function test_no_activity_log_created_on_failed_update(): void
    {
        $initialActivityLogCount = ActivityLog::count();
        $initialSchoolData = $this->otherSchool->fresh();

        // Send invalid data (end date before start date)
        $updateData = [
            'kepala_madrasah' => 'Should Not Update',
            'kepala_jabatan_mulai' => '2024-12-31',
            'kepala_jabatan_selesai' => '2020-01-01', // Invalid: before start date
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['kepala_jabatan_selesai']);

        // Verify no activity log was created
        $finalActivityLogCount = ActivityLog::count();
        $this->assertEquals($initialActivityLogCount, $finalActivityLogCount);

        // Verify school data was not modified
        $this->assertDatabaseHas('schools', [
            'id' => $this->otherSchool->id,
            'kepala_madrasah' => $initialSchoolData->kepala_madrasah,
        ]);

        $this->assertDatabaseMissing('schools', [
            'id' => $this->otherSchool->id,
            'kepala_madrasah' => 'Should Not Update',
        ]);

        // Verify no activity log for this failed update
        $activityLog = ActivityLog::where('subject_id', $this->otherSchool->id)
            ->where('description', 'LIKE', '%Should Not Update%')
            ->first();
        
        $this->assertNull($activityLog);
    }

    /**
     * Test admin yayasan can complete full workflow
     * Requirements: 4.1, 4.2, 4.3, 7.1, 7.2
     */
    public function test_admin_yayasan_can_complete_full_workflow(): void
    {
        $initialActivityLogCount = ActivityLog::where('subject_id', $this->otherSchool->id)->count();

        $updateData = [
            'kepala_madrasah' => 'Siti Aminah',
            'kepala_nim' => '654321',
            'kepala_nuptk' => '5555555555555555',
            'kepala_jabatan_mulai' => '2021-06-01',
            'kepala_jabatan_selesai' => '2025-05-31',
        ];

        $response = $this->actingAs($this->adminYayasan)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertOk();
        $response->assertJson(['success' => true]);

        // Verify database update
        $this->assertDatabaseHas('schools', [
            'id' => $this->otherSchool->id,
            'kepala_madrasah' => 'Siti Aminah',
            'kepala_nim' => '654321',
            'kepala_nuptk' => '5555555555555555',
        ]);

        // Verify activity log
        $finalActivityLogCount = ActivityLog::where('subject_id', $this->otherSchool->id)->count();
        $this->assertEquals($initialActivityLogCount + 1, $finalActivityLogCount);

        $activityLog = ActivityLog::where('event', 'update_school')
            ->where('subject_id', $this->otherSchool->id)
            ->latest()
            ->first();

        $this->assertEquals($this->adminYayasan->id, $activityLog->causer_id);
        $this->assertEquals($this->otherSchool->id, $activityLog->school_id);
    }

    /**
     * Test partial update preserves unchanged fields
     * Requirements: 7.5
     */
    public function test_partial_update_preserves_unchanged_fields(): void
    {
        // Set initial complete data
        $this->otherSchool->update([
            'kepala_madrasah' => 'Original Name',
            'kepala_nim' => '111111',
            'kepala_nuptk' => '1111111111111111',
            'kepala_whatsapp' => '081111111111',
            'kepala_jabatan_mulai' => '2020-01-01',
            'kepala_jabatan_selesai' => '2024-12-31',
        ]);

        // Update only one field
        $updateData = [
            'kepala_madrasah' => 'Updated Name Only',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertOk();

        // Verify only the specified field was updated
        $updatedSchool = $this->otherSchool->fresh();
        $this->assertEquals('Updated Name Only', $updatedSchool->kepala_madrasah);
        
        // Verify other fields were preserved
        $this->assertEquals('111111', $updatedSchool->kepala_nim);
        $this->assertEquals('1111111111111111', $updatedSchool->kepala_nuptk);
        $this->assertEquals('081111111111', $updatedSchool->kepala_whatsapp);
        $this->assertEquals('2020-01-01', $updatedSchool->kepala_jabatan_mulai);
        $this->assertEquals('2024-12-31', $updatedSchool->kepala_jabatan_selesai);
    }

    /**
     * Test multiple sequential updates create separate activity logs
     * Requirements: 4.1, 4.2, 4.3
     */
    public function test_multiple_sequential_updates_create_separate_logs(): void
    {
        $initialCount = ActivityLog::where('subject_id', $this->otherSchool->id)->count();

        // First update
        $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", [
                'kepala_madrasah' => 'First Update',
            ])
            ->assertOk();

        // Second update
        $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", [
                'kepala_madrasah' => 'Second Update',
            ])
            ->assertOk();

        // Third update
        $this->actingAs($this->adminYayasan)
            ->putJson("/api/schools/{$this->otherSchool->id}", [
                'kepala_madrasah' => 'Third Update',
            ])
            ->assertOk();

        // Verify three new activity logs were created
        $finalCount = ActivityLog::where('subject_id', $this->otherSchool->id)->count();
        $this->assertEquals($initialCount + 3, $finalCount);

        // Verify each log has correct causer
        $logs = ActivityLog::where('subject_id', $this->otherSchool->id)
            ->where('event', 'update_school')
            ->orderBy('id', 'desc')
            ->take(3)
            ->get();

        $this->assertEquals($this->adminYayasan->id, $logs[0]->causer_id);
        $this->assertEquals($this->superAdmin->id, $logs[1]->causer_id);
        $this->assertEquals($this->superAdmin->id, $logs[2]->causer_id);
    }

    /**
     * Test operator cannot update other school even with valid data
     * Requirements: 6.3, 6.5
     */
    public function test_operator_cannot_update_other_school_with_valid_data(): void
    {
        $initialActivityLogCount = ActivityLog::where('subject_id', $this->otherSchool->id)->count();
        $initialData = $this->otherSchool->fresh();

        $updateData = [
            'kepala_madrasah' => 'Unauthorized Update',
            'kepala_nim' => '999999',
            'kepala_jabatan_mulai' => '2023-01-01',
        ];

        $response = $this->actingAs($this->operator)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertStatus(403);

        // Verify no database changes
        $this->assertDatabaseHas('schools', [
            'id' => $this->otherSchool->id,
            'kepala_madrasah' => $initialData->kepala_madrasah,
        ]);

        $this->assertDatabaseMissing('schools', [
            'id' => $this->otherSchool->id,
            'kepala_madrasah' => 'Unauthorized Update',
        ]);

        // Verify no activity log was created
        $finalActivityLogCount = ActivityLog::where('subject_id', $this->otherSchool->id)->count();
        $this->assertEquals($initialActivityLogCount, $finalActivityLogCount);
    }
}
