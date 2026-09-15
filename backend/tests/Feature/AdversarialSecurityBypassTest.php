<?php

namespace Tests\Feature;

use App\Models\AnugerahRegistration;
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
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * SEC-AUTH-002: Master Adversarial Security & Bypass Verification Test Suite
 *
 * Simulates real-world attack vectors, alternative routes, parameter tampering,
 * privilege escalation, and cross-tenant boundaries with pre- and post-request
 * database state immutability assertions.
 */
class AdversarialSecurityBypassTest extends TestCase
{
    use RefreshDatabase;

    private School $schoolA;
    private School $schoolB;
    private User $superAdmin;
    private User $adminYayasan;
    private User $operatorA;
    private User $operatorB;
    private User $staffUser;
    private User $juryUser;

    protected function setUp(): void
    {
        parent::setUp();

        // Setup storage fake
        Storage::fake('s3');
        Storage::fake('public');

        $this->schoolA = School::create([
            'nama' => 'MI Ma\'arif 01 Kebumen',
            'npsn' => '10101010',
            'jenjang' => 'mi',
            'status' => 'swasta',
        ]);

        $this->schoolB = School::create([
            'nama' => 'MTs Ma\'arif 02 Cilacap',
            'npsn' => '20202020',
            'jenjang' => 'mts',
            'status' => 'swasta',
        ]);

        $this->superAdmin = User::create([
            'name' => 'Super Administrator',
            'email' => 'superadmin@simmaci.test',
            'password' => bcrypt('StrongPass123!'),
            'role' => 'super_admin',
            'is_active' => true,
        ]);

        $this->adminYayasan = User::create([
            'name' => 'Admin Yayasan Pengurus',
            'email' => 'adminyayasan@simmaci.test',
            'password' => bcrypt('StrongPass123!'),
            'role' => 'admin_yayasan',
            'is_active' => true,
        ]);

        $this->operatorA = User::create([
            'name' => 'Operator Sekolah A',
            'email' => 'operator.a@simmaci.test',
            'password' => bcrypt('StrongPass123!'),
            'role' => 'operator',
            'school_id' => $this->schoolA->id,
            'is_active' => true,
        ]);

        $this->operatorB = User::create([
            'name' => 'Operator Sekolah B',
            'email' => 'operator.b@simmaci.test',
            'password' => bcrypt('StrongPass123!'),
            'role' => 'operator',
            'school_id' => $this->schoolB->id,
            'is_active' => true,
        ]);

        $this->staffUser = User::create([
            'name' => 'Staff Pengawas',
            'email' => 'staff@simmaci.test',
            'password' => bcrypt('StrongPass123!'),
            'role' => 'staff',
            'is_active' => true,
        ]);

        $this->juryUser = User::create([
            'name' => 'Dewan Juri',
            'email' => 'jury@simmaci.test',
            'password' => bcrypt('StrongPass123!'),
            'role' => 'jury',
            'is_active' => true,
        ]);
    }

    // ── SEC-NEW-01 & AUTH-012: MinIO Proxy Token & Tenant Verification ──

    public function test_adv_01_minio_proxy_anonymous_access_strictly_denied_with_401(): void
    {
        Storage::disk('s3')->put('schools/1/private_sk.pdf', 'CONFIDENTIAL_CONTENT');
        Storage::disk('s3')->put('sk-templates/system_template.docx', 'SYSTEM_TEMPLATE_CONTENT');

        // 1. Anonymous request to school file -> 401 Unauthorized
        $resSchool = $this->getJson('/api/minio/schools/1/private_sk.pdf');
        $this->assertEquals(401, $resSchool->status(), 'Anonymous access to MinIO school file must return 401');

        // 2. Anonymous request to template -> 401 Unauthorized
        $resTemplate = $this->getJson('/api/minio/sk-templates/system_template.docx');
        $this->assertEquals(401, $resTemplate->status(), 'Anonymous access to MinIO system template must return 401');
    }

    public function test_adv_02_minio_proxy_cross_tenant_access_denied_with_403(): void
    {
        Storage::disk('s3')->put("schools/{$this->schoolB->id}/secret_sk_b.pdf", 'SCHOOL_B_SECRET_DOC');

        // Operator A attempts to download School B's document via MinIO Proxy
        $response = $this->actingAs($this->operatorA, 'sanctum')
            ->getJson("/api/minio/schools/{$this->schoolB->id}/secret_sk_b.pdf");

        $this->assertEquals(403, $response->status(), 'Cross-tenant MinIO file access must return 403');
        $this->assertStringContainsString('tidak berwenang', $response->json('error'));
    }

