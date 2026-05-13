<?php

namespace App\Console\Commands;

use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Services\MeetingQrService;
use Illuminate\Console\Command;

/**
 * Regenerate QR tokens for all active/upcoming meetings.
 *
 * Use this after APP_KEY changes to fix invalid signatures.
 */
class RegenerateActiveMeetingQr extends Command
{
    protected $signature = 'meetings:regenerate-qr
                            {--all : Regenerate for all meetings including completed ones}
                            {--meeting= : Regenerate for a specific meeting ID only}
                            {--dry-run : Show what would be regenerated without making changes}';

    protected $description = 'Regenerate QR tokens for active/upcoming meetings (fixes invalid signatures after APP_KEY change)';

    public function __construct(private MeetingQrService $qrService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun  = $this->option('dry-run');
        $all     = $this->option('all');
        $meetingId = $this->option('meeting');

        $query = Meeting::with('participants');

        if ($meetingId) {
            $query->where('id', $meetingId);
        } elseif (!$all) {
            // Only upcoming and ongoing meetings
            $query->where('ended_at', '>=', now());
        }

        $meetings = $query->get();

        if ($meetings->isEmpty()) {
            $this->info('No meetings found.');
            return 0;
        }

        $this->info(($dryRun ? '[DRY RUN] ' : '') . "Found {$meetings->count()} meeting(s) to process.");

        $totalParticipants = 0;
        $totalMeetings     = 0;

        foreach ($meetings as $meeting) {
            $participants = $meeting->participants()->whereNull('deleted_at')->get();

            if ($participants->isEmpty()) {
                $this->line("  Meeting #{$meeting->id} \"{$meeting->title}\" — no participants, skipping.");
                continue;
            }

            $this->line("  Meeting #{$meeting->id} \"{$meeting->title}\" ({$participants->count()} participants)");

            if (!$dryRun) {
                foreach ($participants as $participant) {
                    // Mark old token as revoked, reset usage
                    $participant->update([
                        'token_revoked' => false,
                        'is_token_used' => false,
                        'token_used_at' => null,
                    ]);

                    // Generate new QR with current APP_KEY
                    $this->qrService->generatePersonalQrUrl($meeting, $participant);
                }

                // Regenerate QR_Umum as well
                $this->qrService->generateUmumQrUrl($meeting);
            }

            $totalParticipants += $participants->count();
            $totalMeetings++;
        }

        $action = $dryRun ? 'Would regenerate' : 'Regenerated';
        $this->info("{$action} QR for {$totalParticipants} participant(s) across {$totalMeetings} meeting(s).");

        if ($dryRun) {
            $this->warn('Run without --dry-run to apply changes.');
        } else {
            $this->info('Done. Note: participants need to use the new QR links. Consider resending invitations.');
        }

        return 0;
    }
}
