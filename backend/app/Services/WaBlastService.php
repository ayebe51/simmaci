<?php

namespace App\Services;

use App\Jobs\SendBlastJob;
use App\Models\WaBlast;
use App\Repositories\Contracts\WaBlastConfigRepositoryInterface;
use App\Repositories\Contracts\WaBlastRecipientRepositoryInterface;
use App\Repositories\Contracts\WaBlastRepositoryInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * WaBlastService
 *
 * Orchestrates WA Blast creation, scheduling, retry, cancellation, and progress tracking.
 * Handles recipient compilation, rate limiting, PDF upload, and job dispatching.
 */
class WaBlastService
{
    public function __construct(
        private WaBlastRepositoryInterface $blastRepository,
        private WaBlastRecipientRepositoryInterface $recipientRepository,
        private WaBlastConfigRepositoryInterface $configRepository,
        private RecipientCompilerService $recipientCompiler,
        private WaBlastConfigService $configService
    ) {}

    /**
     * Preview recipients for a blast without saving anything.
     *
     * @param string $category Recipient category: 'kepala_sekolah', 'gtk', or 'both'
     * @param array $schoolIds School IDs to filter by (empty = all schools)
     * @param array $jenjang Jenjang levels to filter by (empty = all jenjang)
     * @return array Array with keys: recipients, valid_count, invalid_count, total_count
     */
    public function previewRecipients(string $category, array $schoolIds, array $jenjang = []): array
    {
        $recipients = $this->recipientCompiler->compile($category, $schoolIds, $jenjang, []);

        $validCount = count(array_filter($recipients, fn ($r) => $r['delivery_status'] === 'pending'));
        $invalidCount = count(array_filter($recipients, fn ($r) => $r['delivery_status'] === 'invalid_number'));

        return [
            'recipients'    => $recipients,
            'valid_count'   => $validCount,
            'invalid_count' => $invalidCount,
            'total_count'   => count($recipients),
        ];
    }

    /**
     * Create a new WA Blast session.
     *
     * Steps:
     * 1. Compile recipients from schools/teachers
     * 2. Validate max recipients per session
     * 3. Validate daily message limit (warn if exceeded)
     * 4. Save WaBlast record
     * 5. Save WaBlastRecipient[] records
     * 6. Upload PDF attachment to storage if provided
     * 7. Dispatch SendBlastJob if immediate, or set status to 'scheduled'
     *
     * @param array $data Blast data: title, recipient_category, school_ids, jenjang_filter,
     *                    message_body, attachment (UploadedFile|null), scheduled_at (nullable),
     *                    excluded_phone_numbers
     * @param int $userId ID of the user creating the blast
     * @return WaBlast
     * @throws ValidationException if validation fails
     */
    public function createBlast(array $data, int $userId): WaBlast
    {
        // 1. Compile recipients
        // If 'custom' category, recipients are passed directly (e.g. from meeting invitations).
        // Otherwise, compile from schools/teachers via RecipientCompilerService.
        if ($data['recipient_category'] === 'custom') {
            $recipients = $data['recipients'] ?? [];
        } else {
            $excludedPhones = $data['excluded_phone_numbers'] ?? [];
            $recipients = $this->recipientCompiler->compile(
                $data['recipient_category'],
                $data['school_ids'] ?? [],
                $data['jenjang_filter'] ?? [],
                $excludedPhones
            );
        }

        // Count only valid (pending) recipients for rate limit check
        $validRecipients = array_filter($recipients, fn ($r) => $r['delivery_status'] === 'pending');
        $validCount = count($validRecipients);

        // 2. Validate max recipients per session
        $config = $this->configRepository->get();
        $maxPerSession = $config ? $config->max_recipients_per_session : 500;

        if ($validCount > $maxPerSession) {
            throw ValidationException::withMessages([
                'recipients' => [
                    "Jumlah penerima melebihi batas maksimal {$maxPerSession} per sesi.",
                ],
            ]);
        }

        // 3. Validate daily limit (warn — throw if exceeded)
        if ($config) {
            $maxDaily = $config->max_daily_messages;
            $todaySentCount = $this->countTodaySentMessages();

            if (($todaySentCount + $validCount) > $maxDaily) {
                $remaining = max(0, $maxDaily - $todaySentCount);
                throw ValidationException::withMessages([
                    'daily_limit' => [
                        "Batas pengiriman harian akan terlampaui. Sisa kuota hari ini: {$remaining} pesan.",
                    ],
                ]);
            }
        }

        // 4. Determine blast status
        $isScheduled = !empty($data['scheduled_at']);
        $blastStatus = $isScheduled ? 'scheduled' : 'sending';

        // 5. Handle PDF attachment upload
        $attachmentPath = null;
        $attachmentName = null;

        if (!empty($data['attachment']) && $data['attachment'] instanceof UploadedFile) {
            $file = $data['attachment'];
            $attachmentName = $file->getClientOriginalName();
            $attachmentPath = $file->store('wa-blasts/attachments', 'local');
        }

        // 6. Save WaBlast record
        $invalidCount = count($recipients) - $validCount;

        $blast = $this->blastRepository->create([
            'title'              => $data['title'],
            'recipient_category' => $data['recipient_category'],
            'school_ids'         => $data['school_ids'] ?? null,
            'jenjang_filter'     => $data['jenjang_filter'] ?? null,
            'message_body'       => $data['message_body'],
            'attachment_path'    => $attachmentPath,
            'attachment_name'    => $attachmentName,
            'blast_status'       => $blastStatus,
            'scheduled_at'       => $isScheduled ? $data['scheduled_at'] : null,
            'sent_at'            => $isScheduled ? null : now(),
            'total_recipients'   => count($recipients),
            'sent_count'         => 0,
            'failed_count'       => 0,
            'invalid_count'      => $invalidCount,
            'created_by'         => $userId,
        ]);

        // 7. Save recipients
        if (!empty($recipients)) {
            $this->recipientRepository->createMany($blast->id, $recipients);
        }

        // 8. Dispatch job if immediate
        if (!$isScheduled) {
            SendBlastJob::dispatch($blast->id);
        }

        return $blast;
    }