    public function test_adv_03_minio_proxy_system_directories_denied_for_operator(): void
    {
        Storage::disk('s3')->put('sk-templates/official_template.docx', 'OFFICIAL_TEMPLATE');

        // Operator A attempts to download system template via MinIO Proxy
        $response = $this->actingAs($this->operatorA, 'sanctum')
            ->getJson('/api/minio/sk-templates/official_template.docx');

        $this->assertEquals(403, $response->status(), 'Operator must not access system/sk-templates directory via MinIO');

        // Super Admin succeeds
        $resAdmin = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/minio/sk-templates/official_template.docx');
        $this->assertEquals(200, $resAdmin->status());
    }

    // ── SEC-NEW-02 & AUTH-004: Setting Controller Secrets Protection ──

    public function test_adv_04_setting_index_filters_secrets_for_staff_and_jury(): void
    {
        Setting::setValue('meeting_scanner_pin', 'PIN9988');
        Setting::setValue('jury_pin_event_1', 'JURYSECRET');
        Setting::setValue('payment_gateway_key', 'GATEWAY_SECRET_KEY');
        Setting::setValue('app_master_key', 'MASTER_SECRET_KEY');
        Setting::setValue('public_app_name', 'SIMMACI Portal');

        // 1. Staff user queries settings index -> secrets must be omitted
        $resStaff = $this->actingAs($this->staffUser, 'sanctum')
            ->getJson('/api/settings');
        $resStaff->assertStatus(200);
        $keysStaff = array_keys($resStaff->json());
        $this->assertNotContains('meeting_scanner_pin', $keysStaff);
        $this->assertNotContains('jury_pin_event_1', $keysStaff);
        $this->assertNotContains('payment_gateway_key', $keysStaff);
        $this->assertNotContains('app_master_key', $keysStaff);
        $this->assertContains('public_app_name', $keysStaff);

        // 2. Jury user queries settings index -> secrets must be omitted
        $resJury = $this->actingAs($this->juryUser, 'sanctum')
            ->getJson('/api/settings');
        $resJury->assertStatus(200);
        $keysJury = array_keys($resJury->json());
        $this->assertNotContains('meeting_scanner_pin', $keysJury);
        $this->assertNotContains('jury_pin_event_1', $keysJury);
        $this->assertNotContains('payment_gateway_key', $keysJury);
        $this->assertNotContains('app_master_key', $keysJury);

        // 3. Super Admin queries settings index -> secrets are accessible
        $resAdmin = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/settings');
        $resAdmin->assertStatus(200);
        $keysAdmin = array_keys($resAdmin->json());
        $this->assertContains('meeting_scanner_pin', $keysAdmin);
        $this->assertContains('jury_pin_event_1', $keysAdmin);
    }

    public function test_adv_05_setting_show_blocks_expanded_sensitive_keys(): void
    {
        Setting::setValue('payment_gateway_key', 'GATEWAY_SECRET_KEY');
        Setting::setValue('app_master_key', 'MASTER_SECRET_KEY');
        Setting::setValue('system_scanner_code', 'SCANNER999');

        // Operator attempts show on sensitive keys -> 403
        $res1 = $this->actingAs($this->operatorA, 'sanctum')->getJson('/api/settings/payment_gateway_key');
        $this->assertEquals(403, $res1->status());

        $res2 = $this->actingAs($this->operatorA, 'sanctum')->getJson('/api/settings/app_master_key');
        $this->assertEquals(403, $res2->status());

        $res3 = $this->actingAs($this->operatorA, 'sanctum')->getJson('/api/settings/system_scanner_code');
        $this->assertEquals(403, $res3->status());
    }

    public function test_adv_06_setting_mutation_denied_for_non_admins_with_db_immutability(): void
    {
        Setting::setValue('scanner_pin', 'INITIAL_PIN');

        // Operator attempts to overwrite sensitive setting -> 403
        $resOp = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson('/api/settings', [
                'key' => 'scanner_pin',
                'value' => 'HACKED_PIN',
            ]);
        $this->assertEquals(403, $resOp->status());

        // Staff attempts to overwrite sensitive setting -> 403
        $resStaff = $this->actingAs($this->staffUser, 'sanctum')
            ->postJson('/api/settings', [
                'key' => 'scanner_pin',
                'value' => 'HACKED_PIN_STAFF',
            ]);
        $this->assertEquals(403, $resStaff->status());

        // Verify DB unchanged
        $this->assertEquals('INITIAL_PIN', Setting::getValue('scanner_pin'));
    }

    // ── SEC-NEW-04: HasTenantScope Unconditional Tenant Enforcement ──

