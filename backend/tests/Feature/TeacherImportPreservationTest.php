<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Preservation Property Tests — Teacher Import
 *
 * Memverifikasi bahwa fix untuk teacher import tidak merusak perilaku
 * endpoint lain yang sudah berjalan dengan benar sebelumnya.
 */
class TeacherImportPreservationTest extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private School $otherSchool;
    private User $operator;
    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school      = School::factory()->create();
        $this->otherSchool = School::factory()->create();

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);

        $this->superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'school_id' => null,
            'is_active' => true,
        ]);
    }

    // ── Preservation: GET /api/teachers ──────────────────────────────────────

    /**
     * Operator hanya melihat guru dari sekolahnya sendiri (tenant scope aktif).
     */
    public function test_operator_get_teachers_only_sees_own_school(): void
    {
        Teacher::factory()->forSchool($this->school)->count(3)->create();
        Teacher::factory()->forSchool($this->otherSchool)->count(2)->create();

        $response = $this->actingAs($this->operator)
            ->getJson('/api/teachers');

        $response->assertStatus(200);

        $data = $response->json('data');
        foreach ($data as $teacher) {
            $this->assertEquals($this->school->id, $teacher['school_id'],
                'Operator seharusnya hanya melihat guru dari sekolahnya sendiri');
        }
    }

    /**
     * Super admin melihat semua guru dari semua sekolah.
     */
    public function test_super_admin_get_teachers_sees_all_schools(): void
    {
        Teacher::factory()->forSchool($this->school)->count(2)->create();
        Teacher::factory()->forSchool($this->otherSchool)->count(2)->create();

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/teachers');

        $response->assertStatus(200);

        $total = $response->json('total');
        $this->assertGreaterThanOrEqual(4, $total,
            'Super admin seharusnya melihat semua guru dari semua sekolah');
    }

    // ── Preservation: POST /api/teachers (store manual) ──────────────────────

    /**
     * Store manual guru tetap berfungsi dan menyimpan data dengan benar.
     */
    public function test_manual_store_teacher_still_works_after_fix(): void
    {
        $payload = [
            'nama'         => 'Guru Manual Test',
            'jenis_kelamin' => 'L',
            'status'       => 'GTY',
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers', $payload);

        $response->assertStatus(201);

        $this->assertDatabaseHas('teachers', [
            'nama'      => 'Guru Manual Test',
            'school_id' => $this->school->id,
        ]);
    }

    // ── Preservation: Import — Upsert NUPTK ──────────────────────────────────

    /**
     * Import dengan NUPTK yang sudah ada melakukan update (upsert), bukan insert duplikat.
     */
    public function test_import_with_duplicate_nuptk_does_upsert_not_duplicate(): void
    {
        $existing = Teacher::factory()->forSchool($this->school)->create([
            'nuptk' => '1111222233334444',
            'nama'  => 'Nama Lama',
        ]);

        $payload = [
            'teachers' => [
                [
                    'nuptk' => '1111222233334444',
                    'nama'  => 'Nama Baru',
                ],
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', $payload);

        $response->assertStatus(200);

        // Tidak ada duplikat
        $count = Teacher::where('nuptk', '1111222233334444')->count();
        $this->assertEquals(1, $count, 'Seharusnya tidak ada duplikat guru dengan NUPTK yang sama');

        // Nama diupdate
        $this->assertDatabaseHas('teachers', [
            'nuptk' => '1111222233334444',
            'nama'  => 'Nama Baru',
        ]);
    }

    // ── Preservation: Import — Operator auto-fill school_id ──────────────────

    /**
     * Operator import: setiap baris otomatis mendapat school_id dari operator.
     */
    public function test_operator_import_auto_fills_school_id(): void
    {
        $payload = [
            'teachers' => [
                ['nama' => 'Guru Import Satu', 'jenis_kelamin' => 'L'],
                ['nama' => 'Guru Import Dua', 'jenis_kelamin' => 'P'],
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', $payload);

        $response->assertStatus(200);
        $response->assertJson(['created' => 2]);

        // Semua baris harus punya school_id dari operator
        $this->assertDatabaseHas('teachers', [
            'nama'      => 'Guru Import Satu',
            'school_id' => $this->school->id,
        ]);
        $this->assertDatabaseHas('teachers', [
            'nama'      => 'Guru Import Dua',
            'school_id' => $this->school->id,
        ]);
    }

    // ── Preservation: Import — Partial success ────────────────────────────────

    /**
     * Import campuran valid/invalid: created + errors.length == total_rows.
     */
    public function test_import_partial_success_created_plus_errors_equals_total_rows(): void
    {
        $payload = [
            'teachers' => [
                ['nama' => 'Guru Valid Satu', 'jenis_kelamin' => 'L'],
                ['nama' => 'Guru Valid Dua', 'jenis_kelamin' => 'P'],
                ['nama' => 'Guru Valid Tiga', 'jenis_kelamin' => 'L'],
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', $payload);

        $response->assertStatus(200);

        $body = $response->json();
        $totalRows = count($payload['teachers']);
        $this->assertEquals(
            $totalRows,
            $body['created'] + count($body['errors']),
            'created + errors harus sama dengan total baris yang dikirim'
        );
    }

    // ── Preservation: Response structure ─────────────────────────────────────

    /**
     * Response import selalu memiliki struktur { created, errors, summary }.
     */
    public function test_import_response_always_has_correct_structure(): void
    {
        $payload = [
            'teachers' => [
                ['nama' => 'Guru Test', 'jenis_kelamin' => 'L'],
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', $payload);

        $response->assertStatus(200);
        $response->assertJsonStructure(['created', 'errors', 'summary']);
        $this->assertIsInt($response->json('created'));
        $this->assertIsArray($response->json('errors'));
        $this->assertIsString($response->json('summary'));
    }
}