    /**
     * Retry a blast by creating a new blast from failed recipients.
     *
     * Creates a new WaBlast with the same message/attachment as the original,
     * but only for recipients with delivery_status = 'failed'.
     * Sets parent_blast_id to reference the original blast.
     *
     * @param int $blastId Original blast ID
     * @param int $userId ID of the user initiating the retry
     * @return WaBlast The new retry blast
     * @throws ValidationException if original blast not found or has no failed recipients
     */
    public function retryBlast(int $blastId, int $userId): WaBlast
    {
        $originalBlast = $this->blastRepository->findById($blastId);

        if (!$originalBlast) {
            throw ValidationException::withMessages([
                'blast_id' => ['Blast tidak ditemukan.'],
            ]);
        }

        $failedRecipients = $this->recipientRepository->findFailedByBlast($blastId);

        if ($failedRecipients->isEmpty()) {
            throw ValidationException::withMessages([
                'blast_id' => ['Tidak ada penerima yang gagal untuk dikirim ulang.'],
            ]);
        }

        // Build new recipients array from failed ones (reset to pending)
        $newRecipients = $failedRecipients->map(fn ($r) => [
            'recipient_name'  => $r->recipient_name,
            'school_name'     => $r->school_name,
            'phone_number'    => $r->phone_number,
            'recipient_type'  => $r->recipient_type,
            'delivery_status' => 'pending',
        ])->toArray();

        // Create new blast
        $newBlast = $this->blastRepository->create([
            'title'              => $originalBlast->title . ' (Retry)',
            'recipient_category' => $originalBlast->recipient_category,
            'school_ids'         => $originalBlast->school_ids,
            'jenjang_filter'     => $originalBlast->jenjang_filter,
            'message_body'       => $originalBlast->message_body,
            'attachment_path'    => $originalBlast->attachment_path,
            'attachment_name'    => $originalBlast->attachment_name,
            'blast_status'       => 'sending',
            'scheduled_at'       => null,
            'sent_at'            => now(),
            'total_recipients'   => count($newRecipients),
            'sent_count'         => 0,
            'failed_count'       => 0,
            'invalid_count'      => 0,
            'parent_blast_id'    => $blastId,
            'created_by'         => $userId,
        ]);

        // Save recipients
        $this->recipientRepository->createMany($newBlast->id, $newRecipients);

        // Dispatch job
        SendBlastJob::dispatch($newBlast->id);

        return $newBlast;
    }

    /**
     * Cancel a blast.
     *
     * Only blasts with status 'scheduled' or 'draft' can be cancelled.
     * Cancellation is performed via soft delete.
     *
     * @param int $blastId Blast ID to cancel
     * @return void
     * @throws ValidationException if blast cannot be cancelled
     */
    public function cancelBlast(int $blastId): void
    {
        $blast = $this->blastRepository->findById($blastId);

        if (!$blast) {
            throw ValidationException::withMessages([
                'blast_id' => ['Blast tidak ditemukan.'],
            ]);
        }

        if (!in_array($blast->blast_status, ['scheduled', 'draft'])) {
            throw ValidationException::withMessages([
                'blast_status' => [
                    'Hanya blast berstatus scheduled atau draft yang dapat dibatalkan.',
                ],
            ]);
        }

        // Soft delete the blast (cancellation via delete for scheduled/draft blasts)
        $this->blastRepository->delete($blastId);
    }

    /**
     * Get the progress of a blast session.
     *
     * Returns counts of recipients by delivery status.
     *
     * @param int $blastId Blast ID
     * @return array Array with keys: blast_status, total_count, sent_count, failed_count,
     *               pending_count, invalid_count
     * @throws ValidationException if blast not found
     */
    public function getProgress(int $blastId): array
    {
        $blast = $this->blastRepository->findById($blastId);

        if (!$blast) {
            throw ValidationException::withMessages([
                'blast_id' => ['Blast tidak ditemukan.'],
            ]);
        }

        $sentCount    = $this->recipientRepository->countByStatus($blastId, 'sent');
        $failedCount  = $this->recipientRepository->countByStatus($blastId, 'failed');
        $pendingCount = $this->recipientRepository->countByStatus($blastId, 'pending');
        $invalidCount = $this->recipientRepository->countByStatus($blastId, 'invalid_number');

        return [
            'blast_status'  => $blast->blast_status,
            'total_count'   => $blast->total_recipients,
            'sent_count'    => $sentCount,
            'failed_count'  => $failedCount,
            'pending_count' => $pendingCount,
            'invalid_count' => $invalidCount,
        ];
    }

    /**
     * Count the total number of messages sent today (from 00:00 to 23:59).
     *
     * Counts WaBlastRecipient records where the parent blast was created today
     * and delivery_status is not 'failed', 'cancelled', or 'invalid_number'.
     *
     * @return int
     */
    private function countTodaySentMessages(): int
    {
        return \App\Models\WaBlastRecipient::query()
            ->whereHas('blast', function ($q) {
                $q->whereDate('created_at', today())
                    ->whereNotIn('blast_status', ['cancelled', 'failed']);
            })
            ->whereNotIn('delivery_status', ['failed', 'invalid_number'])
            ->count();
    }
}