    public function test_adv_07_has_tenant_scope_unconditionally_forces_operator_school_id(): void
    {
        // Operator A creates Subject attempting to inject School B's school_id
        $response = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson('/api/attendance/subjects', [
                'nama' => 'Biologi Madrasah A',
                'kode' => 'BIO-A1',
                'school_id' => $this->schoolB->id, // Malicious injection of foreign school_id
            ]);

        $this->assertEquals(201, $response->status());
        $subjectId = $response->json('id');
        $subject = Subject::withoutTenantScope()->find($subjectId);

        $this->assertNotNull($subject);
        $this->assertEquals($this->schoolA->id, $subject->school_id, 'HasTenantScope must unconditionally force operator school_id');
        $this->assertNotEquals($this->schoolB->id, $subject->school_id);
    }

    // ── SEC-NEW-03 & AUTH-008: Teacher Mutations Unsupported Methods ──

    public function test_adv_08_teacher_mutations_unsupported_methods_return_405(): void
    {
        // PUT /api/teacher-mutations/{id} should return 404 or 405
        $responsePut = $this->actingAs($this->operatorA, 'sanctum')
            ->putJson('/api/teacher-mutations/1', ['reason' => 'tampered']);
        $this->assertTrue(in_array($responsePut->status(), [404, 405], true));

        // DELETE /api/teacher-mutations/{id} should return 404 or 405
        $responseDelete = $this->actingAs($this->operatorA, 'sanctum')
            ->deleteJson('/api/teacher-mutations/1');
        $this->assertTrue(in_array($responseDelete->status(), [404, 405], true));
    }

    // ── AUTH-002: Competition Results State Immutability ──

    public function test_adv_09_competition_score_tampering_by_operator_blocked_with_db_immutability(): void
    {
        $event = Event::create([
            'name' => 'Olimpiade Madrasah 2026',
            'slug' => 'olimpiade-madrasah-2026',
            'category' => 'Festival',
            'date' => '2026-09-20',
            'location' => 'Cilacap',
            'status' => 'OPEN',
        ]);

        $comp = Competition::create([
            'event_id' => $event->id,
            'name' => 'Matematika Terintegrasi',
            'category' => 'Sains',
            'type' => 'Individual',
            'status' => 'OPEN',
        ]);

        $participant = CompetitionParticipant::create([
            'competition_id' => $comp->id,
            'school_id' => $this->schoolB->id,
            'name' => 'Peserta Unggulan B',
            'institution' => $this->schoolB->nama,
        ]);

        $initialResult = CompetitionResult::create([
            'competition_id' => $comp->id,
            'participant_id' => $participant->id,
            'score' => 75.0,
            'rank' => 3,
        ]);

        // 1. Operator attempts to tamper score & rank -> 403
        $resTamper = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson("/api/competitions/{$comp->id}/results", [
                'participant_id' => $participant->id,
                'score' => 99.9,
                'rank' => 1,
            ]);
        $this->assertEquals(403, $resTamper->status());

        // 2. Operator attempts reset-scores -> 403
        $resReset = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson("/api/competitions/{$comp->id}/reset-scores");
        $this->assertEquals(403, $resReset->status());

        // 3. Operator attempts promote-finalists -> 403
        $resPromote = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson("/api/competitions/{$comp->id}/promote-finalists", ['top_n' => 5]);
        $this->assertEquals(403, $resPromote->status());

        // Assert DB state unchanged
        $initialResult->refresh();
        $this->assertEquals(75.0, (float) $initialResult->score);
        $this->assertEquals(3, (int) $initialResult->rank);
    }

    // ── AUTH-003: Anugerah Review Status Immutability ──

    public function test_adv_10_anugerah_registration_status_tampering_blocked_with_db_immutability(): void
    {
        $event = Event::create([
            'name' => 'Anugerah Maarif 2026',
            'slug' => 'anugerah-maarif-2026',
            'category' => 'Anugerah',
            'date' => '2026-09-20',
            'location' => 'Cilacap',
            'status' => 'OPEN',
        ]);

        $comp = Competition::create([
            'event_id' => $event->id,
            'name' => 'Kepala Madrasah Teladan',
            'category' => 'Anugerah',
            'type' => 'Individual',
            'status' => 'OPEN',
        ]);

        $reg = AnugerahRegistration::create([
            'event_id' => $event->id,
            'competition_id' => $comp->id,
            'school_id' => $this->schoolA->id,
            'school_name' => $this->schoolA->nama,
            'applicant_name' => 'Kamad A',
            'category' => 'guru',
            'jenjang' => 'MI',
            'status' => 'submitted',
        ]);

        // Operator attempts to directly update status to winner via update endpoint -> 403
        $response = $this->actingAs($this->operatorA, 'sanctum')
            ->putJson("/api/anugerah-registrations/{$reg->id}", [
                'status' => 'winner',
                'rank' => 1,
            ]);

        $this->assertEquals(403, $response->status());
        $reg->refresh();
        $this->assertEquals('submitted', $reg->status, 'Submitted registration status must remain immutable against operator');
    }

