<?php

namespace App\Services;

use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\MeetingParticipant;
use App\Models\School;
use App\Models\User;
use App\Repositories\MeetingAttendanceRepository;
use App\Repositories\MeetingParticipantRepository;
use App\Repositories\MeetingRepository;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * MeetingService
 *
 * Handles all business logic for meeting management including:
 * - CRUD operations for meetings
 * - Participant management and QR generation
 * - WA Blast integration for invitations and reminders
 * - Manual check-in and reset operations
 * - QR regeneration
 */
class MeetingService
{
    public function __construct(
        private MeetingRepository $meetingRepository,
        private MeetingParticipantRepository $participantRepository,
        private MeetingAttendanceRepository $attendanceRepository,
        private MeetingQrService $qrService,
        private WaBlastService $waBlastService,
        private PhoneNormalizerService $phoneNormalizer,
    ) {}

    /**
     * Create a new meeting with participants and send invitations/reminders.
     *
     * @param array $data
     * @param User $creator
     * @return Meeting
     * @throws ValidationException
     */
    public function createMeeting(array $data, User $creator): Meeting
    {
        // Validate date/time constraints
        $this->validateMeetingDates($data['started_at'], $data['ended_at']);

        // Validate geolocation if enabled
        if ($data['geolocation_enabled']) {
            $this->validateGeolocationData($data);
        }

        // Validate reminder timing if enabled
        if ($data['send_reminder_wa']) {
            $this->validateReminderTiming($data, $data['started_at']);
        }

        return DB::transaction(function () use ($data, $creator) {
            // 1. Create meeting record
            $meeting = $this->meetingRepository->create([
                'title' => $data['title'],
                'agenda' => $data['agenda'] ?? null,
                'location' => $data['location'],
                'started_at' => $data['started_at'],
                'ended_at' => $data['ended_at'],
                'geolocation_enabled' => $data['geolocation_enabled'],
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'geolocation_radius_meters' => $data['geolocation_radius_meters'] ?? null,
                'created_by' => $creator->id,
            ]);

            // 2. Attach schools
            $schoolIds = $data['school_ids'] ?? [];
            if (!empty($schoolIds)) {
                $meeting->schools()->attach($schoolIds);
            }

            // 3. Create participants and generate QR codes
            $this->createParticipants($meeting, $data['participants'] ?? []);

            // 4. Generate QR_Umum
            $this->qrService->generateUmumQrUrl($meeting);

            // 5. Send invitation WA blast if enabled
            if ($data['send_invitation_wa'] ?? false) {
                $this->sendInvitationBlast($meeting);
            }

            // 6. Schedule reminder if enabled
            if ($data['send_reminder_wa'] ?? false) {
                $this->scheduleReminder($meeting, $data);
            }

            return $meeting->fresh([
                'schools',
                'participants',
                'attendances',
                'creator',
            ]);
        });
    }

    /**
     * Update an existing meeting.
     *
     * @param Meeting $meeting
     * @param array $data
     * @return Meeting
     * @throws ValidationException
     */
    public function updateMeeting(Meeting $meeting, array $data): Meeting
    {
        // Validate date/time constraints
        if (isset($data['started_at']) && isset($data['ended_at'])) {
            $this->validateMeetingDates($data['started_at'], $data['ended_at']);
        }

        // Validate geolocation if enabled
        if (isset($data['geolocation_enabled']) && $data['geolocation_enabled']) {
            $this->validateGeolocationData($data);
        }

        // Validate reminder timing if enabled
        if (isset($data['send_reminder_wa']) && $data['send_reminder_wa']) {
            $startedAt = $data['started_at'] ?? $meeting->started_at;
            $this->validateReminderTiming($data, $startedAt);
        }

        return DB::transaction(function () use ($meeting, $data) {
            // 1. Update meeting record
            $updateData = [];
            foreach (['title', 'agenda', 'location', 'started_at', 'ended_at', 'geolocation_enabled', 'latitude', 'longitude', 'geolocation_radius_meters'] as $field) {
                if (isset($data[$field])) {
                    $updateData[$field] = $data[$field];
                }
            }

            if (!empty($updateData)) {
                $meeting = $this->meetingRepository->update($meeting, $updateData);
            }

            // 2. Update schools if provided
            if (isset($data['school_ids'])) {
                $meeting->schools()->sync($data['school_ids']);
            }

            // 3. Update participants if provided
            if (isset($data['participants'])) {
                $this->updateParticipants($meeting, $data['participants']);
            }

            // 4. Regenerate QR_Umum if needed
            if (isset($data['geolocation_enabled']) || isset($data['started_at'])) {
                $this->qrService->generateUmumQrUrl($meeting);
            }

            // 5. Update reminder if needed
            if (isset($data['send_reminder_wa'])) {
                if ($data['send_reminder_wa']) {
                    $this->scheduleReminder($meeting, $data);
                } else {
                    $meeting->update(['reminder_scheduled_at' => null, 'reminder_blast_id' => null]);
                }
            }

            // 6. Resend invitation WA if requested
            if (!empty($data['send_invitation_wa'])) {
                $meeting->load('participants');
                $this->sendInvitationBlast($meeting);
            }

            return $meeting->fresh([
                'schools',
                'participants',
                'attendances',
                'creator',
            ]);
        });
    }

