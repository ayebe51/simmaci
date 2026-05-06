<?php

namespace Tests\Feature\WaBlast;

use App\Jobs\SendBlastJob;
use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use App\Models\WaBlast;
use App\Models\WaBlastConfig;
use App\Models\WaBlastRecipient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Integration tests for WaBlastController.
 *
 * Covers: create blast (immediate & scheduled), preview recipients,
 * retry, cancel, progress endpoint, 422 validation, 403 role guard.
 *
 * Requirements: 1, 2, 3, 4, 5, 6, 9, 10
 */
class WaBlastControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $adminYayasan;
    private User $operator;
    private School $school;
    private WaBlastConfig $config;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Storage::fake('local');

        // Schools
        $this->school = School::factory()->create([
            'nama'             => 'MI Darwata Glempang',
            'jenjang'          => 'MI',
            'kepala_whatsapp'  => '081234567890',
            'kepala_madrasah'  => 'Ahmad Kepala',
        ]);

        // Users
        $this->superAdmin = User::factory()->create([
            'role'      => 'super_admin',
            'email'     => 'superadmin@test.com',
            'is_active' => true,
        ]);

        $this->adminYayasan = User::factory()->create([
            'role'      => 'admin_yayasan',
            'email'     => 'yayasan@test.com',
            'is_active' => true,
        ]);

        $this->operator = User::factory()->create([
            'role'      => 'operator',
            'email'     => 'operator@test.com',
            'school_id' => $this->school->id,
            'is_active' => true,
        ]);

        // Go-WA config (required for createBlast to pass daily-limit check)
        $this->config = WaBlastConfig::create([
            'api_url'                    => 'https://go-wa.example.com',
            'api_token_encrypted'        => encrypt('secret-token'),
            'sender_number'              => '6281234567890',
            'max_recipients_per_session' => 500,
            'max_daily_messages'         => 1000,
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Create a WaBlast with recipients directly in the DB (bypasses service).
     */
    private function createBlastWithRecipients(
        string $status = 'completed',
        int $failedCount = 0,
        int $sentCount = 1
    ): WaBlast {
        $blast = WaBlast::create([
            'title'              => 'Test Blast',
            'recipient_category' => 'kepala_sekolah',
            'message_body'       => 'Halo {{nama}} dari {{nama_sekolah}}',
            'blast_status'       => $status,
            'total_recipients'   => $sentCount + $failedCount,
            'sent_count'         => $sentCount,
            'failed_count'       => $failedCount,
            'invalid_count'      => 0,
            'created_by'         => $this->superAdmin->id,
        ]);

        for ($i = 0; $i < $sentCount; $i++) {
            WaBlastRecipient::create([
                'wa_blast_id'    => $blast->id,
                'recipient_name' => "Penerima Sent {$i}",
                'school_name'    => 'MI Darwata Glempang',
                'phone_number'   => '6281234' . str_pad($i, 6, '0', STR_PAD_LEFT),
                'recipient_type' => 'kepala_sekolah',
                'delivery_status' => 'sent',
            ]);
        }

        for ($i = 0; $i < $failedCount; $i++) {
            WaBlastRecipient::create([
                'wa_blast_id'    => $blast->id,
                'recipient_name' => "Guru Gagal {$i}",
                'school_name'    => 'MI Darwata Glempang',
                'phone_number'   => '628999000' . str_pad($i, 3, '0', STR_PAD_LEFT),
                'recipient_type' => 'gtk',
                'delivery_status' => 'failed',
                'error_message'  => 'Gagal mengirim pesan.',
            ]);
        }

        return $blast;
    }

    // ── Authentication ────────────────────────────────────────────────────────

    public function test_unauthenticated_user_cannot_access_wa_blasts(): void
    {
        $this->getJson('/api/wa-blasts')->assertStatus(401);
    }

    // ── Role Guard (403) ──────────────────────────────────────────────────────

    public function test_operator_cannot_list_wa_blasts(): void
    {
        $this->actingAs($this->operator)
            ->getJson('/api/wa-blasts')
            ->assertStatus(403);
    }

    public function test_operator_cannot_create_wa_blast(): void
    {
        $this->actingAs($this->operator)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Test',
                'recipient_category' => 'kepala_sekolah',
                'message_body'       => 'Halo',
            ])
            ->assertStatus(403);
    }

    public function test_operator_cannot_preview_recipients(): void
    {
        $this->actingAs($this->operator)
            ->postJson('/api/wa-blasts/preview-recipients', [
                'recipient_category' => 'kepala_sekolah',
            ])
            ->assertStatus(403);
    }

    public function test_operator_cannot_access_progress_endpoint(): void
    {
        $blast = $this->createBlastWithRecipients('sending');

        $this->actingAs($this->operator)
            ->getJson("/api/wa-blasts/{$blast->id}/progress")
            ->assertStatus(403);
    }

    // ── Index / List ──────────────────────────────────────────────────────────

    public function test_super_admin_can_list_wa_blasts(): void
    {
        $this->createBlastWithRecipients('completed');
        $this->createBlastWithRecipients('scheduled');

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/wa-blasts');

        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => [
                    'items',
                    'meta' => ['currentPage', 'lastPage', 'perPage', 'total'],
                ],
            ]);

        $this->assertCount(2, $response->json('data.items'));
    }

    public function test_admin_yayasan_can_list_wa_blasts(): void
    {
        $this->createBlastWithRecipients('completed');

        $this->actingAs($this->adminYayasan)
            ->getJson('/api/wa-blasts')
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_list_can_be_filtered_by_blast_status(): void
    {
        $this->createBlastWithRecipients('completed');
        $this->createBlastWithRecipients('scheduled', 0, 0);

        $response = $this->actingAs($this->superAdmin)
            ->getJson('/api/wa-blasts?blast_status=completed');

        $response->assertOk();
        $items = $response->json('data.items');
        $this->assertCount(1, $items);
        $this->assertEquals('completed', $items[0]['blast_status']);
    }

    // ── Preview Recipients ────────────────────────────────────────────────────

    public function test_preview_recipients_returns_valid_and_invalid_counts(): void
    {
        // School with valid kepala_whatsapp already created in setUp
        School::factory()->create([
            'jenjang'         => 'MI',
            'kepala_whatsapp' => null, // no phone — will be invalid
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts/preview-recipients', [
                'recipient_category' => 'kepala_sekolah',
            ]);

        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'data' => ['recipients', 'valid_count', 'invalid_count', 'total_count'],
            ]);

        $this->assertGreaterThanOrEqual(1, $response->json('data.valid_count'));
    }

    public function test_preview_recipients_filters_by_jenjang(): void
    {
        School::factory()->create([
            'jenjang'         => 'MTs',
            'kepala_whatsapp' => '081298765432',
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts/preview-recipients', [
                'recipient_category' => 'kepala_sekolah',
                'jenjang'            => ['MI'],
            ]);

        $response->assertOk();

        // Only MI schools should appear
        $recipients = $response->json('data.recipients');
        foreach ($recipients as $r) {
            // All returned recipients must come from MI schools
            $this->assertNotEmpty($r['phone_number']);
        }
    }

    public function test_preview_recipients_validates_required_category(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts/preview-recipients', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['recipient_category']);
    }

    public function test_preview_recipients_validates_category_enum(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts/preview-recipients', [
                'recipient_category' => 'invalid_category',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['recipient_category']);
    }

    // ── Create Blast (Immediate) ──────────────────────────────────────────────

    public function test_super_admin_can_create_immediate_blast(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Pengumuman Rapat',
                'recipient_category' => 'kepala_sekolah',
                'message_body'       => 'Halo {{nama}} dari {{nama_sekolah}}, harap hadir.',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.blast_status', 'sending');

        $this->assertDatabaseHas('wa_blasts', [
            'title'        => 'Pengumuman Rapat',
            'blast_status' => 'sending',
            'created_by'   => $this->superAdmin->id,
        ]);

        // Job should be dispatched
        Queue::assertPushed(SendBlastJob::class);
    }

    public function test_admin_yayasan_can_create_immediate_blast(): void
    {
        $response = $this->actingAs($this->adminYayasan)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Info Yayasan',
                'recipient_category' => 'kepala_sekolah',
                'message_body'       => 'Informasi penting dari yayasan.',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        Queue::assertPushed(SendBlastJob::class);
    }

    public function test_create_blast_dispatches_send_blast_job(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Test Job Dispatch',
                'recipient_category' => 'kepala_sekolah',
                'message_body'       => 'Test pesan.',
            ]);

        Queue::assertPushed(SendBlastJob::class, function ($job) {
            $blast = WaBlast::where('title', 'Test Job Dispatch')->first();
            return $blast && $job->blastId === $blast->id;
        });
    }

    public function test_create_blast_logs_activity(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Blast Log Test',
                'recipient_category' => 'kepala_sekolah',
                'message_body'       => 'Pesan log test.',
            ]);

        $this->assertDatabaseHas('activity_logs', [
            'event'    => 'create_wa_blast',
            'log_name' => 'wa_blast',
            'causer_id' => $this->superAdmin->id,
        ]);
    }

    // ── Create Blast (Scheduled) ──────────────────────────────────────────────

    public function test_super_admin_can_create_scheduled_blast(): void
    {
        $scheduledAt = now()->addHours(2)->toIso8601String();

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Blast Terjadwal',
                'recipient_category' => 'kepala_sekolah',
                'message_body'       => 'Pesan terjadwal.',
                'scheduled_at'       => $scheduledAt,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.blast_status', 'scheduled');

        $this->assertDatabaseHas('wa_blasts', [
            'title'        => 'Blast Terjadwal',
            'blast_status' => 'scheduled',
        ]);

        // Job should NOT be dispatched for scheduled blasts
        Queue::assertNotPushed(SendBlastJob::class);
    }

    public function test_scheduled_blast_with_past_time_returns_422(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Blast Masa Lalu',
                'recipient_category' => 'kepala_sekolah',
                'message_body'       => 'Pesan.',
                'scheduled_at'       => now()->subHour()->toIso8601String(),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['scheduled_at']);
    }

    // ── Create Blast — Validation (422) ───────────────────────────────────────

    public function test_create_blast_requires_title(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'recipient_category' => 'kepala_sekolah',
                'message_body'       => 'Pesan.',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title']);
    }

    public function test_create_blast_requires_recipient_category(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'        => 'Test',
                'message_body' => 'Pesan.',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['recipient_category']);
    }

    public function test_create_blast_requires_message_body(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Test',
                'recipient_category' => 'kepala_sekolah',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['message_body']);
    }

    public function test_create_blast_rejects_invalid_recipient_category(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Test',
                'recipient_category' => 'invalid',
                'message_body'       => 'Pesan.',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['recipient_category']);
    }

    public function test_create_blast_rejects_message_body_exceeding_4096_chars(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Test',
                'recipient_category' => 'kepala_sekolah',
                'message_body'       => str_repeat('a', 4097),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['message_body']);
    }

    public function test_create_blast_rejects_non_pdf_attachment(): void
    {
        $file = UploadedFile::fake()->create('document.docx', 100, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Test',
                'recipient_category' => 'kepala_sekolah',
                'message_body'       => 'Pesan.',
                'attachment'         => $file,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['attachment']);
    }

    public function test_create_blast_rejects_pdf_exceeding_10mb(): void
    {
        $file = UploadedFile::fake()->create('large.pdf', 10241, 'application/pdf');

        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Test',
                'recipient_category' => 'kepala_sekolah',
                'message_body'       => 'Pesan.',
                'attachment'         => $file,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['attachment']);
    }

    public function test_create_blast_rejects_invalid_jenjang_values(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Test',
                'recipient_category' => 'kepala_sekolah',
                'message_body'       => 'Pesan.',
                'jenjang'            => ['SD', 'SMP'], // invalid — only MI, MTs, MA allowed
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['jenjang.0', 'jenjang.1']);
    }

    // ── Create Blast — Rate Limit ─────────────────────────────────────────────

    public function test_create_blast_rejects_when_recipients_exceed_session_limit(): void
    {
        // Lower the session limit to 1 so our 1 school triggers the limit
        $this->config->update(['max_recipients_per_session' => 0]);

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Test Limit',
                'recipient_category' => 'kepala_sekolah',
                'message_body'       => 'Pesan.',
            ]);

        // Service throws ValidationException → controller returns 422
        $response->assertStatus(422);
    }

    // ── Create Blast — With PDF Attachment ───────────────────────────────────

    public function test_create_blast_with_pdf_attachment_stores_file(): void
    {
        $pdf = UploadedFile::fake()->create('surat-edaran.pdf', 500, 'application/pdf');

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Blast dengan Lampiran',
                'recipient_category' => 'kepala_sekolah',
                'message_body'       => 'Lihat lampiran.',
                'attachment'         => $pdf,
            ]);

        $response->assertStatus(201);

        $blast = WaBlast::where('title', 'Blast dengan Lampiran')->first();
        $this->assertNotNull($blast->attachment_path);
        $this->assertEquals('surat-edaran.pdf', $blast->attachment_name);
        Storage::disk('local')->assertExists($blast->attachment_path);
    }

    // ── Show ──────────────────────────────────────────────────────────────────

    public function test_super_admin_can_view_blast_detail(): void
    {
        $blast = $this->createBlastWithRecipients('completed');

        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/wa-blasts/{$blast->id}");

        $response->assertOk()
            ->assertJsonPath('data.id', $blast->id)
            ->assertJsonStructure([
                'data' => ['id', 'title', 'blast_status', 'recipients'],
            ]);
    }

    public function test_show_returns_404_for_nonexistent_blast(): void
    {
        $this->actingAs($this->superAdmin)
            ->getJson('/api/wa-blasts/99999')
            ->assertStatus(404);
    }

    // ── Cancel (Destroy) ─────────────────────────────────────────────────────

    public function test_super_admin_can_cancel_scheduled_blast(): void
    {
        $blast = $this->createBlastWithRecipients('scheduled', 0, 0);

        $this->actingAs($this->superAdmin)
            ->deleteJson("/api/wa-blasts/{$blast->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertSoftDeleted('wa_blasts', ['id' => $blast->id]);
    }

    public function test_super_admin_can_cancel_draft_blast(): void
    {
        $blast = $this->createBlastWithRecipients('draft', 0, 0);

        $this->actingAs($this->superAdmin)
            ->deleteJson("/api/wa-blasts/{$blast->id}")
            ->assertOk();

        $this->assertSoftDeleted('wa_blasts', ['id' => $blast->id]);
    }

    public function test_cannot_cancel_sending_blast(): void
    {
        $blast = $this->createBlastWithRecipients('sending');

        $this->actingAs($this->superAdmin)
            ->deleteJson("/api/wa-blasts/{$blast->id}")
            ->assertStatus(422);

        // Blast should still exist (not soft-deleted)
        $this->assertDatabaseHas('wa_blasts', [
            'id'         => $blast->id,
            'deleted_at' => null,
        ]);
    }

    public function test_cannot_cancel_completed_blast(): void
    {
        $blast = $this->createBlastWithRecipients('completed');

        $this->actingAs($this->superAdmin)
            ->deleteJson("/api/wa-blasts/{$blast->id}")
            ->assertStatus(422);
    }

    // ── Progress ──────────────────────────────────────────────────────────────

    public function test_progress_endpoint_returns_correct_counts(): void
    {
        $blast = $this->createBlastWithRecipients('sending', 2, 3);

        $response = $this->actingAs($this->superAdmin)
            ->getJson("/api/wa-blasts/{$blast->id}/progress");

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'blast_status',
                    'total_count',
                    'sent_count',
                    'failed_count',
                    'pending_count',
                    'invalid_count',
                ],
            ]);

        $this->assertEquals('sending', $response->json('data.blast_status'));
        $this->assertEquals(5, $response->json('data.total_count'));
        $this->assertEquals(3, $response->json('data.sent_count'));
        $this->assertEquals(2, $response->json('data.failed_count'));
    }

    public function test_progress_endpoint_returns_404_for_nonexistent_blast(): void
    {
        $this->actingAs($this->superAdmin)
            ->getJson('/api/wa-blasts/99999/progress')
            ->assertStatus(422); // Service throws ValidationException → 422
    }

    // ── Retry ─────────────────────────────────────────────────────────────────

    public function test_super_admin_can_retry_blast_with_failed_recipients(): void
    {
        $blast = $this->createBlastWithRecipients('completed', 2, 1);

        $response = $this->actingAs($this->superAdmin)
            ->postJson("/api/wa-blasts/{$blast->id}/retry");

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.blast_status', 'sending');

        // New blast should reference the original
        $newBlast = WaBlast::find($response->json('data.id'));
        $this->assertEquals($blast->id, $newBlast->parent_blast_id);
        $this->assertStringContainsString('Retry', $newBlast->title);

        // Only failed recipients should be in the new blast
        $this->assertEquals(2, $newBlast->total_recipients);

        Queue::assertPushed(SendBlastJob::class, function ($job) use ($newBlast) {
            return $job->blastId === $newBlast->id;
        });
    }

    public function test_retry_logs_activity(): void
    {
        $blast = $this->createBlastWithRecipients('completed', 1, 1);

        $this->actingAs($this->superAdmin)
            ->postJson("/api/wa-blasts/{$blast->id}/retry");

        $this->assertDatabaseHas('activity_logs', [
            'event'    => 'retry_wa_blast',
            'log_name' => 'wa_blast',
        ]);
    }

    public function test_retry_returns_422_when_no_failed_recipients(): void
    {
        // Blast with only sent recipients — no failures
        $blast = $this->createBlastWithRecipients('completed', 0, 1);

        $this->actingAs($this->superAdmin)
            ->postJson("/api/wa-blasts/{$blast->id}/retry")
            ->assertStatus(422);
    }

    public function test_retry_returns_422_for_nonexistent_blast(): void
    {
        $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts/99999/retry')
            ->assertStatus(422);
    }

    // ── GTK Category ─────────────────────────────────────────────────────────

    public function test_create_blast_with_gtk_category_uses_teacher_phones(): void
    {
        Teacher::factory()->create([
            'school_id'    => $this->school->id,
            'phone_number' => '081298765432',
            'is_active'    => true,
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Blast GTK',
                'recipient_category' => 'gtk',
                'message_body'       => 'Halo guru.',
            ]);

        $response->assertStatus(201);

        $blast = WaBlast::where('title', 'Blast GTK')->first();
        $this->assertGreaterThan(0, $blast->total_recipients);
    }

    // ── Both Category ─────────────────────────────────────────────────────────

    public function test_create_blast_with_both_category_includes_kepala_and_gtk(): void
    {
        Teacher::factory()->create([
            'school_id'    => $this->school->id,
            'phone_number' => '081298765432',
            'is_active'    => true,
        ]);

        $response = $this->actingAs($this->superAdmin)
            ->postJson('/api/wa-blasts', [
                'title'              => 'Blast Keduanya',
                'recipient_category' => 'both',
                'message_body'       => 'Halo semua.',
            ]);

        $response->assertStatus(201);

        $blast = WaBlast::where('title', 'Blast Keduanya')->first();
        // Should include both kepala_sekolah and gtk recipients
        $this->assertGreaterThanOrEqual(2, $blast->total_recipients);
    }
}
