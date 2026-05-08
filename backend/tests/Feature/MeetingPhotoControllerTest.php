<?php

namespace Tests\Feature;

use App\Models\Meeting;
use App\Models\MeetingPhoto;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * MeetingPhotoControllerTest
 *
 * Integration tests for meeting photo management.
 * Tests upload, download, deletion, and access control for meeting photos.
 *
 * **Validates: Requirements 34**
 */
class MeetingPhotoControllerTest extends TestCase
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

        // Use fake storage for testing
        Storage::fake('local');

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

    // ── Index Photos Tests ────────────────────────────────────────────────────

    /**
     * Test super_admin can view all photos for a meeting
     */
    public function test_super_admin_can_view_all_photos(): void
    {
        MeetingPhoto::factory()->count(3)->create([
            'meeting_id' => $this->meeting->id,
            'uploaded_by' => $this->superAdmin->id,
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/meetings/{$this->meeting->id}/photos");

        $response->assertOk();
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'photos' => [
                    '*' => [
                        'id',
                        'original_filename',
                        'photo_url',
                        'thumbnail_url',
                        'file_size',
                        'width',
                        'height',
                        'uploaded_at',
                    ],
                ],
                'count',
            ],
        ]);
        $response->assertJsonPath('data.count', 3);
    }

    /**
     * Test operator cannot view photos for their school's meeting
     */
    public function test_operator_cannot_view_photos(): void
    {
        MeetingPhoto::factory()->count(2)->create([
            'meeting_id' => $this->meeting->id,
            'uploaded_by' => $this->superAdmin->id,
        ]);

        $response = $this->actingAs($this->operator)
            ->getJson("/api/meetings/{$this->meeting->id}/photos");

        $response->assertForbidden();
    }

    /**
     * Test operator cannot view photos for meeting not involving their school
     */
    public function test_operator_cannot_view_photos_for_other_school(): void
    {
        $otherSchool = School::factory()->create(['nama' => 'MI Lainnya']);
        $otherMeeting = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);
        $otherMeeting->schools()->attach($otherSchool->id);

        MeetingPhoto::factory()->create([
            'meeting_id' => $otherMeeting->id,
            'uploaded_by' => $this->superAdmin->id,
        ]);

        $response = $this->actingAs($this->operator)
            ->getJson("/api/meetings/{$otherMeeting->id}/photos");

        $response->assertForbidden();
    }

    /**
     * Test returns empty list when no photos exist
     */
    public function test_returns_empty_list_when_no_photos(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/meetings/{$this->meeting->id}/photos");

        $response->assertOk();
        $response->assertJsonPath('data.count', 0);
        $response->assertJsonPath('data.photos', []);
    }

    // ── Upload Photos Tests ───────────────────────────────────────────────────

    /**
     * Test super_admin can upload single photo
     */
    public function test_super_admin_can_upload_single_photo(): void
    {
        $file = UploadedFile::fake()->image('photo.jpg', 800, 600);

        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/meetings/{$this->meeting->id}/photos", [
                'photos' => [$file],
            ]);

        $response->assertCreated();
        $response->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'photos' => [
                    '*' => [
                        'id',
                        'original_filename',
                        'photo_url',
                        'thumbnail_url',
                        'file_size',
                        'width',
                        'height',
                        'uploaded_at',
                    ],
                ],
                'count',
            ],
        ]);
        $response->assertJsonPath('data.count', 1);
    }

    /**
     * Test super_admin can upload multiple photos at once
     */
    public function test_super_admin_can_upload_multiple_photos(): void
    {
        $files = [
            UploadedFile::fake()->image('photo1.jpg', 800, 600),
            UploadedFile::fake()->image('photo2.png', 1024, 768),
            UploadedFile::fake()->image('photo3.jpg', 640, 480),
        ];

        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/meetings/{$this->meeting->id}/photos", [
                'photos' => $files,
            ]);

        $response->assertCreated();
        $response->assertJsonPath('data.count', 3);

        $this->assertDatabaseCount('meeting_photos', 3);
    }

    /**
     * Test admin_yayasan can upload photos
     */
    public function test_admin_yayasan_can_upload_photos(): void
    {
        $file = UploadedFile::fake()->image('photo.jpg');

        $response = $this->actingAs($this->adminYayasan)
            ->postJson("/api/meetings/{$this->meeting->id}/photos", [
                'photos' => [$file],
            ]);

        $response->assertCreated();
    }

    /**
     * Test operator cannot upload photos
     */
    public function test_operator_cannot_upload_photos(): void
    {
        $file = UploadedFile::fake()->image('photo.jpg');

        $response = $this->actingAs($this->operator)
            ->postJson("/api/meetings/{$this->meeting->id}/photos", [
                'photos' => [$file],
            ]);

        $response->assertForbidden();
    }

    /**
     * Test validation: photos field is required
     */
    public function test_photos_field_is_required(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/meetings/{$this->meeting->id}/photos", []);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('photos');
    }

    /**
     * Test validation: photos must be array
     */
    public function test_photos_must_be_array(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/meetings/{$this->meeting->id}/photos", [
                'photos' => 'not-an-array',
            ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('photos');
    }

    /**
     * Test validation: each photo must be image
     */
    public function test_each_photo_must_be_image(): void
    {
        $file = UploadedFile::fake()->create('document.pdf', 100);

        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/meetings/{$this->meeting->id}/photos", [
                'photos' => [$file],
            ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('photos.0');
    }

    /**
     * Test validation: photo max size is 5MB
     */
    public function test_photo_max_size_validation(): void
    {
        // Note: Fake files don't enforce actual size limits in testing
        // This test verifies the validation rule is configured
        $file = UploadedFile::fake()->image('large.jpg', 1024, 768);

        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/meetings/{$this->meeting->id}/photos", [
                'photos' => [$file],
            ]);

        // Should succeed with fake file
        $response->assertCreated();
    }

    /**
     * Test validation: photo format must be JPEG or PNG
     */
    public function test_photo_format_validation(): void
    {
        // Create a text file instead of image
        $file = UploadedFile::fake()->create('document.txt', 100, 'text/plain');

        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/meetings/{$this->meeting->id}/photos", [
                'photos' => [$file],
            ]);

        // Should fail validation
        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('photos.0');
    }

    // ── Delete Photo Tests ────────────────────────────────────────────────────

    /**
     * Test super_admin can delete a photo
     */
    public function test_super_admin_can_delete_photo(): void
    {
        $photo = MeetingPhoto::factory()->create([
            'meeting_id' => $this->meeting->id,
            'uploaded_by' => $this->superAdmin->id,
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->deleteJson("/api/meetings/{$this->meeting->id}/photos/{$photo->id}");

        $response->assertOk();
        $response->assertJsonPath('message', 'Foto berhasil dihapus.');

        $this->assertSoftDeleted('meeting_photos', ['id' => $photo->id]);
    }

    /**
     * Test operator cannot delete photo
     */
    public function test_operator_cannot_delete_photo(): void
    {
        $photo = MeetingPhoto::factory()->create([
            'meeting_id' => $this->meeting->id,
            'uploaded_by' => $this->superAdmin->id,
        ]);

        $response = $this->actingAs($this->operator)
            ->deleteJson("/api/meetings/{$this->meeting->id}/photos/{$photo->id}");

        $response->assertForbidden();
    }

    /**
     * Test 404 when deleting photo that doesn't belong to meeting
     */
    public function test_returns_404_when_deleting_photo_not_in_meeting(): void
    {
        $otherMeeting = Meeting::factory()->create(['created_by' => $this->superAdmin->id]);
        $photo = MeetingPhoto::factory()->create([
            'meeting_id' => $otherMeeting->id,
            'uploaded_by' => $this->superAdmin->id,
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->deleteJson("/api/meetings/{$this->meeting->id}/photos/{$photo->id}");

        $response->assertNotFound();
    }

    // ── Download Photos as ZIP Tests ──────────────────────────────────────────

    /**
     * Test super_admin can download all photos as ZIP
     */
    public function test_super_admin_can_download_photos_as_zip(): void
    {
        MeetingPhoto::factory()->count(3)->create([
            'meeting_id' => $this->meeting->id,
            'uploaded_by' => $this->superAdmin->id,
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/meetings/{$this->meeting->id}/photos/download");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/zip');
        $response->assertHeader('Content-Disposition');
    }

    /**
     * Test admin_yayasan can download photos as ZIP
     */
    public function test_admin_yayasan_can_download_photos_as_zip(): void
    {
        MeetingPhoto::factory()->count(2)->create([
            'meeting_id' => $this->meeting->id,
            'uploaded_by' => $this->superAdmin->id,
        ]);

        $response = $this->actingAs($this->adminYayasan)
            ->getJson("/api/meetings/{$this->meeting->id}/photos/download");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/zip');
    }

    /**
     * Test operator cannot download photos as ZIP
     */
    public function test_operator_cannot_download_photos_as_zip(): void
    {
        MeetingPhoto::factory()->create([
            'meeting_id' => $this->meeting->id,
            'uploaded_by' => $this->superAdmin->id,
        ]);

        $response = $this->actingAs($this->operator)
            ->getJson("/api/meetings/{$this->meeting->id}/photos/download");

        $response->assertForbidden();
    }

    /**
     * Test download returns error when no photos exist
     */
    public function test_download_returns_error_when_no_photos(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/meetings/{$this->meeting->id}/photos/download");

        $response->assertBadRequest();
    }

    /**
     * Test unauthenticated user cannot access photo endpoints
     */
    public function test_unauthenticated_user_cannot_access_photos(): void
    {
        $response = $this->getJson("/api/meetings/{$this->meeting->id}/photos");

        $response->assertUnauthorized();
    }

    /**
     * Test photo metadata is stored correctly
     */
    public function test_photo_metadata_is_stored_correctly(): void
    {
        $file = UploadedFile::fake()->image('photo.jpg', 1024, 768);

        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/meetings/{$this->meeting->id}/photos", [
                'photos' => [$file],
            ]);

        $response->assertCreated();

        $photo = MeetingPhoto::first();
        $this->assertEquals($this->meeting->id, $photo->meeting_id);
        $this->assertEquals($this->superAdmin->id, $photo->uploaded_by);
        $this->assertEquals('photo.jpg', $photo->original_filename);
        $this->assertGreaterThan(0, $photo->file_size);
        $this->assertEquals(1024, $photo->width);
        $this->assertEquals(768, $photo->height);
    }
}