    /**
     * Delete a meeting (soft delete).
     *
     * @param Meeting $meeting
     * @return bool
     */
    public function deleteMeeting(Meeting $meeting): bool
    {
        return DB::transaction(function () use ($meeting) {
            // Soft delete all related records
            $meeting->participants()->delete();
            $meeting->attendances()->delete();

            return $this->meetingRepository->delete($meeting);
        });
    }

    /**
     * Get paginated list of meetings with optional filters.
     *
     * @param int $perPage
     * @param array $filters
     * @return LengthAwarePaginator
     */
    public function getMeetings(int $perPage = 20, array $filters = []): LengthAwarePaginator
    {
        return $this->meetingRepository->paginate($perPage, $filters);
    }

    /**
     * Get a single meeting by ID.
     *
     * @param int $id
     * @return Meeting|null
     */
    public function getMeeting(int $id): ?Meeting
    {
        return $this->meetingRepository->findById($id);
    }

    /**
     * Perform manual check-in for a participant.
     *
     * @param Meeting $meeting
     * @param MeetingParticipant $participant
     * @param User $admin
     * @return MeetingAttendance
     */
    public function manualCheckIn(Meeting $meeting, MeetingParticipant $participant, User $admin): MeetingAttendance
    {
        return DB::transaction(function () use ($meeting, $participant, $admin) {
            // Check if already checked in
            $existing = $this->attendanceRepository->findByParticipantAndMeeting($participant->id, $meeting->id);
            if ($existing) {
                throw ValidationException::withMessages([
                    'participant' => ['Peserta sudah melakukan check-in pada ' . $existing->checked_in_at->format('H:i:s')],
                ]);
            }

            // Create attendance record
            $attendance = MeetingAttendance::create([
                'meeting_id' => $meeting->id,
                'participant_id' => $participant->id,
                'attendance_type' => 'manual',
                'is_delegation' => false,
                'checked_in_at' => now(),
                'checked_in_by_admin_id' => $admin->id,
                'ip_address' => request()->ip(),
            ]);

            // Mark token as used
            $participant->update([
                'is_token_used' => true,
                'token_used_at' => now(),
            ]);

            return $attendance;
        });
    }

    /**
     * Reset check-in for a participant (allow re-check-in).
     *
     * @param Meeting $meeting
     * @param MeetingParticipant $participant
     * @return void
     */
    public function resetCheckIn(Meeting $meeting, MeetingParticipant $participant): void
    {
        DB::transaction(function () use ($meeting, $participant) {
            // Delete attendance record
            MeetingAttendance::where('meeting_id', $meeting->id)
                ->where('participant_id', $participant->id)
                ->delete();

            // Reset token usage
            $participant->update([
                'is_token_used' => false,
                'token_used_at' => null,
            ]);
        });
    }

    /**
     * Regenerate QR code for a participant.
     *
     * @param Meeting $meeting
     * @param MeetingParticipant $participant
     * @return string New QR URL
     */
    public function regenerateQr(Meeting $meeting, MeetingParticipant $participant): string
    {
        return DB::transaction(function () use ($meeting, $participant) {
            // Mark old token as revoked
            $participant->update([
                'token_revoked' => true,
                'is_token_used' => false,
                'token_used_at' => null,
            ]);

            // Generate new QR
            return $this->qrService->generatePersonalQrUrl($meeting, $participant);
        });
    }

    /**
     * Get attendance statistics for a meeting.
     *
     * @param Meeting $meeting
     * @return array
     */
    public function getAttendanceStats(Meeting $meeting): array
    {
        $total = $meeting->participants->count();
        $attendances = $meeting->attendances;

        $present = $attendances->count();
        $absent = $total - $present;
        $delegation = $attendances->where('is_delegation', true)->count();
        $walkIn = $attendances->where('attendance_type', 'qr_umum')->count();

        return [
            'total' => $total,
            'present' => $present,
            'absent' => $absent,
            'delegation' => $delegation,
            'walk_in' => $walkIn,
            'percentage' => $total > 0 ? round(($present / $total) * 100, 2) : 0,
        ];
    }

