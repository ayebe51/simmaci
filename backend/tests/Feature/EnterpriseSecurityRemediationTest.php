<?php

namespace Tests\Feature;

use App\Models\AttendanceSetting;
use App\Models\Meeting;
use App\Models\MeetingMinutes;
use App\Models\School;
use App\Models\Setting;
use App\Models\User;
use App\Models\WaBlastConfig;
use App\Rules\SafeExternalUrl;
use App\Traits\SanitizesExportFormulas;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class EnterpriseSecurityRemediationTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $operator;
    private School $school;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->school = School::create([
            'nama'            => 'MI Ma\'arif Enterprise 01',
            'npsn'            => '12345678',
            'jenjang'         => 'MI',
            'status_sekolah'  => 'Swasta',
            'status_jamiyyah' => 'Jamiyyah',
            'kecamatan'       => 'Cilacap Selatan',
        ]);

        $this->superAdmin = User::create([
            'name'      => 'Super Admin',
            'email'     => 'superadmin@simmaci.test',
            'password'  => Hash::make('Password123!'),
            'role'      => 'super_admin',
            'is_active' => true,
        ]);

        $this->operator = User::create([
            'name'      => 'Operator School',
            'email'     => 'operator@simmaci.test',
            'password'  => Hash::make('Password123!'),
            'role'      => 'operator',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);
    }

    // ── 1. File Upload & MIME / Extension Whitelist ─────────────────────────────

    public function test_file_upload_rejects_disallowed_extensions(): void
    {
        $dangerousExtensions = ['svg', 'html', 'htm', 'php', 'phtml', 'phar', 'exe', 'sh'];

        foreach ($dangerousExtensions as $ext) {
            $file = UploadedFile::fake()->create("exploit.{$ext}", 100, 'text/plain');

            $response = $this->actingAs($this->operator)
                ->postJson('/api/files/upload', [
                    'file'   => $file,
                    'folder' => 'uploads',
                ]);

            $this->assertTrue(
                in_array($response->status(), [422, 400], true),
                "Expected file with extension .{$ext} to be rejected, received {$response->status()}"
            );
        }
    }

    public function test_file_upload_allows_safe_documents_and_images(): void
    {
        $safeFiles = [
            UploadedFile::fake()->create('document.pdf', 200, 'application/pdf'),
            UploadedFile::fake()->image('photo.png'),
            UploadedFile::fake()->image('photo.jpg'),
        ];

        foreach ($safeFiles as $file) {
            $response = $this->actingAs($this->operator)
                ->postJson('/api/files/upload', [
                    'file'   => $file,
                    'folder' => 'uploads',
                ]);

            $response->assertOk();
            $this->assertArrayHasKey('path', $response->json());
        }
    }

    public function test_file_upload_rejects_path_traversal_in_folder(): void
    {
        $file = UploadedFile::fake()->create('document.pdf', 200, 'application/pdf');

        $traversalFolders = ['../system', '..\\system', 'uploads/../../etc', '/etc/passwd'];

        foreach ($traversalFolders as $folder) {
            $response = $this->actingAs($this->operator)
                ->postJson('/api/files/upload', [
                    'file'   => $file,
                    'folder' => $folder,
                ]);

            $this->assertTrue(
                in_array($response->status(), [403, 422], true),
                "Expected folder '{$folder}' to be rejected, received {$response->status()}"
            );
        }
    }

    public function test_file_upload_rejects_non_admin_upload_to_protected_directories(): void
    {
        $file = UploadedFile::fake()->create('template.docx', 200, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        $protectedFolders = ['sk-templates', 'templates', 'backups', 'system'];

        foreach ($protectedFolders as $folder) {
            $response = $this->actingAs($this->operator)
                ->postJson('/api/files/upload', [
                    'file'   => $file,
                    'folder' => $folder,
                ]);

            $response->assertStatus(403);
        }
    }

    public function test_file_view_sets_nosniff_header_and_attachment_for_non_previewables(): void
    {
        Storage::disk('public')->put('test.docx', 'dummy docx content');

        $response = $this->actingAs($this->operator)
            ->get('/api/files/view/test.docx?disk=public');

        $response->assertOk();
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertStringContainsString('attachment', (string) $response->headers->get('Content-Disposition'));
    }

    // ── 2. Formula Injection (CSV / Excel DDE) ──────────────────────────────────

    public function test_formula_injection_is_neutralized_in_export_trait(): void
    {
        $helper = new class {
            use SanitizesExportFormulas;
            public function testSanitize($val) {
                return self::sanitizeFormula($val);
            }
        };

        $this->assertEquals("'=1+1", $helper->testSanitize("=1+1"));
        $this->assertEquals("'+SUM(A1:A10)", $helper->testSanitize("+SUM(A1:A10)"));
        $this->assertEquals("'-1+1", $helper->testSanitize("-1+1"));
        $this->assertEquals("'@cmd|' /C calc'!A0", $helper->testSanitize("@cmd|' /C calc'!A0"));
        $this->assertEquals("'\tTabExploit", $helper->testSanitize("\tTabExploit"));
        $this->assertEquals("'|PipeExploit", $helper->testSanitize("|PipeExploit"));

        // Benign string should remain intact
        $this->assertEquals("MI Ma'arif 01", $helper->testSanitize("MI Ma'arif 01"));
        $this->assertEquals(12345, $helper->testSanitize(12345));
    }

    // ── 3. Timing-Safe Scanner PIN Verification ─────────────────────────────────

    public function test_timing_safe_public_attendance_scanner_pin(): void
    {
        AttendanceSetting::create([
            'school_id'   => $this->school->id,
            'scanner_pin' => '998877',
        ]);

        // Wrong PIN
        $failRes = $this->postJson('/api/public/attendance/verify-pin', [
            'school_id' => $this->school->id,
            'pin'       => '111111',
        ]);
        $failRes->assertStatus(401);

        // Correct PIN
        $successRes = $this->postJson('/api/public/attendance/verify-pin', [
            'school_id' => $this->school->id,
            'pin'       => '998877',
        ]);
        $successRes->assertOk();
        $this->assertArrayHasKey('scanner_token', $successRes->json());
    }

    public function test_timing_safe_meeting_scanner_pin(): void
    {
        Setting::setValue('meeting_scanner_pin', 'PIN_MEET_123');

        // Wrong PIN
        $failRes = $this->postJson('/api/public/meetings/verify-pin', [
            'pin' => 'WRONG_PIN',
        ]);
        $failRes->assertStatus(401);

        // Correct PIN
        $successRes = $this->postJson('/api/public/meetings/verify-pin', [
            'pin' => 'PIN_MEET_123',
        ]);
        $successRes->assertOk();
    }

    // ── 4. Password Change & Session Invalidation ───────────────────────────────

    public function test_password_change_requires_minimum_8_characters(): void
    {
        $token = $this->operator->createToken('active-token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/auth/change-password', [
                'old_password' => 'Password123!',
                'new_password' => '12345', // only 5 characters
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('new_password');
    }

    public function test_password_change_revokes_other_active_session_tokens(): void
    {
        // Issue 3 tokens for operator
        $token1 = $this->operator->createToken('token-device-1');
        $token2 = $this->operator->createToken('token-device-2');
        $currentToken = $this->operator->createToken('current-token');

        $this->assertEquals(3, $this->operator->tokens()->count());

        // Change password using currentToken
        $response = $this->withHeader('Authorization', "Bearer {$currentToken->plainTextToken}")
            ->postJson('/api/auth/change-password', [
                'old_password' => 'Password123!',
                'new_password' => 'NewSecurePassword88!',
            ]);

        $response->assertOk();

        // Check tokens: only current token must remain, others revoked
        $remainingTokens = $this->operator->tokens()->get();
        $this->assertCount(1, $remainingTokens);
        $this->assertEquals($currentToken->accessToken->id, $remainingTokens->first()->id);
    }

    // ── 5. Meeting Minutes XSS Sanitization ─────────────────────────────────────

    public function test_meeting_minutes_sanitizes_scripts_and_event_handlers(): void
    {
        $meeting = Meeting::create([
            'title'      => 'Rapat Keamanan Informasi',
            'started_at' => now(),
            'ended_at'   => now()->addHours(2),
            'location'   => 'Ruang Pertemuan',
            'created_by' => $this->superAdmin->id,
        ]);

        $maliciousPayload = '<p>Pembahasan notulensi</p>' .
            '<script>alert("XSS")</script>' .
            '<img src="invalid" onerror="alert(1)" />' .
            '<a href="javascript:stealCookie()">Klik Disini</a>' .
            '<iframe src="http://evil.com"></iframe>';

        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/meetings/{$meeting->id}/minutes", [
                'title'   => 'Notulensi Rapat Keamanan',
                'content' => $maliciousPayload,
            ]);

        $response->assertCreated();

        $minutes = MeetingMinutes::where('meeting_id', $meeting->id)->first();
        $this->assertNotNull($minutes);

        // Verify script tags, onerror event handlers, javascript URIs, and iframes are stripped
        $this->assertStringNotContainsString('<script', $minutes->content);
        $this->assertStringNotContainsString('onerror', $minutes->content);
        $this->assertStringNotContainsString('javascript:', $minutes->content);
        $this->assertStringNotContainsString('<iframe', $minutes->content);
        $this->assertStringContainsString('Pembahasan notulensi', $minutes->content);
    }

    // ── 6. Outbound SSRF Protection (SafeExternalUrl) ───────────────────────────

    public function test_safe_external_url_rejects_ssrf_targets(): void
    {
        $rule = new SafeExternalUrl(allowLocalInTesting: false);

        // Testing direct validator with SSRF targets (simulate production check)
        $targets = [
            'http://169.254.169.254/latest/meta-data',
            'http://127.0.0.1:9000',
            'http://0.0.0.0:80',
            'ftp://example.com',
            'gopher://127.0.0.1:6379/_',
        ];

        foreach ($targets as $url) {
            $failed = false;
            $rule->validate('api_url', $url, function () use (&$failed) {
                $failed = true;
            });

            $this->assertTrue($failed, "Expected SSRF target '{$url}' to fail validation.");
        }
    }
}
