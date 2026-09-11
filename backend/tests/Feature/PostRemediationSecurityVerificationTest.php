<?php

namespace Tests\Feature;

use App\Models\AnugerahRegistration;
use App\Models\AttendanceSetting;
use App\Models\Competition;
use App\Models\CompetitionParticipant;
use App\Models\CompetitionResult;
use App\Models\Event;
use App\Models\HeadmasterTenure;
use App\Models\NuptkSubmission;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Setting;
use App\Models\SkDocument;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * SEC-AUTH-002: Post-Remediation Security Verification & Adversarial Test Suite
 * 
 * Verifies that all P0/P1 authorization vulnerabilities are remediated, hardened,
 * and completely resilient to privilege escalation, IDOR, disclosure, and cross-tenant tampering.
 */
class PostRemediationSecurityVerificationTest extends TestCase
{
    use RefreshDatabase;

    private School $schoolA;
    private School $schoolB;
    private User $superAdmin;
    private User $adminYayasan;
    private User $operatorA;
    private User $operatorB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->schoolA = School::create([
            'nama' => 'MI Ma\'arif 01 Test',
            'npsn' => '10000001',
            'jenjang' => 'mi',
            'status' => 'swasta',
        ]);

        $this->schoolB = School::create([
            'nama' => 'MTs Ma\'arif 02 Test',
            'npsn' => '20000002',
            'jenjang' => 'mts',
            'status' => 'swasta',
        ]);

