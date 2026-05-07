<?php

namespace App\Jobs;

use App\Models\Meeting;
use App\Services\MeetingService;
use App\Services\WaBlastService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * SendMeetingReminderJob
 *
 * Sends WA reminder to participants who haven't checked in yet.
 * Dispatched with delay() to run at the scheduled reminder time.
 *
 * Requirements: Req 9
 */
class SendMeetingReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * Job timeout in seconds.
     */
    public int $timeout = 600;

    /**
     * Create a new job instance.
     *
     * @param int $meetingId The Meeting ID to send reminders for
     */
    public function __construct(
        public int $meetingId
    ) {}

    /**
     * Execute the job.
     *
     * Loads the meeting, finds participants who haven't checked in,
     * and sends reminder WA blast via WaBlastService.
     */
    public function handle(WaBlastService $waBlastService): void
    {
        // Load the meeting
        $meeting = Meeting::with(['participants', 'attendances'])->find($this->meetingId);

        if (!$meeting) {
            Log::warning("SendMeetingReminderJob: Meeting #{$this->meetingId} not found.");
            return;
        }

        // Find participants who haven't checked in
        $attendedParticipantIds = $meeting->attendances->pluck('participant_id')->toArray();
        $unattendedParticipants = $meeting->participants
            ->filter(fn ($p) => !in_array($p->id, $attendedParticipantIds) && !empty($p->phone_number));

        if ($unattendedParticipants->isEmpty()) {
            Log::info("SendMeetingReminderJob: No unattended participants for meeting #{$this->meetingId}");
            return;
        }

        // Build recipients list
        $recipients = [];
        foreach ($unattendedParticipants as $participant) {
            $message = $this->buildReminderMessage($meeting, $participant);

            $recipients[] = [
                'recipient_name' => $participant->name,
                'school_name' => $participant->instansi,
                'phone_number' => $participant->phone_number,
                'recipient_type' => 'gtk',
                'delivery_status' => 'pending',
                'message_override' => $message,
            ];
        }

        try {
            // Create WA blast for reminders
            $blast = $waBlastService->createBlast([
                'title' => "Reminder: {$meeting->title}",
                'recipient_category' => 'custom',
                'message_body' => $this->buildReminderMessage($meeting, null),
                'recipients' => $recipients,
            ], 1); // Use system user ID (1) for automated reminders

            // Update meeting with reminder blast ID
            $meeting->update(['reminder_blast_id' => $blast->id]);

            Log::info("SendMeetingReminderJob: Reminder blast created for meeting #{$this->meetingId}", [
                'blast_id' => $blast->id,
                'recipient_count' => count($recipients),
            ]);
        } catch (\Exception $e) {
            Log::error('SendMeetingReminderJob: Failed to send meeting reminder', [
                'meeting_id' => $this->meetingId,
                'error' => $e->getMessage(),
            ]);

            // Rethrow to trigger retry
            throw $e;
        }
    }

    /**
     * Build reminder message for a participant.
     *
     * @param Meeting $meeting
     * @param \App\Models\MeetingParticipant|null $participant
     * @return string
     */
    private function buildReminderMessage(Meeting $meeting, $participant): string
    {
        $qrLink = $participant ? $participant->qr_token : $meeting->qr_umum_token;

        $message = "⏰ *PENGINGAT RAPAT*\n\n";

        if ($participant) {
            $message .= "Yth. {$participant->name}\n";
            $message .= "{$participant->jabatan} - {$participant->instansi}\n\n";
        }

        $message .= "Mengingatkan bahwa rapat berikut akan segera dimulai:\n";
        $message .= "*{$meeting->title}*\n\n";
        $message .= "📅 Tanggal: " . $meeting->started_at->format('d M Y') . "\n";
        $message .= "⏰ Waktu: " . $meeting->started_at->format('H:i') . "\n";
        $message .= "📍 Lokasi: {$meeting->location}\n\n";
        $message .= "Gunakan QR Code Anda untuk check-in:\n";
        $message .= "{$qrLink}\n\n";
        $message .= "_LP Ma'arif NU Cilacap_";

        return $message;
    }
}
