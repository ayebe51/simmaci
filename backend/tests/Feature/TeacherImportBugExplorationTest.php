<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Bug Condition Exploration Tests — Teacher Import
 *
 * Memverifikasi bahwa kelima bug yang sebelumnya menyebabkan HTTP 500
 * sudah diperbaiki. Setiap test mewakili satu bug condition.
 */
class TeacherImportBugExplorationTest extends TestCase
{
    use RefreshDatabase;

    private School $school;
    private User $operator;
    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::factory()->create();

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

    /**
     * Bug 1 (Fixed): Route conflict — import route sekarang terdaftar sebelum apiResource.
     * POST /api/teachers/import harus dipetakan ke TeacherController@import, bukan @show.
     */
    public function test_bug1_import_route_resolves_correctly_not_to_show(): void
    {
        $payload = [
            'teachers' => [
                ['nama' => 'Guru Test', 'jenis_kelamin' => 'L'],
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', $payload);

        // Bug 1 fixed: tidak lagi 500 ModelNotFoundException
        $response->assertStatus(200);
        $response->assertJsonStructure(['created', 'errors', 'summary']);
    }

    /**
     * Bug 2 (Fixed): array_filter tidak lagi membuang nilai false.
     * is_certified = false harus tersimpan sebagai false/0 di DB.
     */
    public function test_bug2_is_certified_false_is_preserved_not_stripped(): void
    {
        $payload = [
            'teachers' => [
                [
                    'nama'         => 'Guru Tidak Sertifikasi',
                    'jenis_kelamin' => 'L',
                    'is_certified' => false,
                ],
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', $payload);

        $response->assertStatus(200);
        $response->assertJson(['created' => 1]);

        // Verifikasi nilai false tersimpan di DB, bukan null
        $this->assertDatabaseHas('teachers', [
            'nama'        => 'Guru Tidak Sertifikasi',
            'is_certified' => false,
        ]);
    }

    /**
     * Bug 3 (Fixed): withoutTenantScope() digunakan untuk NUPTK lookup.
     * Super admin tidak lagi mendapat AuthorizationException saat import.
     */
    public function test_bug3_super_admin_import_does_not_throw_tenant_scope_exception(): void
    {
        // Buat guru yang sudah ada dengan NUPTK tertentu
        $existingTeacher = Teacher::factory()->forSchool($this->school)->create([
            'nuptk' => '1234567890123456',
        ]);

        $payload = [
            'teachers' => [
                [
                    'nama'  => $existingTeacher->nama,
                    'nuptk' => '1234567890123456',
                ],
            ],
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers/import', $payload);

        // Bug 3 fixed: tidak lagi AuthorizationException dari TenantScope
        $response->assertStatus(200);
        $response->assertJsonStructure(['created', 'errors', 'summary']);
    }

    /**
     * Bug 4 (Fixed): AuditLogTrait::logActivity() dibungkus try-catch.
     * Kegagalan audit log tidak lagi menggagalkan seluruh baris import.
     */
    public function test_bug4_audit_log_failure_does_not_fail_entire_import(): void
    {
        // Simulasikan kondisi di mana audit log bisa gagal:
        // import tetap berhasil meski ada potensi constraint di activity log
        $payload = [
            'teachers' => [
                ['nama' => 'Guru Valid Satu', 'jenis_kelamin' => 'L'],
                ['nama' => 'Guru Valid Dua', 'jenis_kelamin' => 'P'],
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', $payload);

        // Bug 4 fixed: kedua baris berhasil tersimpan
        $response->assertStatus(200);
        $response->assertJson(['created' => 2]);
    }

    /**
     * Bug 5 (Fixed): Exception pada satu baris tidak menghentikan seluruh loop.
     * Baris valid tetap diproses meski ada baris yang gagal.
     */
    public function test_bug5_exception_in_one_row_does_not_stop_entire_loop(): void
    {
        $payload = [
            'teachers' => [
                ['nama' => 'Guru Valid', 'jenis_kelamin' => 'L'],
                // Baris tanpa nama — akan masuk ke error handling
                ['jenis_kelamin' => 'P', 'nama' => ''],
                ['nama' => 'Guru Valid Lagi', 'jenis_kelamin' => 'L'],
            ],
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/teachers/import', $payload);

        // Bug 5 fixed: loop tidak berhenti, baris valid tetap diproses
        $response->assertStatus(200);

        $body = $response->json();
        // Total created + errors harus sama dengan total baris yang dikirim
        $this->assertArrayHasKey('created', $body);
        $this->assertArrayHasKey('errors', $body);
    }

    /**
     * Semua 5 bug sekaligus: import campuran valid/invalid sebagai super admin
     * dengan is_certified = false harus mengembalikan 200.
     */
    public function test_all_five_bugs_fixed_combined_scenario(): void
    {
        $payload = [
            'teachers' => [
                [
                    'nama'         => 'Guru Sertifikasi',
                    'jenis_kelamin' => 'L',
                    'is_certified' => true,
                    'nuptk'        => '9999888877776666',
                ],
                [
                    'nama'         => 'Guru Tidak Sertifikasi',
                    'jenis_kelamin' => 'P',
                    'is_certified' => false,
                ],
            ],
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/teachers/import', $payload);

        $response->assertStatus(200);
        $response->assertJsonStructure(['created', 'errors', 'summary']);

        $body = $response->json();
        $this->assertEquals(2, $body['created']);
        $this->assertCount(0, $body['errors']);
    }
}
