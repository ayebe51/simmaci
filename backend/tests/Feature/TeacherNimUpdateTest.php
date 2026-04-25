<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Feature: nim-generator-sk
 * Tests for PATCH /api/teachers/{id}/nim (updateNim endpoint)
 *
 * Property 3: Global uniqueness — no two teachers may share the same NIM
 * Property 5: Format validation — non-numeric NIM rejected
 */
class TeacherNimUpdateTest extends TestCase
{
    use RefreshDatabase;

    private User $operator;
    private School $school;
    private Teacher $teacher;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create(['nama' => 'MI Nurul Huda']);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);

        $this->teacher = Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'Ahmad Fauzi',
            'nomor_induk_maarif' => null,
        ]);
    }

    // ── Authentication ────────────────────────────────────────────────────────

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->patchJson("/api/teachers/{$this->teacher->id}/nim", [
            'nim' => '113400140',
        ]);

        $response->assertUnauthorized();
    }

    // ── Success ───────────────────────────────────────────────────────────────

    /**
     * Valid numeric NIM is saved and returns 200 with updated teacher data.
     */
    public function test_valid_nim_is_saved_successfully(): void
    {
        $response = $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}/nim", [
                'nim' => '113400140',
            ]);

        $response->assertOk()
            ->assertJsonStructure(['success', 'message', 'data' => ['id', 'nama', 'nomor_induk_maarif']])
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'NIM berhasil disimpan.')
            ->assertJsonPath('data.id', $this->teacher->id)
            ->assertJsonPath('data.nama', 'Ahmad Fauzi')
            ->assertJsonPath('data.nomor_induk_maarif', '113400140');

        $this->assertDatabaseHas('teachers', [
            'id'                 => $this->teacher->id,
            'nomor_induk_maarif' => '113400140',
        ]);
    }

    /**
     * Saving NIM creates an ActivityLog entry with old_nim and new_nim.
     */
    public function test_activity_log_is_created_on_success(): void
    {
        $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}/nim", [
                'nim' => '113400140',
            ]);

        $this->assertDatabaseHas('activity_logs', [
            'event'        => 'update_nim',
            'subject_id'   => $this->teacher->id,
            'subject_type' => Teacher::class,
            'causer_id'    => $this->operator->id,
        ]);

        $log = ActivityLog::where('event', 'update_nim')
            ->where('subject_id', $this->teacher->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertNull($log->properties['old_nim']);
        $this->assertSame('113400140', $log->properties['new_nim']);
    }

    /**
     * When teacher already has a NIM, old_nim is recorded in the activity log.
     */
    public function test_activity_log_records_old_nim_when_updating_existing_nim(): void
    {
        $this->teacher->update(['nomor_induk_maarif' => '113400001']);

        $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}/nim", [
                'nim' => '113400999',
            ]);

        $log = ActivityLog::where('event', 'update_nim')
            ->where('subject_id', $this->teacher->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertSame('113400001', $log->properties['old_nim']);
        $this->assertSame('113400999', $log->properties['new_nim']);
    }

    // ── Duplicate NIM (same tenant) ───────────────────────────────────────────

    /**
     * Property 3 — duplicate NIM within the same tenant returns 422.
     */
    public function test_duplicate_nim_same_tenant_returns_422(): void
    {
        // Another teacher in the same school already has this NIM
        Teacher::factory()->forSchool($this->school)->create([
            'nama'               => 'Budi Santoso',
            'nomor_induk_maarif' => '113400140',
        ]);

        $response = $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}/nim", [
                'nim' => '113400140',
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'NIM sudah digunakan oleh guru lain.')
            ->assertJsonStructure(['errors' => ['nim']]);

        // NIM must not have been saved
        $this->assertDatabaseMissing('teachers', [
            'id'                 => $this->teacher->id,
            'nomor_induk_maarif' => '113400140',
        ]);
    }

    // ── Duplicate NIM (cross-tenant) ──────────────────────────────────────────

    /**
     * Property 3 — duplicate NIM across different tenants returns 422 (global uniqueness).
     */
    public function test_duplicate_nim_cross_tenant_returns_422(): void
    {
        $otherSchool = School::factory()->create(['nama' => 'MI Al-Ikhlas']);

        // Teacher in a DIFFERENT school already has this NIM
        Teacher::factory()->forSchool($otherSchool)->create([
            'nama'               => 'Siti Rahayu',
            'nomor_induk_maarif' => '113400140',
        ]);

        $response = $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}/nim", [
                'nim' => '113400140',
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'NIM sudah digunakan oleh guru lain.')
            ->assertJsonStructure(['errors' => ['nim']]);

        // Error message must mention the duplicate teacher's name and school
        $errors = $response->json('errors.nim');
        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('Siti Rahayu', $errors[0]);
        $this->assertStringContainsString('MI Al-Ikhlas', $errors[0]);
    }

    /**
     * A teacher can save the same NIM they already have (idempotent update).
     */
    public function test_teacher_can_save_their_own_existing_nim(): void
    {
        $this->teacher->update(['nomor_induk_maarif' => '113400140']);

        $response = $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}/nim", [
                'nim' => '113400140',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.nomor_induk_maarif', '113400140');
    }

    // ── Invalid Format ────────────────────────────────────────────────────────

    /**
     * Property 5 — non-numeric NIM returns 422.
     *
     * @dataProvider invalidNimFormatProvider
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('invalidNimFormatProvider')]
    public function test_non_numeric_nim_returns_422(string $invalidNim): void
    {
        $response = $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}/nim", [
                'nim' => $invalidNim,
            ]);

        $response->assertStatus(422)
            ->assertJsonStructure(['errors' => ['nim']]);
    }

    public static function invalidNimFormatProvider(): array
    {
        return [
            'letters only'          => ['abc'],
            'mixed alphanumeric'    => ['12a3'],
            'decimal'               => ['12.3'],
            'space in middle'       => ['12 3'],
            'hyphen'                => ['12-3'],
            'hex notation'          => ['0x1F'],
            'plus sign'             => ['+123'],
            'special chars'         => ['#123'],
        ];
    }

    /**
     * Empty NIM returns 422.
     */
    public function test_empty_nim_returns_422(): void
    {
        $response = $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}/nim", [
                'nim' => '',
            ]);

        $response->assertStatus(422)
            ->assertJsonStructure(['errors' => ['nim']]);
    }

    /**
     * Missing nim field returns 422.
     */
    public function test_missing_nim_field_returns_422(): void
    {
        $response = $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}/nim", []);

        $response->assertStatus(422)
            ->assertJsonStructure(['errors' => ['nim']]);
    }

    // ── Authorization ─────────────────────────────────────────────────────────

    /**
     * Operator from a different school gets 404 because HasTenantScope makes the teacher
     * invisible to operators outside their school (route model binding returns 404).
     * This is the correct security behavior — the teacher is not accessible to them.
     */
    public function test_operator_from_different_school_gets_404(): void
    {
        $otherSchool = School::factory()->create(['nama' => 'MI Lain']);
        $otherOperator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $otherSchool->id,
            'is_active' => true,
        ]);

        $response = $this->actingAs($otherOperator)
            ->patchJson("/api/teachers/{$this->teacher->id}/nim", [
                'nim' => '113400140',
            ]);

        // HasTenantScope makes the teacher invisible to operators from other schools,
        // so route model binding returns 404 before the policy check runs.
        $response->assertNotFound();
    }

    /**
     * Super admin can update NIM for any teacher regardless of school.
     */
    public function test_super_admin_can_update_nim_for_any_teacher(): void
    {
        $superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'is_active' => true,
        ]);

        $response = $this->actingAs($superAdmin)
            ->patchJson("/api/teachers/{$this->teacher->id}/nim", [
                'nim' => '113400140',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.nomor_induk_maarif', '113400140');
    }

    /**
     * Returns 404 when teacher does not exist.
     */
    public function test_returns_404_for_nonexistent_teacher(): void
    {
        $response = $this->actingAs($this->operator)
            ->patchJson('/api/teachers/99999/nim', [
                'nim' => '113400140',
            ]);

        $response->assertNotFound();
    }

    // ── Response Structure ────────────────────────────────────────────────────

    /**
     * Success response follows the standard ApiResponse shape.
     */
    public function test_success_response_has_correct_structure(): void
    {
        $response = $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}/nim", [
                'nim' => '113400140',
            ]);

        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'id',
                    'nama',
                    'nomor_induk_maarif',
                ],
            ])
            ->assertJsonPath('success', true);
    }

    /**
     * Duplicate error response follows the standard ApiResponse shape.
     */
    public function test_duplicate_error_response_has_correct_structure(): void
    {
        Teacher::factory()->forSchool($this->school)->create([
            'nomor_induk_maarif' => '113400140',
        ]);

        $response = $this->actingAs($this->operator)
            ->patchJson("/api/teachers/{$this->teacher->id}/nim", [
                'nim' => '113400140',
            ]);

        $response->assertStatus(422)
            ->assertJsonStructure([
                'success',
                'message',
                'errors' => ['nim'],
            ])
            ->assertJsonPath('success', false);
    }
}
