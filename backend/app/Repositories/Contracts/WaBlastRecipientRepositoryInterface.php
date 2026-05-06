<?php

namespace App\Repositories\Contracts;

use App\Models\WaBlastRecipient;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;

interface WaBlastRecipientRepositoryInterface
{
    /**
     * Create multiple recipient records for a blast.
     *
     * @param int $blastId
     * @param array $recipients Array of recipient data
     * @return Collection
     */
    public function createMany(int $blastId, array $recipients): Collection;

    /**
     * Find all recipients for a specific blast.
     *
     * @param int $blastId
     * @return Collection
     */
    public function findByBlast(int $blastId): Collection;

    /**
     * Update the delivery status of a recipient.
     *
     * @param int $recipientId
     * @param string $status
     * @param string|null $errorMessage
     * @param Carbon|null $sentAt
     * @return WaBlastRecipient
     */
    public function updateDeliveryStatus(int $recipientId, string $status, ?string $errorMessage = null, ?Carbon $sentAt = null): WaBlastRecipient;

    /**
     * Count recipients by delivery status for a specific blast.
     *
     * @param int $blastId
     * @param string $status
     * @return int
     */
    public function countByStatus(int $blastId, string $status): int;

    /**
     * Find all failed recipients for a specific blast.
     *
     * @param int $blastId
     * @return Collection
     */
    public function findFailedByBlast(int $blastId): Collection;
}
