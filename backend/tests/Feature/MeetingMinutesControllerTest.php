<?php

namespace Tests\Feature;

use App\Models\Meeting;
use App\Models\MeetingMinutes;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * MeetingMinutesControllerTest
 *
 * Integration tests for meeting minutes (notulensi) management.
 * Tests CRUD operations, access control, and HTML content handling.
 *
 * **Validates: Requirements 33**
 */
class MeetingMinutesControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $adminYayasan;
    private User $operator;
    private School $school1;
    private School $school2;
    private Meeting $meeting;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test schools
        $this->school1 = School::factory()->create(['nama' => 'MI Darwata']);
        $this->school2 = School::factory()->create(['nama' => 'SMP NU Cilacap']);

        // Create users
        $this->superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'email' => 'admin@test.com',
            'is_active' => true,
        ]);

        $this->adminYayasan = User::factory()->create([
            'role' => 'admin_yayasan',
            'email' => 'yayasan@test.com',
            'is_active' => true,
        ]);

        $this->operator = User::factory()->create([
            'role' => 'operator',
            'email' => 'operator@test.com',
            'school_id' => $this->school1->id,
            'is_active' => true,
        ]);

        // Create a test meeting
        $this->meeting = Meeting::factory()->create([
            'created_by' => $this->superAdmin->id,
        ]);

        // Attach schools to meeting
        $this->meeting->schools()->attach([$this->school1->id, $this->school2->id]);
    }

    // ── Show Minutes Tests ────────────────────────────────────────────────────

    /**
     * Test super_admin can view meeting minutes
     */
    public function test_super_admin_can_view_meeting_minutes(): void
    {
        $minutes = MeetingMinutes::factory()->create([
            'meeting_id' => $this->meeting->id,
            'created_by' => $this->superAdmin->id,
            'title' => 'Notulensi Rapat Koordinasi',
            'content' => '<p>Hasil rapat: Pembahasan program semester genap</p>',
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/meetings/{$this->meeting->id}/minutes");

        $response->assertOk();
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'id',
                'meeting_id',
                'title',
                'content',
                'created_by',
                'created_at',
            ],
        ]);
        $response->assertJsonPath('data.title', 'Notulensi Rapat Koordinasi');
    }

    /**
     * Test operator cannot view meeting minutes (read-only access not allowed for minutes)
     */
    public function test_operator_cannot_view_minutes(): void
    {
        $minutes = MeetingMinutes::factory()->create([
            'meeting_id' => $this->meeting->id,
            'created_by' => $this->superAdmin->id,
        ]);

        $response = $this->actingAs($this->operator)
            ->getJson("/api/meetings/{$this->meeting->id}/minutes");

        $response->assertForbidden();
    }

    /**
     * Test operator cannot view minutes for meeting not involving their school
     */
    public function test_operator_cannot_view_minutes_for_other_school(): void
    {
        $otherSchool = School::factory()->create(['nama' => 'MI Lainnya']);
        $otherMeeting = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);
        $otherMeeting->schools()->attach($otherSchool->id);

        MeetingMinutes::factory()->create([
            'meeting_id' => $otherMeeting->id,
            'created_by' => $this->superAdmin->id,
        ]);

        $response = $this->actingAs($this->operator)
            ->getJson("/api/meetings/{$otherMeeting->id}/minutes");

        $response->assertForbidden();
    }

    /**
     * Test 404 when minutes don't exist
     */
    public function test_returns_404_when_minutes_not_exist(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/meetings/{$this->meeting->id}/minutes");

        $response->assertNotFound();
        $response->assertJsonPath('message', 'Notulensi untuk rapat ini belum ada.');
    }

    // ── Create Minutes Tests ──────────────────────────────────────────────────

    /**
     * Test super_admin can create meeting minutes
     */
    public function test_super_admin_can_create_minutes(): void
    {
        $data = [
            'title' => 'Notulensi Rapat Koordinasi',
            'content' => '<h2>Hasil Rapat</h2><p>Pembahasan program semester genap</p><ul><li>Item 1</li><li>Item 2</li></ul>',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/meetings/{$this->meeting->id}/minutes", $data);

        $response->assertCreated();
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'id',
                'meeting_id',
                'title',
                'content',
                'created_by',
                'created_at',
            ],
        ]);
        $response->assertJsonPath('data.title', 'Notulensi Rapat Koordinasi');

        $this->assertDatabaseHas('meeting_minutes', [
            'meeting_id' => $this->meeting->id,
            'title' => 'Notulensi Rapat Koordinasi',
        ]);
    }

    /**
     * Test admin_yayasan can create meeting minutes
     */
    public function test_admin_yayasan_can_create_minutes(): void
    {
        $data = [
            'title' => 'Notulensi Rapat',
            'content' => '<p>Konten notulensi</p>',
        ];

        $response = $this->actingAs($this->adminYayasan)
            ->postJson("/api/meetings/{$this->meeting->id}/minutes", $data);

        $response->assertCreated();
    }

    /**
     * Test operator cannot create meeting minutes
     */
    public function test_operator_cannot_create_minutes(): void
    {
        $data = [
            'title' => 'Notulensi Rapat',
            'content' => '<p>Konten notulensi</p>',
        ];

        $response = $this->actingAs($this->operator)
            ->postJson("/api/meetings/{$this->meeting->id}/minutes", $data);

        $response->assertForbidden();
    }

    /**
     * Test validation: title is optional but can be provided
     */
    public function test_title_is_optional_when_creating_minutes(): void
    {
        $data = [
            'content' => '<p>Konten notulensi</p>',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/meetings/{$this->meeting->id}/minutes", $data);

        $response->assertCreated();
    }

    /**
     * Test validation: content is required
     */
    public function test_content_is_required_when_creating_minutes(): void
    {
        $data = [
            'title' => 'Notulensi Rapat',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/meetings/{$this->meeting->id}/minutes", $data);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('content');
    }

    /**
     * Test validation: title max length
     */
    public function test_title_max_length_validation(): void
    {
        $data = [
            'title' => str_repeat('a', 256),
            'content' => '<p>Konten notulensi</p>',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/meetings/{$this->meeting->id}/minutes", $data);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('title');
    }

    // ── Update Minutes Tests ──────────────────────────────────────────────────

    /**
     * Test super_admin can update meeting minutes
     */
    public function test_super_admin_can_update_minutes(): void
    {
        $minutes = MeetingMinutes::factory()->create([
            'meeting_id' => $this->meeting->id,
            'created_by' => $this->superAdmin->id,
            'title' => 'Notulensi Lama',
            'content' => '<p>Konten lama</p>',
        ]);

        $data = [
            'title' => 'Notulensi Baru',
            'content' => '<p>Konten baru yang diperbarui</p>',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/meetings/{$this->meeting->id}/minutes/{$minutes->id}", $data);

        $response->assertOk();
        $response->assertJsonPath('data.title', 'Notulensi Baru');

        $this->assertDatabaseHas('meeting_minutes', [
            'id' => $minutes->id,
            'title' => 'Notulensi Baru',
            'content' => '<p>Konten baru yang diperbarui</p>',
        ]);
    }

    /**
     * Test operator cannot update meeting minutes
     */
    public function test_operator_cannot_update_minutes(): void
    {
        $minutes = MeetingMinutes::factory()->create([
            'meeting_id' => $this->meeting->id,
            'created_by' => $this->superAdmin->id,
        ]);

        $data = [
            'title' => 'Notulensi Baru',
            'content' => '<p>Konten baru</p>',
        ];

        $response = $this->actingAs($this->operator)
            ->putJson("/api/meetings/{$this->meeting->id}/minutes/{$minutes->id}", $data);

        $response->assertForbidden();
    }

    /**
     * Test 404 when updating minutes that don't belong to meeting
     */
    public function test_returns_404_when_updating_minutes_not_in_meeting(): void
    {
        $otherMeeting = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);
        $minutes = MeetingMinutes::factory()->create([
            'meeting_id' => $otherMeeting->id,
            'created_by' => $this->superAdmin->id,
        ]);

        $data = [
            'title' => 'Notulensi Baru',
            'content' => '<p>Konten baru</p>',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/meetings/{$this->meeting->id}/minutes/{$minutes->id}", $data);

        $response->assertNotFound();
    }

    // ── Delete Minutes Tests ──────────────────────────────────────────────────

    /**
     * Test super_admin can delete meeting minutes
     */
    public function test_super_admin_can_delete_minutes(): void
    {
        $minutes = MeetingMinutes::factory()->create([
            'meeting_id' => $this->meeting->id,
            'created_by' => $this->superAdmin->id,
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->deleteJson("/api/meetings/{$this->meeting->id}/minutes/{$minutes->id}");

        $response->assertOk();
        $response->assertJsonPath('message', 'Notulensi berhasil dihapus.');

        $this->assertSoftDeleted('meeting_minutes', ['id' => $minutes->id]);
    }

    /**
     * Test operator cannot delete meeting minutes
     */
    public function test_operator_cannot_delete_minutes(): void
    {
        $minutes = MeetingMinutes::factory()->create([
            'meeting_id' => $this->meeting->id,
            'created_by' => $this->superAdmin->id,
        ]);

        $response = $this->actingAs($this->operator)
            ->deleteJson("/api/meetings/{$this->meeting->id}/minutes/{$minutes->id}");

        $response->assertForbidden();
    }

    /**
     * Test 404 when deleting minutes that don't belong to meeting
     */
    public function test_returns_404_when_deleting_minutes_not_in_meeting(): void
    {
        $otherMeeting = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);
        $minutes = MeetingMinutes::factory()->create([
            'meeting_id' => $otherMeeting->id,
            'created_by' => $this->superAdmin->id,
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->deleteJson("/api/meetings/{$this->meeting->id}/minutes/{$minutes->id}");

        $response->assertNotFound();
    }

    // ── HTML Content Tests ────────────────────────────────────────────────────

    /**
     * Test minutes can store complex HTML content
     */
    public function test_minutes_can_store_complex_html_content(): void
    {
        $htmlContent = <<<'HTML'
<h2>Hasil Rapat</h2>
<p>Pembahasan program semester genap</p>
<h3>Keputusan:</h3>
<ul>
    <li>Implementasi kurikulum baru</li>
    <li>Peningkatan fasilitas pembelajaran</li>
    <li>Program pengembangan guru</li>
</ul>
<h3>Tindak Lanjut:</h3>
<ol>
    <li>Koordinasi dengan kepala sekolah</li>
    <li>Penyusunan rencana aksi</li>
    <li>Monitoring dan evaluasi</li>
</ol>
HTML;

        $data = [
            'title' => 'Notulensi Rapat Koordinasi',
            'content' => $htmlContent,
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/meetings/{$this->meeting->id}/minutes", $data);

        $response->assertCreated();

        $this->assertDatabaseHas('meeting_minutes', [
            'meeting_id' => $this->meeting->id,
            'content' => $htmlContent,
        ]);
    }

    /**
     * Test unauthenticated user cannot access minutes endpoints
     */
    public function test_unauthenticated_user_cannot_access_minutes(): void
    {
        $response = $this->getJson("/api/meetings/{$this->meeting->id}/minutes");

        $response->assertUnauthorized();
    }
}
