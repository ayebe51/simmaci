<?php

namespace App\Repositories;

use App\Models\WaBlastRecipient;
use App\Repositories\Contracts\WaBlastRecipientRepositoryInterface;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;

class WaBlastRecipientRepository implements WaBlastRecipientRepositoryInterface
{
    /**
     * Create multiple recipient records for a blast.
     *
     * @param int $blastId
     * @param array $recipients Array of recipient data
     * @return Collection
     */
    public function createMany(int $blastId, array $recipients): Collection
    {
        $createdRecipients = [];

        foreach ($recipients as $recipientData) {
            $createdRecipients[] = WaBlastRecipient::create(array_merge(
                $recipientData,
                ['wa_blast_id' => $blastId]
            ));
        }

        return new Collection($createdRecipients);
    }

    /**
     * Find all recipients for a specific blast.
     *
     * @param int $blastId
     * @return Collection
     */
    public function findByBlast(int $blastId): Collection
    {
        return WaBlastRecipient::where('wa_blast_id', $blastId)->get();
    }

    /**
     * Update the delivery status of a recipient.
     *
     * @param int $recipientId
     * @param string $status
     * @param string|null $errorMessage
     * @param Carbon|null $sentAt
     * @return WaBlastRecipient
     */
    public function updateDeliveryStatus(int $recipientId, string $status, ?string $errorMessage = null, ?Carbon $sentAt = null): WaBlastRecipient
    {
        $recipient = WaBlastRecipient::findOrFail($recipientId);

        $updateData = ['delivery_status' => $status];

        if ($errorMessage !== null) {
            $updateData['error_message'] = $errorMessage;
        }

        if ($sentAt !== null) {
            $updateData['sent_at'] = $sentAt;
        }

        $recipient->update($updateData);

        return $recipient;
    }

    /**
     * Count recipients by delivery status for a specific blast.
     *
     * @param int $blastId
     * @param string $status
     * @return int
     */
    public function countByStatus(int $blastId, string $status): int
    {
        return WaBlastRecipient::where('wa_blast_id', $blastId)
            ->where('delivery_status', $status)
            ->count();
    }

    /**
     * Find all failed recipients for a specific blast.
     *
     * @param int $blastId
     * @return Collection
     */
    public function findFailedByBlast(int $blastId): Collection
    {
        return WaBlastRecipient::where('wa_blast_id', $blastId)
            ->where('delivery_status', 'failed')
            ->get();
    }
}
