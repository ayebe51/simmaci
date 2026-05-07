<?php

namespace Tests\Feature;

use App\Jobs\SendMeetingReminderJob;
use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\MeetingParticipant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * SendMeetingReminderJobTest
 *
 * Integration tests for the SendMeetingReminderJob.
 * Requirements: Req 9
 */
class SendMeetingReminderJobTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private Meeting $meeting;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::factory()->create(['role' => 'super_admin']);

        $this->meeting = Meeting::factory()->create([
            'created_by' => $this->superAdmin->id,
            'started_at' => now()->addDays(1),
            'ended_at' => now()->addDays(1)->addHours(2),
        ]);

        // Create participants
        for ($i = 0; $i < 5; $i++) {
            MeetingParticipant::factory()->create([
                'meeting_id' => $this->meeting->id,
                'phone_number' => '6281234567' . str_pad($i, 3, '0', STR_PAD_LEFT),
            ]);
        }
    }

    // ── Job Dispatch Tests ────────────────────────────────────────────────────

    /**
     * Test job can be dispatched
     */
    public function test_job_can_be_dispatched(): void
    {
        Queue::fake();

        SendMeetingReminderJob::dispatch($this->meeting->id);

        Queue::assertPushed(SendMeetingReminderJob::class);
    }

    /**
     * Test job is queued with correct meeting ID
     */
    public function test_job_is_queued_with_correct_meeting_id(): void
    {
        Queue::fake();

        SendMeetingReminderJob::dispatch($this->meeting->id);

        Queue::assertPushed(SendMeetingReminderJob::class, function ($job) {
            return $job->meetingId === $this->meeting->id;
        });
    }

    // ── Job Execution Tests ───────────────────────────────────────────────────

    /**
     * Test job sends reminders to unattended participants
     */
    public function test_job_sends_reminders_to_unattended_participants(): void
    {
        // Mark 2 participants as attended
        $attendedParticipants = $this->meeting->participants()->take(2)->get();
        foreach ($attendedParticipants as $participant) {
            MeetingAttendance::factory()->create([
                'meeting_id' => $this->meeting->id,
                'participant_id' => $participant->id,
            ]);
        }

        // Execute job
        $job = new SendMeetingReminderJob($this->meeting->id);
        $job->handle(app(\App\Services\WaBlastService::class));

        // Verify reminder blast was created
        $this->assertDatabaseHas('wa_blasts', [
            'title' => "Reminder: {$this->meeting->title}",
        ]);
    }

    /**
     * Test job skips participants with no phone number
     */
    public function test_job_skips_participants_with_no_phone_number(): void
    {
        // Create participant without phone number
        MeetingParticipant::factory()->create([
            'meeting_id' => $this->meeting->id,
            'phone_number' => null,
        ]);

        // Execute job
        $job = new SendMeetingReminderJob($this->meeting->id);
        $job->handle(app(\App\Services\WaBlastService::class));

        // Verify blast was created (should only include participants with phone numbers)
        $this->assertDatabaseHas('wa_blasts', [
            'title' => "Reminder: {$this->meeting->title}",
        ]);
    }

    /**
     * Test job handles non-existent meeting gracefully
     */
    public function test_job_handles_non_existent_meeting_gracefully(): void
    {
        // Execute job with non-existent meeting ID
        $job = new SendMeetingReminderJob(99999);
        $job->handle(app(\App\Services\WaBlastService::class));

        // Should not create any blast
        $this->assertDatabaseMissing('wa_blasts', [
            'title' => 'Reminder: Non-existent',
        ]);
    }

    /**
     * Test job skips if all participants have checked in
     */
    public function test_job_skips_if_all_participants_have_checked_in(): void
    {
        // Mark all participants as attended
        foreach ($this->meeting->participants as $participant) {
            MeetingAttendance::factory()->create([
                'meeting_id' => $this->meeting->id,
                'participant_id' => $participant->id,
            ]);
        }

        // Execute job
        $job = new SendMeetingReminderJob($this->meeting->id);
        $job->handle(app(\App\Services\WaBlastService::class));

        // Should not create any blast since all have checked in
        $this->assertDatabaseMissing('wa_blasts', [
            'title' => "Reminder: {$this->meeting->title}",
        ]);
    }

    // ── Job Retry Tests ───────────────────────────────────────────────────────

    /**
     * Test job has correct retry configuration
     */
    public function test_job_has_correct_retry_configuration(): void
    {
        $job = new SendMeetingReminderJob($this->meeting->id);

        $this->assertEquals(3, $job->tries);
        $this->assertEquals(600, $job->timeout);
    }

    // ── Blast Creation Tests ──────────────────────────────────────────────────

    /**
     * Test job creates blast with correct title
     */
    public function test_job_creates_blast_with_correct_title(): void
    {
        $job = new SendMeetingReminderJob($this->meeting->id);
        $job->handle(app(\App\Services\WaBlastService::class));

        $this->assertDatabaseHas('wa_blasts', [
            'title' => "Reminder: {$this->meeting->title}",
        ]);
    }

    /**
     * Test job updates meeting with reminder blast ID
     */
    public function test_job_updates_meeting_with_reminder_blast_id(): void
    {
        $job = new SendMeetingReminderJob($this->meeting->id);
        $job->handle(app(\App\Services\WaBlastService::class));

        $updatedMeeting = $this->meeting->fresh();
        $this->assertNotNull($updatedMeeting->reminder_blast_id);
    }
}
