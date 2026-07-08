<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Test authorization logic for SchoolController update method
 * Task 1.1: Update SchoolController with role-based authorization logic
 */
class SchoolUpdateAuthorizationTest extends TestCase
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
            'kecamatan' => 'Test Kecamatan',
        ]);

        $this->otherSchool = School::factory()->create([
            'nama' => 'MI Test Other School',
            'kecamatan' => 'Other Kecamatan',
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
     * Test super_admin can update any school headmaster profile
     * Requirements: 1.4, 6.2
     */
    public function test_super_admin_can_update_any_school(): void
    {
        $updateData = [
            'kepala_madrasah' => 'Ahmad Dahlan',
            'kepala_nim' => '123456',
            'kepala_nuptk' => '1234567890123456',
            'kepala_whatsapp' => '081234567890',
            'kepala_jabatan_mulai' => '2020-01-01',
            'kepala_jabatan_selesai' => '2024-12-31',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertOk();
        
        $this->assertDatabaseHas('schools', [
            'id' => $this->otherSchool->id,
            'kepala_madrasah' => 'Ahmad Dahlan',
            'kepala_nim' => '123456',
            'kepala_nuptk' => '1234567890123456',
        ]);
    }

    /**
     * Test admin_yayasan can update any school headmaster profile
     * Requirements: 1.4, 6.2
     */
    public function test_admin_yayasan_cannot_update_school(): void
    {
        $updateData = [
            'kepala_madrasah' => 'Siti Aminah',
            'kepala_nim' => '654321',
            'kepala_jabatan_mulai' => '2021-06-01',
        ];

        $response = $this->actingAs($this->adminYayasan)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertForbidden();
        
        $this->assertDatabaseMissing('schools', [
            'id' => $this->otherSchool->id,
            'kepala_madrasah' => 'Siti Aminah',
        ]);
    }

    /**
     * Test operator can only update own school headmaster profile
     * Requirements: 1.4, 6.3
     */
    public function test_operator_can_update_own_school(): void
    {
        $updateData = [
            'kepala_madrasah' => 'Muhammad Ali',
            'kepala_nim' => '789012',
            'kepala_jabatan_mulai' => '2022-01-01',
        ];

        $response = $this->actingAs($this->operator)
            ->putJson("/api/schools/{$this->operatorSchool->id}", $updateData);

        $response->assertOk();
        
        $this->assertDatabaseHas('schools', [
            'id' => $this->operatorSchool->id,
            'kepala_madrasah' => 'Muhammad Ali',
            'kepala_nim' => '789012',
        ]);
    }

    /**
     * Test operator cannot update other school headmaster profile
     * Requirements: 1.4, 6.3, 6.5
     */
    public function test_operator_cannot_update_other_school(): void
    {
        $updateData = [
            'kepala_madrasah' => 'Unauthorized Update',
            'kepala_nim' => '999999',
        ];

        $response = $this->actingAs($this->operator)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertStatus(403);
        $response->assertJson([
            'success' => false,
            'message' => 'Anda tidak memiliki akses untuk mengubah data sekolah ini',
        ]);
        
        // Verify data was not updated
        $this->assertDatabaseMissing('schools', [
            'id' => $this->otherSchool->id,
            'kepala_madrasah' => 'Unauthorized Update',
        ]);
    }

    /**
     * Test validation for kepala_jabatan_selesai must be after or equal to kepala_jabatan_mulai
     * Requirements: 3.5, 6.6
     */
    public function test_validates_end_date_after_start_date(): void
    {
        $updateData = [
            'kepala_jabatan_mulai' => '2024-12-31',
            'kepala_jabatan_selesai' => '2020-01-01', // Invalid: before start date
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['kepala_jabatan_selesai']);
    }

    /**
     * Test activity log is created on successful update
     * Requirements: 4.1, 4.2, 4.3, 4.4
     */
    public function test_creates_activity_log_on_successful_update(): void
    {
        $updateData = [
            'kepala_madrasah' => 'Test Activity Log',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertOk();
        
        $this->assertDatabaseHas('activity_logs', [
            'event' => 'update_school',
            'log_name' => 'school',
            'subject_id' => $this->otherSchool->id,
            'subject_type' => School::class,
            'causer_id' => $this->superAdmin->id,
            'causer_type' => User::class,
            'school_id' => $this->otherSchool->id,
        ]);
    }

    /**
     * Test validation rules for headmaster profile fields
     * Requirements: 3.1, 6.6
     */
    public function test_validates_headmaster_profile_fields(): void
    {
        // Test max length for kepala_madrasah (255)
        $updateData = [
            'kepala_madrasah' => str_repeat('a', 256),
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['kepala_madrasah']);

        // Test max length for kepala_nim (50)
        $updateData = [
            'kepala_nim' => str_repeat('1', 51),
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['kepala_nim']);

        // Test max length for kepala_nuptk (50)
        $updateData = [
            'kepala_nuptk' => str_repeat('1', 51),
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['kepala_nuptk']);

        // Test max length for kepala_whatsapp (20)
        $updateData = [
            'kepala_whatsapp' => str_repeat('1', 21),
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['kepala_whatsapp']);
    }

    /**
     * Test date format validation for tenure dates
     * Requirements: 3.3, 3.4
     */
    public function test_validates_date_format_for_tenure_dates(): void
    {
        $updateData = [
            'kepala_jabatan_mulai' => 'invalid-date',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['kepala_jabatan_mulai']);

        $updateData = [
            'kepala_jabatan_selesai' => 'not-a-date',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['kepala_jabatan_selesai']);
    }

    /**
     * Test null values are accepted for optional fields
     * Requirements: 3.1
     */
    public function test_accepts_null_values_for_optional_fields(): void
    {
        $updateData = [
            'kepala_madrasah' => null,
            'kepala_nim' => null,
            'kepala_nuptk' => null,
            'kepala_whatsapp' => null,
            'kepala_jabatan_mulai' => null,
            'kepala_jabatan_selesai' => null,
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertOk();
    }

    /**
     * Test updated data is returned in response
     * Requirements: 6.4
     */
    public function test_returns_updated_school_data(): void
    {
        $updateData = [
            'kepala_madrasah' => 'Updated Name',
            'kepala_nim' => '111222',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/schools/{$this->otherSchool->id}", $updateData);

        $response->assertOk();
        $response->assertJsonFragment([
            'kepala_madrasah' => 'Updated Name',
            'kepala_nim' => '111222',
        ]);
    }
}
