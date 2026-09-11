<?php

namespace Tests\Feature;

use App\Models\Competition;
use App\Models\Event;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Setting;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\TeacherMutation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityAuthorizationRemediationTest extends TestCase
{
    use RefreshDatabase;

    private School $school1;
    private School $school2;
    private User $superAdmin;
    private User $operatorSchool1;
    private User $operatorSchool2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->school1 = School::create([
            'nama' => 'MI Ma\'arif 01 Cilacap',
            'npsn' => '11111111',
            'jenjang' => 'mi',
            'status' => 'swasta',
        ]);

        $this->school2 = School::create([
            'nama' => 'MTs Ma\'arif 02 Cilacap',
            'npsn' => '22222222',
            'jenjang' => 'mts',
            'status' => 'swasta',
        ]);

        $this->superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@simmaci.com',
            'password' => bcrypt('password'),
            'role' => 'super_admin',
            'is_active' => true,
        ]);

        $this->operatorSchool1 = User::create([
            'name' => 'Operator School 1',
            'email' => 'operator1@simmaci.com',
            'password' => bcrypt('password'),
            'role' => 'operator',
            'school_id' => $this->school1->id,
            'is_active' => true,
        ]);

        $this->operatorSchool2 = User::create([
            'name' => 'Operator School 2',
            'email' => 'operator2@simmaci.com',
            'password' => bcrypt('password'),
            'role' => 'operator',
            'school_id' => $this->school2->id,
            'is_active' => true,
        ]);
    }

    // ── FINDING-001: Teacher Mutation Tenant Isolation ──

    public function test_operator_only_sees_mutations_for_their_school(): void
    {
        $teacher1 = Teacher::withoutTenantScope()->create([
            'school_id' => $this->school1->id,
            'nama' => 'Guru Sekolah 1',
            'status_kepegawaian' => 'GTY',
        ]);

        $teacher2 = Teacher::withoutTenantScope()->create([
            'school_id' => $this->school2->id,
            'nama' => 'Guru Sekolah 2',
            'status_kepegawaian' => 'GTY',
        ]);

        $mutation1 = TeacherMutation::create([
            'teacher_id' => $teacher1->id,
            'from_unit' => $this->school1->nama,
            'to_unit' => 'Unit Lain',
            'sk_number' => 'SK/01',
            'effective_date' => '2026-09-01',
            'performed_by' => 'Admin',
        ]);

        $mutation2 = TeacherMutation::create([
            'teacher_id' => $teacher2->id,
            'from_unit' => $this->school2->nama,
            'to_unit' => 'Unit Lain',
            'sk_number' => 'SK/02',
            'effective_date' => '2026-09-01',
            'performed_by' => 'Admin',
        ]);

        // Operator 1 list mutations
        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->getJson('/api/teacher-mutations');

        $response->assertStatus(200);
        $ids = collect($response->json())->pluck('id')->all();
        $this->assertContains($mutation1->id, $ids);
        $this->assertNotContains($mutation2->id, $ids);

        // Super Admin sees all
        $adminRes = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/teacher-mutations');
        $adminRes->assertStatus(200);
        $adminIds = collect($adminRes->json())->pluck('id')->all();
        $this->assertContains($mutation1->id, $adminIds);
        $this->assertContains($mutation2->id, $adminIds);
    }

    public function test_operator_cannot_mutate_teacher_of_another_school(): void
    {
        $teacher2 = Teacher::withoutTenantScope()->create([
            'school_id' => $this->school2->id,
            'nama' => 'Guru Sekolah 2',
            'status_kepegawaian' => 'GTY',
        ]);

        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->postJson('/api/teacher-mutations', [
                'teacher_id' => $teacher2->id,
                'to_school_id' => $this->school1->id,
                'sk_number' => 'SK/MUT/001',
                'effective_date' => '2026-09-15',
                'reason' => 'Transfer',
            ]);

        // Returns 403 or 404 (due to Teacher TenantScope or explicit controller check)
        $this->assertTrue(in_array($response->status(), [403, 404], true));
    }

    // ── FINDING-006: Hardcoded Default Jury PIN Removed ──

    public function test_jury_pin_fails_with_422_when_pin_not_configured(): void
    {
        $event = Event::create([
            'name' => 'Event Tanpa PIN',
            'slug' => 'event-tanpa-pin-test',
            'category' => 'Festival',
            'date' => '2026-09-19',
            'location' => 'Cilacap',
            'status' => 'OPEN',
        ]);

        $competition = Competition::create([
            'event_id' => $event->id,
            'name' => 'Lomba Nasyid',
            'category' => 'Seni Budaya',
            'type' => 'Group',
            'lomba_type' => 'mars_maarif',
            'status' => 'OPEN',
        ]);

        // Attempting to verify with previously hardcoded PIN maarif2026
        $response = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin' => 'maarif2026',
            'jury_name' => 'Dewan Juri 1',
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'success' => false,
            'message' => 'PIN juri belum dikonfigurasi untuk event ini. Hubungi administrator.',
        ]);
    }

    public function test_jury_pin_succeeds_with_configured_pin(): void
    {
        $event = Event::create([
            'name' => 'Event Ber-PIN',
            'slug' => 'event-ber-pin-test',
            'category' => 'Festival',
            'date' => '2026-09-19',
            'location' => 'Cilacap',
            'status' => 'OPEN',
        ]);

        Setting::setValue("jury_pin_event_{$event->id}", 'secretpin123');

        $competition = Competition::create([
            'event_id' => $event->id,
            'name' => 'Lomba Nasyid',
            'category' => 'Seni Budaya',
            'type' => 'Group',
            'lomba_type' => 'mars_maarif',
            'status' => 'OPEN',
        ]);

        // Wrong PIN -> 401
        $wrong = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin' => 'wrongpin',
            'jury_name' => 'Dewan Juri 1',
        ]);
        $wrong->assertStatus(401);

        // Correct PIN -> 200
        $correct = $this->postJson('/api/public/jury/verify-pin', [
            'competition_id' => $competition->id,
            'pin' => 'secretpin123',
            'jury_name' => 'Dewan Juri 1',
        ]);
        $correct->assertStatus(200);
        $this->assertNotEmpty($correct->json('data.token'));
    }

    // ── FINDING-003: Debug Route Role Check ──

    public function test_fix_template_emergency_route_forbidden_for_operator(): void
    {
        // Unauthenticated -> 401
        $unauth = $this->getJson('/fix-template-emergency');
        $this->assertTrue(in_array($unauth->status(), [401, 302], true));

        // Operator -> 403 Forbidden (stopped by role:super_admin middleware before closure)
        $opRes = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->getJson('/fix-template-emergency');
        $opRes->assertStatus(403);
    }

    // ── FINDING-002: Student Statistics Per-Kelas IDOR ──

    public function test_operator_cannot_access_student_statistics_per_kelas_of_another_school(): void
    {
        // Operator 1 accesses school 2 stats -> 403
        $forbidden = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->getJson("/api/student-statistics/madrasah/{$this->school2->id}/per-kelas");
        $forbidden->assertStatus(403);
        $forbidden->assertJsonFragment([
            'message' => 'Anda tidak memiliki akses ke data madrasah ini.',
        ]);

        // Operator 1 accesses school 1 stats -> 200
        $allowed = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->getJson("/api/student-statistics/madrasah/{$this->school1->id}/per-kelas");
        $allowed->assertStatus(200);

        // Super Admin can access any school -> 200
        $adminAllowed = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson("/api/student-statistics/madrasah/{$this->school2->id}/per-kelas");
        $adminAllowed->assertStatus(200);
    }

    public function test_operator_cannot_export_student_statistics_of_another_school(): void
    {
        // Operator 1 exports school 2 stats -> 403
        $forbidden = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->getJson("/api/student-statistics/madrasah/{$this->school2->id}/per-kelas/export");
        $forbidden->assertStatus(403);
    }

    // ── FINDING-005: Attendance Subject & Class Ownership ──

    public function test_operator_cannot_update_or_delete_subject_of_another_school(): void
    {
        $subjectSchool2 = Subject::withoutTenantScope()->create([
            'school_id' => $this->school2->id,
            'nama' => 'Matematika MTs 2',
            'kode' => 'MTK-2',
            'is_active' => true,
        ]);

        // Operator 1 tries to update Subject from School 2 -> 403 or 404
        $updateRes = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->putJson("/api/attendance/subjects/{$subjectSchool2->id}", [
                'nama' => 'Hacked Subject',
            ]);
        $this->assertTrue(in_array($updateRes->status(), [403, 404], true));

        // Operator 1 tries to delete Subject from School 2 -> 403 or 404
        $deleteRes = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->deleteJson("/api/attendance/subjects/{$subjectSchool2->id}");
        $this->assertTrue(in_array($deleteRes->status(), [403, 404], true));
    }

    public function test_operator_cannot_update_class_of_another_school(): void
    {
        $classSchool2 = SchoolClass::withoutTenantScope()->create([
            'school_id' => $this->school2->id,
            'nama' => 'Kelas 7A MTs 2',
            'tingkat' => '7',
            'tahun_ajaran' => '2025/2026',
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->putJson("/api/attendance/classes/{$classSchool2->id}", [
                'nama' => 'Hacked Class',
            ]);
        $this->assertTrue(in_array($response->status(), [403, 404], true));
    }
}