    // ── Private Helper Methods ──

    /**
     * Validate meeting date/time constraints.
     * Note: ended_at > started_at is already validated in StoreMeetingRequest.
     * This method is kept for programmatic calls (e.g. from tests).
     *
     * @param string|Carbon $startedAt
     * @param string|Carbon $endedAt
     * @throws ValidationException
     */
    private function validateMeetingDates($startedAt, $endedAt): void
    {
        $started = Carbon::parse($startedAt);
        $ended = Carbon::parse($endedAt);

        if ($ended->lte($started)) {
            throw ValidationException::withMessages([
                'ended_at' => ['Waktu selesai rapat harus setelah waktu mulai'],
            ]);
        }
    }

    /**
     * Validate geolocation data.
     *
     * @param array $data
     * @throws ValidationException
     */
    private function validateGeolocationData(array $data): void
    {
        if (empty($data['latitude']) || empty($data['longitude'])) {
            throw ValidationException::withMessages([
                'latitude' => ['Latitude wajib diisi jika validasi lokasi diaktifkan'],
                'longitude' => ['Longitude wajib diisi jika validasi lokasi diaktifkan'],
            ]);
        }

        if (empty($data['geolocation_radius_meters']) || $data['geolocation_radius_meters'] < 10) {
            throw ValidationException::withMessages([
                'geolocation_radius_meters' => ['Radius validasi lokasi minimal 10 meter'],
            ]);
        }
    }

    /**
     * Validate reminder timing.
     *
     * @param array $data
     * @param string|Carbon $startedAt
     * @throws ValidationException
     */
    private function validateReminderTiming(array $data, $startedAt): void
    {
        $started = Carbon::parse($startedAt);
        $reminderTiming = $data['reminder_timing'] ?? null;

        if ($reminderTiming === 'custom') {
            if (empty($data['reminder_custom_at'])) {
                throw ValidationException::withMessages([
                    'reminder_custom_at' => ['Waktu reminder custom wajib diisi'],
                ]);
            }

            $reminderAt = Carbon::parse($data['reminder_custom_at']);
            $now = now();

            // Check if reminder time is in the past
            if ($reminderAt->lte($now)) {
                throw ValidationException::withMessages([
                    'reminder_custom_at' => ['Waktu reminder sudah lewat. Silakan pilih waktu yang akan datang.'],
                ]);
            }

            // Check minimum 30 minutes before meeting
            if ($reminderAt->gt($started->subMinutes(30))) {
                throw ValidationException::withMessages([
                    'reminder_custom_at' => ['Waktu reminder minimal 30 menit sebelum rapat dimulai.'],
                ]);
            }

            // Check maximum 7 days before meeting
            if ($reminderAt->lt($started->subDays(7))) {
                throw ValidationException::withMessages([
                    'reminder_custom_at' => ['Waktu reminder maksimal 7 hari sebelum rapat dimulai.'],
                ]);
            }
        }
    }

    /**
     * Create participants for a meeting.
     *
     * @param Meeting $meeting
     * @param array $participants
     * @return void
     */
    private function createParticipants(Meeting $meeting, array $participants): void
    {
        foreach ($participants as $participantData) {
            $participant = MeetingParticipant::create([
                'meeting_id' => $meeting->id,
                'participant_type' => $participantData['participant_type'],
                'participant_id' => $participantData['participant_id'] ?? null,
                'name' => $participantData['name'],
                'jabatan' => $participantData['jabatan'],
                'instansi' => $participantData['instansi'],
                'phone_number' => $participantData['phone_number'],
            ]);

            // Generate QR_Personal
            $this->qrService->generatePersonalQrUrl($meeting, $participant);
        }
    }

