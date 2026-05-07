<?php

namespace Tests\Feature;

use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * MeetingControllerTest
 *
 * Integration tests for meeting CRUD operations and access control.
 * Requirements: Req 1, 2, 3, 7, 15, 16, 20, 21
 */
class MeetingControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $adminYayasan;
    private User $operator;
    private School $school1;
    private School $school2;

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
    }

    // ── Create Meeting Tests ──────────────────────────────────────────────────

    /**
     * Test super_admin can create a meeting
     */
    public function test_super_admin_can_create_meeting(): void
    {
        $data = [
            'title' => 'Rapat Koordinasi Kepala Sekolah',
            'agenda' => 'Pembahasan program semester',
            'location' => 'Aula LP Ma\'arif NU Cilacap',
            'started_at' => now()->addDays(7)->format('Y-m-d\TH:i:sP'),
            'ended_at' => now()->addDays(7)->addHours(4)->format('Y-m-d\TH:i:sP'),
            'school_ids' => [$this->school1->id, $this->school2->id],
            'geolocation_enabled' => false,
            'participants' => [
                [
                    'participant_type' => 'external',
                    'name' => 'Budi Santoso',
                    'jabatan' => 'Ketua Yayasan',
                    'instansi' => 'LP Ma\'arif NU Cilacap',
                    'phone_number' => '081234567890',
                ],
            ],
            'send_invitation_wa' => false,
            'send_reminder_wa' => false,
            'reminder_timing' => 'H-1',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/meetings', $data);

        $response->assertCreated();
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'id',
                'title',
                'location',
                'started_at',
                'ended_at',
            ],
        ]);

        $this->assertDatabaseHas('meetings', [
            'title' => 'Rapat Koordinasi Kepala Sekolah',
            'created_by' => $this->superAdmin->id,
        ]);
    }

    /**
     * Test admin_yayasan can create a meeting
     */
    public function test_admin_yayasan_can_create_meeting(): void
    {
        $data = [
            'title' => 'Rapat Yayasan',
            'location' => 'Aula',
            'started_at' => now()->addDays(7)->format('Y-m-d\TH:i:sP'),
            'ended_at' => now()->addDays(7)->addHours(2)->format('Y-m-d\TH:i:sP'),
            'school_ids' => [$this->school1->id],
            'geolocation_enabled' => false,
            'participants' => [
                [
                    'participant_type' => 'external',
                    'name' => 'Test',
                    'jabatan' => 'Test',
                    'instansi' => 'Test',
                    'phone_number' => '081234567890',
                ],
            ],
            'send_invitation_wa' => false,
            'send_reminder_wa' => false,
            'reminder_timing' => 'H-1',
        ];

        $response = $this->actingAs($this->adminYayasan)
            ->postJson('/api/meetings', $data);

        $response->assertCreated();
    }

    /**
     * Test operator cannot create a meeting
     */
    public function test_operator_cannot_create_meeting(): void
    {
        $data = [
            'title' => 'Rapat',
            'location' => 'Aula',
            'started_at' => now()->addDays(7)->format('Y-m-d\TH:i:sP'),
            'ended_at' => now()->addDays(7)->addHours(2)->format('Y-m-d\TH:i:sP'),
            'school_ids' => [$this->school1->id],
            'geolocation_enabled' => false,
            'participants' => [
                [
                    'participant_type' => 'external',
                    'name' => 'Test',
                    'jabatan' => 'Test',
                    'instansi' => 'Test',
                    'phone_number' => '081234567890',
                ],
            ],
            'send_invitation_wa' => false,
            'send_reminder_wa' => false,
            'reminder_timing' => 'H-1',
        ];

        $response = $this->actingAs($this->operator)
            ->postJson('/api/meetings', $data);

        $response->assertForbidden();
    }

    /**
     * Test validation: ended_at must be after started_at
     */
    public function test_validation_ended_at_must_be_after_started_at(): void
    {
        $data = [
            'title' => 'Rapat',
            'location' => 'Aula',
            'started_at' => now()->addDays(7)->format('Y-m-d\TH:i:sP'),
            'ended_at' => now()->addDays(6)->format('Y-m-d\TH:i:sP'),
            'school_ids' => [$this->school1->id],
            'geolocation_enabled' => false,
            'participants' => [
                [
                    'participant_type' => 'external',
                    'name' => 'Test',
                    'jabatan' => 'Test',
                    'instansi' => 'Test',
                    'phone_number' => '081234567890',
                ],
            ],
            'send_invitation_wa' => false,
            'send_reminder_wa' => false,
            'reminder_timing' => 'H-1',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/meetings', $data);

        $response->assertUnprocessable();
    }

    // ── List Meetings Tests ───────────────────────────────────────────────────

    /**
     * Test super_admin can see all meetings
     */
    public function test_super_admin_can_see_all_meetings(): void
    {
        $meeting1 = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);
        $meeting1->schools()->attach([$this->school1->id]);

        $meeting2 = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);
        $meeting2->schools()->attach([$this->school2->id]);

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/meetings');

        $response->assertOk();
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'items' => [
                    '*' => ['id', 'title', 'location'],
                ],
                'meta' => ['currentPage', 'lastPage', 'perPage', 'total'],
            ],
        ]);

        $this->assertGreaterThanOrEqual(2, $response->json('data.meta.total'));
    }

    /**
     * Test operator can only see meetings involving their school
     */
    public function test_operator_can_only_see_meetings_involving_their_school(): void
    {
        $meeting1 = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);
        $meeting1->schools()->attach([$this->school1->id]);

        $meeting2 = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);
        $meeting2->schools()->attach([$this->school2->id]);

        $response = $this->actingAs($this->operator)
            ->getJson('/api/meetings');

        $response->assertOk();

        $meetings = $response->json('data.items');
        $this->assertCount(1, $meetings);
        $this->assertEquals($meeting1->id, $meetings[0]['id']);
    }

    // ── Show Meeting Tests ────────────────────────────────────────────────────

    /**
     * Test super_admin can view any meeting
     */
    public function test_super_admin_can_view_any_meeting(): void
    {
        $meeting = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);
        $meeting->schools()->attach([$this->school1->id]);

        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/meetings/{$meeting->id}");

        $response->assertOk();
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'meeting' => ['id', 'title', 'location'],
                'attendance_stats' => ['total', 'present', 'absent'],
            ],
        ]);
    }

    /**
     * Test operator can only view meetings involving their school
     */
    public function test_operator_can_only_view_meetings_involving_their_school(): void
    {
        $meeting1 = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);
        $meeting1->schools()->attach([$this->school1->id]);

        $meeting2 = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);
        $meeting2->schools()->attach([$this->school2->id]);

        // Can view meeting involving their school
        $response = $this->actingAs($this->operator)
            ->getJson("/api/meetings/{$meeting1->id}");
        $response->assertOk();

        // Cannot view meeting not involving their school
        $response = $this->actingAs($this->operator)
            ->getJson("/api/meetings/{$meeting2->id}");
        $response->assertForbidden();
    }

    // ── Update Meeting Tests ──────────────────────────────────────────────────

    /**
     * Test super_admin can update a meeting
     */
    public function test_super_admin_can_update_meeting(): void
    {
        $meeting = Meeting::factory()->create([
            'created_by' => $this->superAdmin->id,
            'started_at' => now()->addDays(7),
        ]);

        $data = [
            'title' => 'Updated Title',
            'agenda' => 'Updated Agenda',
        ];

        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/meetings/{$meeting->id}", $data);

        $response->assertOk();
        $this->assertDatabaseHas('meetings', [
            'id' => $meeting->id,
            'title' => 'Updated Title',
            'agenda' => 'Updated Agenda',
        ]);
    }

    /**
     * Test operator cannot update a meeting
     */
    public function test_operator_cannot_update_meeting(): void
    {
        $meeting = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);
        $meeting->schools()->attach([$this->school1->id]);

        $data = ['title' => 'Updated Title'];

        $response = $this->actingAs($this->operator)
            ->putJson("/api/meetings/{$meeting->id}", $data);

        $response->assertForbidden();
    }

    // ── Delete Meeting Tests ──────────────────────────────────────────────────

    /**
     * Test super_admin can delete a meeting
     */
    public function test_super_admin_can_delete_meeting(): void
    {
        $meeting = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);

        $response = $this->actingAs($this->superAdmin)
            ->deleteJson("/api/meetings/{$meeting->id}");

        $response->assertOk();
        $this->assertSoftDeleted('meetings', ['id' => $meeting->id]);
    }

    /**
     * Test operator cannot delete a meeting
     */
    public function test_operator_cannot_delete_meeting(): void
    {
        $meeting = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);
        $meeting->schools()->attach([$this->school1->id]);

        $response = $this->actingAs($this->operator)
            ->deleteJson("/api/meetings/{$meeting->id}");

        $response->assertForbidden();
    }

    // ── Authentication Tests ──────────────────────────────────────────────────

    /**
     * Test unauthenticated access is denied
     */
    public function test_unauthenticated_access_is_denied(): void
    {
        $response = $this->getJson('/api/meetings');

        $response->assertUnauthorized();
    }
}