    // ── AUTH-005 & AUTH-006: Headmaster & NUPTK Approval Immutability ──

    public function test_adv_11_headmaster_and_nuptk_approval_strictly_forbidden_for_operator(): void
    {
        $teacher = Teacher::withoutTenantScope()->create([
            'school_id' => $this->schoolA->id,
            'nama' => 'Guru Calon Kamad',
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

        $nuptk = NuptkSubmission::create([
            'teacher_id' => $teacher->id,
            'school_id' => $this->schoolA->id,
            'status' => 'Pending',
            'submitted_at' => now(),
        ]);

        // 1. Operator attempts headmaster approve -> 403
        $resKamad = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson("/api/headmasters/{$tenure->id}/approve", [
                'nomor_sk' => 'SK/TAMPER/001',
            ]);
        $this->assertEquals(403, $resKamad->status());

        // 2. Operator attempts NUPTK approve -> 403
        $resNuptk = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson("/api/nuptk-submissions/{$nuptk->id}/approve", [
                'nomor_surat_rekomendasi' => 'REK/TAMPER/001',
            ]);
        $this->assertEquals(403, $resNuptk->status());

        // Verify DB states immutable
        $tenure->refresh();
        $this->assertEquals('pending', $tenure->status);
        $this->assertNull($tenure->nomor_sk);

        $nuptk->refresh();
        $this->assertEquals('Pending', $nuptk->status);
        $this->assertNull($nuptk->nomor_surat_rekomendasi);
    }

    // ── AUTH-009: Attendance Cross-Tenant Immutability ──

    public function test_adv_12_attendance_cross_tenant_modification_blocked_with_db_immutability(): void
    {
        $subjectB = Subject::withoutTenantScope()->create([
            'school_id' => $this->schoolB->id,
            'nama' => 'Bahasa Arab MTs B',
            'kode' => 'ARB-B',
            'is_active' => true,
        ]);

        $classB = SchoolClass::withoutTenantScope()->create([
            'school_id' => $this->schoolB->id,
            'nama' => 'Kelas 8B Asli',
            'tingkat' => '8',
            'tahun_ajaran' => '2025/2026',
            'is_active' => true,
        ]);

        // Operator A tries to update Subject B -> 403 or 404
        $resSub = $this->actingAs($this->operatorA, 'sanctum')
            ->putJson("/api/attendance/subjects/{$subjectB->id}", [
                'nama' => 'Hacked Subject Name',
            ]);
        $this->assertTrue(in_array($resSub->status(), [403, 404], true));

        // Operator A tries to update Class B -> 403 or 404
        $resCls = $this->actingAs($this->operatorA, 'sanctum')
            ->putJson("/api/attendance/classes/{$classB->id}", [
                'nama' => 'Hacked Class Name',
            ]);
        $this->assertTrue(in_array($resCls->status(), [403, 404], true));

        // Verify DB unchanged
        $subjectB->refresh();
        $this->assertEquals('Bahasa Arab MTs B', $subjectB->nama);

        $classB->refresh();
        $this->assertEquals('Kelas 8B Asli', $classB->nama);
    }

    // ── AUTH-013: Student Import Duplicate NISN Immutability ──

    public function test_adv_13_student_import_duplicate_nisn_leaves_target_untouched(): void
    {
        $studentB = Student::withoutTenantScope()->create([
            'school_id' => $this->schoolB->id,
            'nama' => 'Santri Resmi Sekolah B',
            'nisn' => '7788990011',
            'kelas' => '1',
            'status' => 'Aktif',
        ]);

        // Operator A attempts to import the same NISN into School A
        $resImport = $this->actingAs($this->operatorA, 'sanctum')
            ->postJson('/api/students/import', [
                'students' => [
                    [
                        'nama' => 'Santri Pembajak A',
                        'nisn' => '7788990011',
                        'kelas' => '1',
                    ],
                ],
            ]);

        $resImport->assertStatus(200);
        $errors = $resImport->json('errors');
        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('Konflik Kepemilikan Data', $errors[0]['error']);

        // Assert Student B in database remained untouched
        $studentB->refresh();
        $this->assertEquals($this->schoolB->id, $studentB->school_id, 'Student B school ownership must remain immutable');
        $this->assertEquals('Santri Resmi Sekolah B', $studentB->nama);
    }
}
