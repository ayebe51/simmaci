<?php

namespace Tests\Unit\Services;

use App\Models\Meeting;
use App\Models\MeetingPhoto;
use App\Models\User;
use App\Services\MeetingPhotoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * MeetingPhotoServiceTest
 *
 * Unit tests for MeetingPhotoService
 *
 * **Validates: Requirements 34**
 */
class MeetingPhotoServiceTest extends TestCase
{
    use RefreshDatabase;

    private MeetingPhotoService $service;
    private Meeting $meeting;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->service = new MeetingPhotoService();
        $this->user = User::factory()->create();
        $this->meeting = Meeting::factory()->create(['created_by' => $this->user->id]);
    }

    /**
     * Test uploading a valid photo.
     */
    public function test_upload_photo_with_valid_file(): void
    {
        $file = UploadedFile::fake()->image('photo.jpg', 800, 600);

        $photo = $this->service->uploadPhoto($this->meeting, $file, $this->user);

        $this->assertInstanceOf(MeetingPhoto::class, $photo);
        $this->assertEquals($this->meeting->id, $photo->meeting_id);
        $this->assertEquals($this->user->id, $photo->uploaded_by);
        $this->assertNotNull($photo->storage_path);
        $this->assertNotNull($photo->thumbnail_path);
        $this->assertEquals(800, $photo->width);
        $this->assertEquals(600, $photo->height);
    }

    /**
     * Test uploading photo with invalid format.
     */
    public function test_upload_photo_with_invalid_format(): void
    {
        $file = UploadedFile::fake()->create('document.pdf', 100, 'application/pdf');

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Format file tidak didukung');

        $this->service->uploadPhoto($this->meeting, $file, $this->user);
    }

    /**
     * Test uploading photo exceeding size limit.
     */
    public function test_upload_photo_exceeding_size_limit(): void
    {
        // Create a file larger than 10MB
        $file = UploadedFile::fake()->image('large.jpg')->size(11 * 1024); // 11MB

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Ukuran file terlalu besar');

        $this->service->uploadPhoto($this->meeting, $file, $this->user);
    }

    /**
     * Test uploading photo when limit is reached.
     */
    public function test_upload_photo_exceeding_photo_count_limit(): void
    {
        // Create 50 photos
        for ($i = 0; $i < 50; $i++) {
            MeetingPhoto::factory()->create(['meeting_id' => $this->meeting->id]);
        }

        $file = UploadedFile::fake()->image('photo.jpg');

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Maksimal 50 foto per rapat');

        $this->service->uploadPhoto($this->meeting, $file, $this->user);
    }

    /**
     * Test deleting a photo.
     */
    public function test_delete_photo(): void
    {
        $photo = MeetingPhoto::factory()->create(['meeting_id' => $this->meeting->id]);

        $result = $this->service->deletePhoto($photo);

        $this->assertTrue($result);
        $this->assertSoftDeleted($photo);
    }

    /**
     * Test getting photos for a meeting.
     */
    public function test_get_photos(): void
    {
        $photos = MeetingPhoto::factory(3)->create(['meeting_id' => $this->meeting->id]);

        $result = $this->service->getPhotos($this->meeting);

        $this->assertCount(3, $result);
        $this->assertTrue($result->contains($photos[0]));
    }

    /**
     * Test getting gallery data.
     */
    public function test_get_gallery_data(): void
    {
        $photo = MeetingPhoto::factory()->create([
            'meeting_id' => $this->meeting->id,
            'uploaded_by' => $this->user->id,
        ]);

        $galleryData = $this->service->getGalleryData($this->meeting);

        $this->assertIsArray($galleryData);
        $this->assertCount(1, $galleryData);
        $this->assertEquals($photo->id, $galleryData[0]['id']);
        $this->assertEquals($photo->original_filename, $galleryData[0]['original_filename']);
        $this->assertArrayHasKey('photo_url', $galleryData[0]);
        $this->assertArrayHasKey('thumbnail_url', $galleryData[0]);
    }

    /**
     * Test getting photo count.
     */
    public function test_get_photo_count(): void
    {
        MeetingPhoto::factory(5)->create(['meeting_id' => $this->meeting->id]);

        $count = $this->service->getPhotoCount($this->meeting);

        $this->assertEquals(5, $count);
    }

    /**
     * Test downloading photos as ZIP.
     */
    public function test_download_photos_as_zip(): void
    {
        MeetingPhoto::factory(3)->create(['meeting_id' => $this->meeting->id]);

        $response = $this->service->downloadPhotosAsZip($this->meeting);

        $this->assertInstanceOf(\Symfony\Component\HttpFoundation\StreamedResponse::class, $response);
    }

    /**
     * Test downloading photos as ZIP when no photos exist.
     */
    public function test_download_photos_as_zip_with_no_photos(): void
    {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Tidak ada foto untuk diunduh');

        $this->service->downloadPhotosAsZip($this->meeting);
    }

    /**
     * Test uploading multiple photo formats.
     */
    public function test_upload_photo_with_different_formats(): void
    {
        $formats = ['jpg', 'png', 'webp', 'gif'];

        foreach ($formats as $format) {
            $file = UploadedFile::fake()->image("photo.{$format}");
            $photo = $this->service->uploadPhoto($this->meeting, $file, $this->user);

            $this->assertInstanceOf(MeetingPhoto::class, $photo);
        }
    }

    /**
     * Test photo metadata is correctly stored.
     */
    public function test_photo_metadata_stored_correctly(): void
    {
        $file = UploadedFile::fake()->image('test.jpg', 1024, 768);

        $photo = $this->service->uploadPhoto($this->meeting, $file, $this->user);

        $this->assertEquals('test.jpg', $photo->original_filename);
        $this->assertEquals(1024, $photo->width);
        $this->assertEquals(768, $photo->height);
        $this->assertNotNull($photo->file_size);
        $this->assertNotNull($photo->mime_type);
    }
}
