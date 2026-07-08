<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Test: Operator can edit teacher data without 422 validation errors
 * 
 * Bug: UniqueForTenant rule was treating admin_yayasan as operator,
 * causing validation failures when they tried to edit teachers.
 * 
 * Fix: Updated UniqueForTenant to treat both super_admin and admin_yayasan
 * as having global access (no tenant scoping).
 */
class TeacherUpdateOperatorTest extends TestCase
{
    use RefreshDatabase;

    private User $operator;
    private User $adminYayasan;
    private User $superAdmin;
    private School $school;
    private Teacher $teacher;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create(['nama' => 'MI Test School']);

        $this->operator = User::factory()->create([
            'role' => 'operator',
            'school_id' => $this->school->id,
            'email' => 'operator@test.com',
            'is_active' => true,
        ]);

        $this->adminYayasan = User::factory()->create([
            'role' => 'admin_yayasan',
            'school_id' => null,
            'email' => 'admin_yayasan@test.com',
            'is_active' => true,
        ]);

        $this->superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'school_id' => null,
            'email' => 'super_admin@test.com',
            'is_active' => true,
        ]);

        $this->teacher = Teacher::factory()->create([
            'school_id' => $this->school->id,
            'nama' => 'AHMAD RIFAI, S.Pd.',
            'nuptk' => '1234567890123456',
            'nomor_induk_maarif' => '113401234',
        ]);
    }

    /**
     * Test: Operator can update teacher without changing unique fields
     */
    public function test_operator_can_update_teacher_basic_fields(): void
    {
        $response = $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}", [
                'nama' => 'AHMAD RIFAI UPDATED, S.Pd.',
                'phone_number' => '081234567890',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.nama', 'AHMAD RIFAI UPDATED, S.Pd.');
    }

    /**
     * Test: Operator can update teacher keeping same NUPTK (should not trigger uniqueness error)
     */
    public function test_operator_can_update_teacher_keeping_same_nuptk(): void
    {
        $response = $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}", [
                'nama' => 'AHMAD RIFAI, S.Pd.',
                'nuptk' => '1234567890123456', // Same NUPTK
                'phone_number' => '081234567890',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    /**
     * Test: Operator can update teacher keeping same NIM (should not trigger uniqueness error)
     */
    public function test_operator_can_update_teacher_keeping_same_nim(): void
    {
        $response = $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}", [
                'nama' => 'AHMAD RIFAI, S.Pd.',
                'nomor_induk_maarif' => '113401234', // Same NIM
                'phone_number' => '081234567890',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    /**
     * Test: Admin Yayasan can update teacher without 422 error
     * 
     * This was the main bug - admin_yayasan was being treated as operator
     * and getting validation errors due to incorrect tenant scoping.
     */
    public function test_admin_yayasan_cannot_update_teacher(): void
    {
        $response = $this->actingAs($this->adminYayasan)
            ->patchJson("/api/teachers/{$this->teacher->id}", [
                'nama' => 'AHMAD RIFAI YAYASAN, S.Pd.',
                'phone_number' => '081234567890',
            ]);

        $response->assertStatus(403);
    }


    /**
     * Test: Super Admin can update teacher
     */
    public function test_super_admin_can_update_teacher(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->patchJson("/api/teachers/{$this->teacher->id}", [
                'nama' => 'AHMAD RIFAI SUPER, S.Pd.',
                'phone_number' => '081234567890',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.nama', 'AHMAD RIFAI SUPER, S.Pd.');
    }

    /**
     * Test: Operator cannot use duplicate NUPTK from another teacher in same school
     */
    public function test_operator_cannot_use_duplicate_nuptk_same_school(): void
    {
        $otherTeacher = Teacher::factory()->create([
            'school_id' => $this->school->id,
            'nuptk' => '9999999999999999',
        ]);

        $response = $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}", [
                'nuptk' => '9999999999999999', // Duplicate
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['nuptk']);
    }

    /**
     * Test: Admin Yayasan cannot use duplicate NUPTK (global uniqueness)
     */
    public function test_admin_yayasan_cannot_use_duplicate_nuptk(): void
    {
        $otherSchool = School::factory()->create(['nama' => 'MI Other School']);
        $otherTeacher = Teacher::factory()->create([
            'school_id' => $otherSchool->id,
            'nuptk' => '9999999999999999',
        ]);

        $response = $this->actingAs($this->adminYayasan)
            ->patchJson("/api/teachers/{$this->teacher->id}", [
                'nuptk' => '9999999999999999', // Duplicate across schools
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['nuptk']);
    }
}