        $this->superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@simmaci.test',
            'password' => bcrypt('Password123!'),
            'role' => 'super_admin',
            'is_active' => true,
        ]);

        $this->adminYayasan = User::create([
            'name' => 'Admin Yayasan',
            'email' => 'adminyayasan@simmaci.test',
            'password' => bcrypt('Password123!'),
            'role' => 'admin_yayasan',
            'is_active' => true,
        ]);

        $this->operatorA = User::create([
            'name' => 'Operator A',
            'email' => 'operator.a@simmaci.test',
            'password' => bcrypt('Password123!'),
            'role' => 'operator',
            'school_id' => $this->schoolA->id,
            'is_active' => true,
        ]);

        $this->operatorB = User::create([
            'name' => 'Operator B',
            'email' => 'operator.b@simmaci.test',
            'password' => bcrypt('Password123!'),
            'role' => 'operator',
            'school_id' => $this->schoolB->id,
            'is_active' => true,
        ]);
    }

    // ── AUTH-001: Anonymous Registration Privilege Escalation Blocked ──
    public function test_auth_001_anonymous_registration_privilege_escalation_blocked(): void
    {
        $payload = [
            'name' => 'Attacker Super Admin',
            'email' => 'attacker.superadmin@evil.com',
            'password' => 'StrongPass123!',
            'role' => 'super_admin',
            'is_active' => true,
            'permissions' => ['all'],
            'school_id' => 9999,
        ];

        $response = $this->postJson('/api/auth/register', $payload);
        $this->assertEquals(201, $response->status());

        $user = User::where('email', 'attacker.superadmin@evil.com')->first();
        $this->assertNotNull($user, 'User was created');
        
        // SEC-AUTH-002: Server must force operator role and deny super_admin injection
        $this->assertEquals('operator', $user->role, 'Server-side enforcement must restrict role to operator');
        $this->assertNotEquals('super_admin', $user->role);

        // Adversarial attempt: admin_yayasan injection
        $responseYayasan = $this->postJson('/api/auth/register', [
            'name' => 'Attacker Yayasan',
            'email' => 'attacker.yayasan@evil.com',
            'password' => 'StrongPass123!',
            'role' => 'admin_yayasan',
        ]);
        $this->assertEquals(201, $responseYayasan->status());

        $userYayasan = User::where('email', 'attacker.yayasan@evil.com')->first();
        $this->assertEquals('operator', $userYayasan->role, 'Server-side enforcement must restrict role to operator');
    }

    // ── AUTH-002: Competition Results / Participant Authorization ──
    public function test_auth_002_operator_cannot_modify_competition_results_or_delete_participants(): void
    {
        $event = Event::create([
            'name' => 'Event Lomba 2026',
            'slug' => 'event-lomba-2026',
            'category' => 'Festival',
            'date' => '2026-09-19',
            'location' => 'Cilacap',
            'status' => 'OPEN',
        ]);

        $competition = Competition::create([
            'event_id' => $event->id,
            'name' => 'Pidato Bahasa Arab',
            'category' => 'Seni',
            'type' => 'Individual',
            'lomba_type' => 'pidato',
            'status' => 'OPEN',
        ]);

        $participant = CompetitionParticipant::create([
            'competition_id' => $competition->id,
            'name' => 'Peserta A',
            'institution' => 'Sekolah X',
        ]);

        // 1. Operator attempts to set score & rank -> 403 Forbidden
        $responseScore = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson("/api/competitions/{$competition->id}/results", [
                'participant_id' => $participant->id,
                'score' => 99.5,
                'rank' => 1,
                'notes' => 'Hacked by Operator A',
            ]);
        $this->assertEquals(403, $responseScore->status());
        $this->assertNull(CompetitionResult::where('competition_id', $competition->id)->first(), 'DB result must remain untouched');

        // 2. Operator attempts bulk store -> 403 Forbidden
        $responseBulk = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson("/api/competitions/{$competition->id}/results/bulk", [
                'results' => [
                    ['participant_id' => $participant->id, 'score' => 88.0, 'rank' => 2],
                ],
            ]);
        $this->assertEquals(403, $responseBulk->status());

        // 3. Operator attempts delete participant -> 403 Forbidden
        $responseDelete = $this->actingAs($this->operatorA, 'sanctum')
            ->deleteJson("/api/participants/{$participant->id}");
        $this->assertEquals(403, $responseDelete->status());
        $this->assertNotNull(CompetitionParticipant::find($participant->id), 'Participant must not be deleted');

        // 4. Positive test: Authorized Super Admin succeeds
        $responseAdmin = $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson("/api/competitions/{$competition->id}/results", [
                'participant_id' => $participant->id,
                'score' => 95.0,
                'rank' => 1,
            ]);
        $this->assertEquals(200, $responseAdmin->status());
    }

    // ── AUTH-003: Anugerah Review Authorization ──
    public function test_auth_003_operator_cannot_review_anugerah_registration(): void
    {
        $event = Event::create([
            'name' => 'Anugerah Ma\'arif',
            'slug' => 'anugerah-maarif-test',
            'category' => 'Anugerah',
            'date' => '2026-09-19',
            'location' => 'Cilacap',
            'status' => 'OPEN',
        ]);

        $competition = Competition::create([
            'event_id' => $event->id,
            'name' => 'Guru Berprestasi',
            'category' => 'Anugerah',
            'type' => 'Individual',
            'lomba_type' => 'guru_berprestasi',
            'status' => 'OPEN',
        ]);

        $registration = AnugerahRegistration::create([
            'event_id' => $event->id,
            'competition_id' => $competition->id,
            'registration_no' => 'REG-TEST-01',
            'category' => 'guru',
            'jenjang' => 'MI/SD',
            'applicant_name' => 'Calon Juara',
            'school_id' => $this->schoolB->id,
            'school_name' => $this->schoolB->nama,
            'status' => 'submitted',
        ]);

        // 1. Operator attempts to crown winner -> 403 Forbidden
        $response = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson("/api/anugerah-registrations/{$registration->id}/review", [
                'status' => 'winner',
                'rank' => 1,
                'total_score' => 100,
                'reviewer_notes' => 'Tampered by Operator',
            ]);

        $this->assertEquals(403, $response->status(), 'Operator must be denied with 403');
        $registration->refresh();
        $this->assertEquals('submitted', $registration->status, 'Database status must remain immutable');
        $this->assertNull($registration->rank);

        // 2. Positive test: Authorized Admin Yayasan succeeds
        $responseAdmin = $this->actingAs($this->adminYayasan, 'sanctum')
            ->postJson("/api/anugerah-registrations/{$registration->id}/review", [
                'status' => 'winner',
                'rank' => 1,
                'total_score' => 98.5,
                'reviewer_notes' => 'Official review',
            ]);
        $this->assertEquals(200, $responseAdmin->status());
        $registration->refresh();
        $this->assertEquals('winner', $registration->status);
    }

    // ── AUTH-004: Jury PIN Secret Disclosure Blocked ──
    public function test_auth_004_jury_pin_secret_disclosure_blocked(): void
    {
        $event = Event::create([
            'name' => 'Festival PIN Test',
            'slug' => 'festival-pin-test',
            'category' => 'Festival',
            'date' => '2026-09-19',
            'location' => 'Cilacap',
            'status' => 'OPEN',
        ]);

        Setting::setValue("jury_pin_event_{$event->id}", 'SecretJuryPIN2026');

        $competition = Competition::create([
            'event_id' => $event->id,
            'name' => 'Tahfidz',
            'category' => 'Keagamaan',
            'type' => 'Individual',
            'lomba_type' => 'tahfidz',
            'status' => 'OPEN',
        ]);

        // 1. Anonymous request -> 401 Unauthorized
        $responseAnon = $this->getJson("/api/competitions/{$competition->id}/jury-pin");
        $this->assertEquals(401, $responseAnon->status());

        // 2. Operator request -> 403 Forbidden
        $responseOperator = $this->actingAs($this->operatorA, 'sanctum')
            ->getJson("/api/competitions/{$competition->id}/jury-pin");
        $this->assertEquals(403, $responseOperator->status());

        // 3. Operator attempts to query PIN via settings endpoint -> 403 Forbidden
        $responseSettings = $this->actingAs($this->operatorA, 'sanctum')
            ->getJson("/api/settings/jury_pin_event_{$event->id}");
        $this->assertEquals(403, $responseSettings->status());

        // 3b. Anonymous attempts to query PIN via settings endpoint -> 401 or 403 Rejected
        \Illuminate\Support\Facades\Auth::forgetGuards();
        $responseAnonSettings = $this->getJson("/api/settings/jury_pin_event_{$event->id}");
        $this->assertTrue(in_array($responseAnonSettings->status(), [401, 403], true));

        // 4. Positive test: Super Admin gets PIN
        $responseAdmin = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson("/api/competitions/{$competition->id}/jury-pin");
        $this->assertEquals(200, $responseAdmin->status());
        $this->assertEquals('SecretJuryPIN2026', $responseAdmin->json('data.pin'));
    }

    // ── AUTH-005: Headmaster Approval / Status Tampering Blocked ──
    public function test_auth_005_operator_cannot_approve_or_tamper_headmaster_tenure(): void
    {
        $teacher = Teacher::withoutTenantScope()->create([
            'school_id' => $this->schoolA->id,
            'nama' => 'Calon Kepala Madrasah A',
            'status_kepegawaian' => 'GTY',
        ]);

        $tenure = HeadmasterTenure::create([
            'teacher_id' => $teacher->id,
            'teacher_name' => $teacher->nama,
            'school_id' => $this->schoolA->id,
            'school_name' => $this->schoolA->nama,
            'periode' => '2026-2030',
            'start_date' => '2026-01-01',
            'end_date' => '2030-01-01',
            'status' => 'pending',
            'created_by' => 'operator.a@simmaci.test',
        ]);

        // 1. Self-approval attempt by Operator of same school -> 403 Forbidden
        $responseSame = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson("/api/headmasters/{$tenure->id}/approve", [
                'nomor_sk' => 'SK/KAMAD/2026/001',
            ]);
        $this->assertEquals(403, $responseSame->status());

        // 2. Rejection attempt by Operator -> 403 Forbidden
        $responseReject = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson("/api/headmasters/{$tenure->id}/reject", [
                'rejection_reason' => 'Unauthorized reject',
            ]);
        $this->assertEquals(403, $responseReject->status());

        // 3. Update tampering by Operator -> 403 Forbidden
        $responseUpdate = $this->actingAs($this->operatorA, 'sanctum')
            ->putJson("/api/headmasters/{$tenure->id}", [
                'status' => 'active',
                'nomor_sk' => 'SK/TAMPERED/001',
            ]);
        $this->assertEquals(403, $responseUpdate->status());

        // Verify database state remains pending
        $tenure->refresh();
        $this->assertEquals('pending', $tenure->status);
        $this->assertNull($tenure->nomor_sk);

        // 4. Positive test: Authorized Super Admin approves
        $responseAdmin = $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson("/api/headmasters/{$tenure->id}/approve", [
                'nomor_sk' => 'SK/KAMAD/2026/001',
            ]);
        $this->assertEquals(200, $responseAdmin->status());
        $tenure->refresh();
        $this->assertEquals('active', $tenure->status);
    }

    // ── AUTH-006: NUPTK Approval Authorization Blocked ──
    public function test_auth_006_operator_cannot_approve_nuptk_submission(): void
    {
        $teacher = Teacher::withoutTenantScope()->create([
            'school_id' => $this->schoolA->id,
            'nama' => 'Guru Pengaju NUPTK A',
            'status_kepegawaian' => 'GTY',
        ]);

        $submission = NuptkSubmission::create([
            'teacher_id' => $teacher->id,
            'school_id' => $this->schoolA->id,
            'status' => 'Pending',
            'submitted_at' => now(),
        ]);

        // 1. Operator attempts to approve own school NUPTK -> 403 Forbidden
        $responseApprove = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson("/api/nuptk-submissions/{$submission->id}/approve", [
                'nomor_surat_rekomendasi' => 'REK/NUPTK/2026/001',
                'tanggal_surat_rekomendasi' => '2026-09-11',
            ]);
        $this->assertEquals(403, $responseApprove->status());

        // 2. Operator attempts to reject -> 403 Forbidden
        $responseReject = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson("/api/nuptk-submissions/{$submission->id}/reject", [
                'rejection_reason' => 'Unauthorized reject',
            ]);
        $this->assertEquals(403, $responseReject->status());

        // Verify DB state immutable
        $submission->refresh();
        $this->assertEquals('Pending', $submission->status);
        $this->assertNull($submission->nomor_surat_rekomendasi);

        // 3. Positive test: Admin Yayasan approves
        $responseAdmin = $this->actingAs($this->adminYayasan, 'sanctum')
            ->postJson("/api/nuptk-submissions/{$submission->id}/approve", [
                'nomor_surat_rekomendasi' => 'REK/NUPTK/2026/001',
                'tanggal_surat_rekomendasi' => '2026-09-11',
            ]);
        $this->assertEquals(200, $responseAdmin->status());
        $submission->refresh();
        $this->assertEquals('Approved', $submission->status);
    }

    // ── AUTH-007: SK Document Cross-Tenant Access Blocked ──
    public function test_auth_007_operator_cannot_access_sk_of_another_school(): void
    {
        $teacher = Teacher::withoutTenantScope()->create([
            'school_id' => $this->schoolB->id,
            'nama' => 'Guru Madrasah B',
            'status_kepegawaian' => 'GTY',
        ]);

        $sk = SkDocument::withoutTenantScope()->create([
            'school_id' => $this->schoolB->id,
            'teacher_id' => $teacher->id,
            'nomor_sk' => 'SK/B/001',
            'jenis_sk' => 'Tetap',
            'nama' => 'Guru Madrasah B',
            'tanggal_penetapan' => '2026-01-01',
            'status' => 'approved',
            'created_by' => 'operator.b@simmaci.test',
        ]);

        // Operator A tries to access School B's SK -> 404 (TenantScope)
        $response = $this->actingAs($this->operatorA, 'sanctum')
            ->getJson("/api/sk-documents/{$sk->id}");

        $this->assertEquals(404, $response->status());
    }

    // ── AUTH-008: Teacher Mutation Tenant Isolation Verified ──
    public function test_auth_008_teacher_mutation_tenant_isolation_verified(): void
    {
        $teacherA = Teacher::withoutTenantScope()->create([
            'school_id' => $this->schoolA->id,
            'nama' => 'Guru Madrasah A',
            'status_kepegawaian' => 'GTY',
        ]);

        $teacherB = Teacher::withoutTenantScope()->create([
            'school_id' => $this->schoolB->id,
            'nama' => 'Guru Madrasah B',
            'status_kepegawaian' => 'GTY',
        ]);

        // Operator A tries to mutate Teacher B -> 403 or 404
        $response = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson('/api/teacher-mutations', [
                'teacher_id' => $teacherB->id,
                'to_school_id' => $this->schoolA->id,
                'sk_number' => 'SK/MUT/001',
                'effective_date' => '2026-09-15',
            ]);

        $this->assertTrue(in_array($response->status(), [403, 404], true));
    }

    // ── AUTH-009: Attendance Subject Ownership Verified ──
    public function test_auth_009_attendance_subject_ownership_verified(): void
    {
        $subjectB = Subject::withoutTenantScope()->create([
            'school_id' => $this->schoolB->id,
            'nama' => 'Fisika MTs B',
            'kode' => 'FIS-B',
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->operatorA, 'sanctum')
            ->putJson("/api/attendance/subjects/{$subjectB->id}", [
                'nama' => 'Hacked Subject',
            ]);

        $this->assertTrue(in_array($response->status(), [403, 404], true));
    }

    // ── AUTH-010: Emergency Route Protected ──
    public function test_auth_010_emergency_route_protected(): void
    {
        $response = $this->actingAs($this->operatorA, 'sanctum')
            ->getJson('/fix-template-emergency');

        $this->assertEquals(403, $response->status());
    }

    // ── AUTH-011: Public Attendance PII Protected by Scanner Session Token ──
    public function test_auth_011_public_attendance_pii_protected_by_scanner_session(): void
    {
        $class = SchoolClass::withoutGlobalScopes()->create([
            'school_id' => $this->schoolA->id,
            'nama' => 'Kelas 1A',
            'tingkat' => '1',
            'tahun_ajaran' => '2025/2026',
            'is_active' => true,
        ]);

        $student = Student::withoutGlobalScopes()->create([
            'school_id' => $this->schoolA->id,
            'nama' => 'Ahmad Siswa Rahasia',
            'nisn' => '1234567890',
            'kelas' => 'Kelas 1A',
            'status' => 'Aktif',
        ]);

        AttendanceSetting::create([
            'school_id' => $this->schoolA->id,
            'scanner_pin' => '123456',
        ]);

        // 1. Anonymous request with no scanner session token -> 401 Unauthorized
        $responseAnon = $this->getJson("/api/public/attendance/students?school_id={$this->schoolA->id}&class_id={$class->id}");
        $this->assertEquals(401, $responseAnon->status());

        $responseAnonClasses = $this->getJson("/api/public/attendance/classes?school_id={$this->schoolA->id}");
        $this->assertEquals(401, $responseAnonClasses->status());

        // 2. Verify PIN to get scanner token
        $verifyRes = $this->postJson('/api/public/attendance/verify-pin', [
            'school_id' => $this->schoolA->id,
            'pin' => '123456',
        ]);
        $this->assertEquals(200, $verifyRes->status());
        $token = $verifyRes->json('scanner_token');
        $this->assertNotEmpty($token);

        // 3. Cross-School Token Replay: Token for School A used on School B -> 401 Unauthorized
        $responseReplay = $this->withHeader('X-Scanner-Token', $token)
            ->getJson("/api/public/attendance/students?school_id={$this->schoolB->id}&class_id=1");
        $this->assertEquals(401, $responseReplay->status());

        // 4. Authorized Scanner request with valid token -> 200 OK & PII minimization check
        $responseValid = $this->withHeader('X-Scanner-Token', $token)
            ->getJson("/api/public/attendance/students?school_id={$this->schoolA->id}&class_id={$class->id}");
        $this->assertEquals(200, $responseValid->status());
        $studentsData = $responseValid->json();
        $this->assertNotEmpty($studentsData);
        // Ensure NISN or other private PII is minimized
        $firstStudent = $studentsData[0];
        $this->assertEquals('Ahmad Siswa Rahasia', $firstStudent['nama']);
        $this->assertArrayNotHasKey('nisn', $firstStudent, 'Sensitive PII (NISN) must not be exposed to public scanner');
    }

    // ── AUTH-012: Arbitrary File Deletion and Traversal Blocked ──
    public function test_auth_012_arbitrary_file_deletion_and_traversal_blocked(): void
    {
        // 1. Directory Traversal Attempt -> 403 Forbidden
        $responseTraversal = $this->actingAs($this->operatorA, 'sanctum')
            ->deleteJson('/api/files', [
                'path' => '../../etc/passwd',
                'disk' => 'public',
            ]);
        $this->assertEquals(403, $responseTraversal->status());

        // 2. Operator attempts to delete system template -> 403 Forbidden
        $responseSystem = $this->actingAs($this->operatorA, 'sanctum')
            ->deleteJson('/api/files', [
                'path' => 'sk-templates/sk_guru_tetap.docx',
                'disk' => 'public',
            ]);
        $this->assertEquals(403, $responseSystem->status());

        // 3. Operator attempts cross-tenant file deletion -> 403 Forbidden
        $responseTenant = $this->actingAs($this->operatorA, 'sanctum')
            ->deleteJson('/api/files', [
                'path' => "schools/{$this->schoolB->id}/dokumen_rahasia.pdf",
                'disk' => 'public',
            ]);
        $this->assertEquals(403, $responseTenant->status());
    }

    public function test_auth_012_anonymous_cannot_delete_files(): void
    {
        // 4. Anonymous request -> 401 Unauthorized
        $responseAnon = $this->deleteJson('/api/files', [
            'path' => 'uploads/test.pdf',
        ]);
        $this->assertEquals(401, $responseAnon->status());
    }

    // ── AUTH-013: NISN Cross-Tenant Collision & Hijacking Blocked ──
    public function test_auth_013_nisn_cross_tenant_collision_and_hijacking_blocked(): void
    {
        // Existing student in School A with official NISN
        $studentA = Student::withoutTenantScope()->create([
            'school_id' => $this->schoolA->id,
            'nama' => 'Santri Asli Sekolah A',
            'nisn' => '9988776655',
            'kelas' => '1',
            'status' => 'Aktif',
        ]);

        // Operator B attempts to import student with the SAME NISN into School B
        $responseImportB = $this->actingAs($this->operatorB, 'sanctum')
            ->postJson('/api/students/import', [
                'students' => [
                    [
                        'nama' => 'Santri Pembajak',
                        'nisn' => '9988776655',
                        'kelas' => '1',
                    ],
                ],
            ]);

        $this->assertEquals(200, $responseImportB->status());
        $errors = $responseImportB->json('errors');
        $this->assertNotEmpty($errors, 'Import should record an error for conflicting NISN');
        $this->assertStringContainsString('Konflik Kepemilikan Data', $errors[0]['error']);

        // Verify Student A in School A was NOT hijacked or reassigned to School B
        $studentA->refresh();
        $this->assertEquals($this->schoolA->id, $studentA->school_id, 'Student A school_id must remain immutable');
        $this->assertEquals('Santri Asli Sekolah A', $studentA->nama);

        // Positive test: Operator A updates their OWN student with the same NISN
        $responseImportA = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson('/api/students/import', [
                'students' => [
                    [
                        'nama' => 'Santri Asli Sekolah A (Updated)',
                        'nisn' => '9988776655',
                        'kelas' => '2',
                    ],
                ],
            ]);
        $this->assertEquals(200, $responseImportA->status());
        $this->assertEquals(1, $responseImportA->json('created'));
        $studentA->refresh();
        $this->assertEquals('Santri Asli Sekolah A (Updated)', $studentA->nama);
        $this->assertEquals($this->schoolA->id, $studentA->school_id);
    }

    // ── AUTH-014: Student Statistics IDOR Blocked ──
    public function test_auth_014_student_statistics_idor_blocked(): void
    {
        $response = $this->actingAs($this->operatorA, 'sanctum')
            ->getJson("/api/student-statistics/madrasah/{$this->schoolB->id}/per-kelas");

        $this->assertEquals(403, $response->status());
    }
}
