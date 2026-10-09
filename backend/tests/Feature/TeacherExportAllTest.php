<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeacherExportAllTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $operator;
    private School $school1;
    private School $school2;

    public function setUp(): void
    {
        parent::setUp();

        $this->school1 = School::factory()->create(['nama' => 'MI Maarif 01 Test']);
        $this->school2 = School::factory()->create(['nama' => 'MI Maarif 02 Test']);

        $this->superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'school_id' => null,
            'is_active' => true,
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $this->school1->id,
            'is_active' => true,
        ]);
    }

    /**
     * Test regular pagination requests are clamped to 100 max per page.
     */
    public function test_regular_pagination_is_clamped_to_100(): void
    {
        Teacher::factory()->count(120)->create([
            'school_id' => $this->school1->id,
        ]);

        $response = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/teachers?per_page=120');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertCount(100, $data, 'Regular pagination must remain clamped to max 100');
        $this->assertEquals(120, $response->json('total'));
    }

    /**
     * Test all=true returns all records unpaginated for export.
     */
    public function test_all_flag_returns_all_teachers_unpaginated(): void
    {
        Teacher::factory()->count(135)->create([
            'school_id' => $this->school1->id,
        ]);

        $response = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/teachers?all=true');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertCount(135, $data, 'all=true must return all teachers without 100 clamp');
        $this->assertEquals(135, $response->json('total'));
    }

    /**
     * Test export=true also returns all records unpaginated.
     */
    public function test_export_flag_returns_all_teachers_unpaginated(): void
    {
        Teacher::factory()->count(110)->create([
            'school_id' => $this->school1->id,
        ]);

        $response = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/teachers?export=true');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertCount(110, $data, 'export=true must return all teachers');
    }

    /**
     * Test tenant isolation is preserved even when operator uses all=true.
     */
    public function test_tenant_isolation_is_enforced_when_operator_requests_all(): void
    {
        Teacher::factory()->count(10)->create([
            'school_id' => $this->school1->id,
        ]);

        Teacher::factory()->count(25)->create([
            'school_id' => $this->school2->id,
        ]);

        $response = $this->actingAs($this->operator, 'sanctum')
            ->getJson('/api/teachers?all=true');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertCount(10, $data, 'Operator must only see teachers from their own school');
        foreach ($data as $t) {
            $this->assertEquals($this->school1->id, $t['school_id']);
        }
    }
}