    /**
     * Update participants for a meeting.
     *
     * @param Meeting $meeting
     * @param array $participants
     * @return void
     */
    private function updateParticipants(Meeting $meeting, array $participants): void
    {
        // Get existing participant IDs
        $existingIds = $meeting->participants->pluck('id')->toArray();
        $newIds = [];

        foreach ($participants as $participantData) {
            if (isset($participantData['id']) && in_array($participantData['id'], $existingIds)) {
                // Update existing participant
                $participant = MeetingParticipant::find($participantData['id']);
                $participant->update([
                    'name' => $participantData['name'],
                    'jabatan' => $participantData['jabatan'],
                    'instansi' => $participantData['instansi'],
                    'phone_number' => $participantData['phone_number'],
                ]);
                $newIds[] = $participant->id;
            } else {
                // Create new participant
                $participant = MeetingParticipant::create([
                    'meeting_id' => $meeting->id,
                    'participant_type' => $participantData['participant_type'],
                    'participant_id' => $participantData['participant_id'] ?? null,
                    'name' => $participantData['name'],
                    'jabatan' => $participantData['jabatan'],
                    'instansi' => $participantData['instansi'],
                    'phone_number' => $participantData['phone_number'],
                ]);

                // Generate QR_Personal
                $this->qrService->generatePersonalQrUrl($meeting, $participant);
                $newIds[] = $participant->id;
            }
        }

        // Delete removed participants
        $removedIds = array_diff($existingIds, $newIds);
        if (!empty($removedIds)) {
            MeetingParticipant::whereIn('id', $removedIds)->delete();
        }
    }

    /**
     * Send invitation WA blast.
     *
     * @param Meeting $meeting
     * @return void
     */
    private function sendInvitationBlast(Meeting $meeting): void
    {
        $recipients = [];

        foreach ($meeting->participants as $participant) {
            if (empty($participant->phone_number)) {
                continue;
            }

            $message = $this->buildInvitationMessage($meeting, $participant);

            $recipients[] = [
                'recipient_name' => $participant->name,
                'school_name' => $participant->instansi,
                'phone_number' => $participant->phone_number,
                'recipient_type' => 'gtk',
                'delivery_status' => 'pending',
                'message_override' => $message,
            ];
        }

        if (empty($recipients)) {
            return;
        }

        try {
            $blast = $this->waBlastService->createBlast([
                'title' => "Undangan: {$meeting->title}",
                'recipient_category' => 'custom',
                'message_body' => $this->buildInvitationMessage($meeting, null),
                'recipients' => $recipients,
            ], auth()->id());

            $meeting->update(['invitation_blast_id' => $blast->id]);
        } catch (\Exception $e) {
            \Log::error('Failed to send meeting invitation blast', [
                'meeting_id' => $meeting->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Schedule reminder WA blast.
     *
     * @param Meeting $meeting
     * @param array $data
     * @return void
     */
    private function scheduleReminder(Meeting $meeting, array $data): void
    {
        $reminderTiming = $data['reminder_timing'] ?? 'H-1';
        $startedAt = $meeting->started_at;

        $reminderAt = match ($reminderTiming) {
            'H-1' => $startedAt->copy()->subHours(24),
            '2_hours' => $startedAt->copy()->subHours(2),
            'custom' => Carbon::parse($data['reminder_custom_at'] ?? now()),
            default => $startedAt->copy()->subHours(24),
        };

        $meeting->update(['reminder_scheduled_at' => $reminderAt]);

        // Dispatch job to send reminder at scheduled time
        \App\Jobs\SendMeetingReminderJob::dispatch($meeting->id)
            ->delay($reminderAt);
    }

    /**
     * Build invitation message for a participant.
     *
     * @param Meeting $meeting
     * @param MeetingParticipant|null $participant
     * @return string
     */
    private function buildInvitationMessage(Meeting $meeting, ?MeetingParticipant $participant): string
    {
        $qrLink = $participant ? $participant->qr_token : $meeting->qr_umum_token;

        $message = "📋 *UNDANGAN RAPAT*\n\n";

        if ($participant) {
            $message .= "Yth. {$participant->name}\n";
            $message .= "{$participant->jabatan} - {$participant->instansi}\n\n";
        }

        $message .= "Anda diundang untuk hadir dalam:\n";
        $message .= "*{$meeting->title}*\n\n";
        $message .= "📅 Tanggal: " . $meeting->started_at->format('d M Y') . "\n";
        $message .= "⏰ Waktu: " . $meeting->started_at->format('H:i') . " - " . $meeting->ended_at->format('H:i') . "\n";
        $message .= "📍 Lokasi: {$meeting->location}\n\n";

        if ($meeting->agenda) {
            $message .= "📌 Agenda:\n{$meeting->agenda}\n\n";
        }

        $message .= "Silakan scan QR Code berikut untuk check-in:\n";
        $message .= "{$qrLink}\n\n";
        $message .= "Harap konfirmasi kehadiran Anda.\n\n";
        $message .= "_LP Ma'arif NU Cilacap_";

        return $message;
    }
}
