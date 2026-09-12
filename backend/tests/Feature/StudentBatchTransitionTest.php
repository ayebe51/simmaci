<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudentBatchTransitionTest extends TestCase
{
    use RefreshDatabase;

    protected School $school;
    protected User $operator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school = School::create([
            'nama'       => 'MTs Ma\'arif NU 01 Cilacap',
            'npsn'       => '20360001',
            'nsm'        => '121233010001',
            'jenjang'    => 'MTs',
            'kecamatan'  => 'Cilacap Tengah',
            'status'     => 'Swasta',
            'akreditasi' => 'A',
        ]);

        $this->operator = User::create([
            'name'      => 'Operator MTs 01',
            'email'     => 'operator@mts01.sch.id',
            'password'  => bcrypt('password123'),
            'role'      => 'operator',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);
    }

    public function test_it_returns_distinct_classes_for_school(): void
    {
        Sanctum::actingAs($this->operator);

        Student::create([
            'nama' => 'Siswa 1',
            'school_id' => $this->school->id,
            'kelas' => '7A',
            'status' => 'Aktif',
        ]);
        Student::create([
            'nama' => 'Siswa 2',
            'school_id' => $this->school->id,
            'kelas' => '7A',
            'status' => 'Aktif',
        ]);
        Student::create([
            'nama' => 'Siswa 3',
            'school_id' => $this->school->id,
            'kelas' => '8B',
            'status' => 'Aktif',
        ]);
        Student::create([
            'nama' => 'Siswa 4',
            'school_id' => $this->school->id,
            'kelas' => '9C',
            'status' => 'Aktif',
        ]);

        $response = $this->getJson('/api/students/classes');

        $response->assertOk();
        $this->assertEquals(['7A', '8B', '9C'], $response->json());
    }

    public function test_it_only_graduates_final_grade_students_and_skips_lower_grades(): void
    {
        Sanctum::actingAs($this->operator);

        $s7 = Student::create([
            'nama' => 'Siswa Kelas 7',
            'school_id' => $this->school->id,
            'kelas' => '7A',
            'status' => 'Aktif',
        ]);
        $s8 = Student::create([
            'nama' => 'Siswa Kelas 8',
            'school_id' => $this->school->id,
            'kelas' => 'VIII-B',
            'status' => 'Aktif',
        ]);
        $s9a = Student::create([
            'nama' => 'Siswa Kelas 9 Angka',
            'school_id' => $this->school->id,
            'kelas' => '9A',
            'status' => 'Aktif',
        ]);
        $s9r = Student::create([
            'nama' => 'Siswa Kelas 9 Romawi',
            'school_id' => $this->school->id,
            'kelas' => 'IX-C',
            'status' => 'Aktif',
        ]);

        // Operator erroneously selected all students from grades 7 to 9
        $response = $this->postJson('/api/students/batch-transition', [
            'action' => 'graduate',
            'student_ids' => [$s7->id, $s8->id, $s9a->id, $s9r->id],
        ]);

        $response->assertOk();
        $response->assertJson([
            'count' => 2,
            'skipped' => 2,
        ]);

        // Grade 9 students must be Lulus and soft deleted
        $this->assertSoftDeleted('students', ['id' => $s9a->id, 'status' => 'Lulus']);
        $this->assertSoftDeleted('students', ['id' => $s9r->id, 'status' => 'Lulus']);

        // Grade 7 & 8 students must REMAIN Aktif and NOT soft deleted
        $this->assertDatabaseHas('students', ['id' => $s7->id, 'status' => 'Aktif', 'deleted_at' => null]);
        $this->assertDatabaseHas('students', ['id' => $s8->id, 'status' => 'Aktif', 'deleted_at' => null]);
    }

    public function test_it_rejects_graduation_if_no_final_grade_students_are_selected(): void
    {
        Sanctum::actingAs($this->operator);

        $s7 = Student::create([
            'nama' => 'Siswa Kelas 7',
            'school_id' => $this->school->id,
            'kelas' => '7A',
            'status' => 'Aktif',
        ]);

        $response = $this->postJson('/api/students/batch-transition', [
            'action' => 'graduate',
            'student_ids' => [$s7->id],
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'success' => false,
            'count' => 0,
            'skipped' => 1,
        ]);

        $this->assertDatabaseHas('students', ['id' => $s7->id, 'status' => 'Aktif', 'deleted_at' => null]);
    }

    public function test_it_only_graduates_final_grade_when_no_student_ids_specified(): void
    {
        Sanctum::actingAs($this->operator);

        $s7 = Student::create([
            'nama' => 'Siswa Kelas 7',
            'school_id' => $this->school->id,
            'kelas' => '7A',
            'status' => 'Aktif',
        ]);
        $s9 = Student::create([
            'nama' => 'Siswa Kelas 9',
            'school_id' => $this->school->id,
            'kelas' => '9A',
            'status' => 'Aktif',
        ]);

        $response = $this->postJson('/api/students/batch-transition', [
            'action' => 'graduate',
        ]);

        $response->assertOk();
        $response->assertJson([
            'count' => 1,
            'skipped' => 1,
        ]);

        $this->assertSoftDeleted('students', ['id' => $s9->id, 'status' => 'Lulus']);
        $this->assertDatabaseHas('students', ['id' => $s7->id, 'status' => 'Aktif', 'deleted_at' => null]);
    }

    public function test_it_promotes_classes_normally(): void
    {
        Sanctum::actingAs($this->operator);

        $s7 = Student::create([
            'nama' => 'Siswa Kelas 7',
            'school_id' => $this->school->id,
            'kelas' => '7A',
            'status' => 'Aktif',
        ]);
        $s8 = Student::create([
            'nama' => 'Siswa Kelas 8',
            'school_id' => $this->school->id,
            'kelas' => 'VIII-B',
            'status' => 'Aktif',
        ]);
        $s9 = Student::create([
            'nama' => 'Siswa Kelas 9',
            'school_id' => $this->school->id,
            'kelas' => '9C',
            'status' => 'Aktif',
        ]);

        $response = $this->postJson('/api/students/batch-transition', [
            'action' => 'promote',
            'student_ids' => [$s7->id, $s8->id, $s9->id],
        ]);

        $response->assertOk();
        $response->assertJson(['count' => 3]);

        $this->assertDatabaseHas('students', ['id' => $s7->id, 'kelas' => '8A', 'status' => 'Aktif']);
        $this->assertDatabaseHas('students', ['id' => $s8->id, 'kelas' => 'IX-B', 'status' => 'Aktif']);
        $this->assertSoftDeleted('students', ['id' => $s9->id, 'status' => 'Lulus']);
    }
}
