<?php

namespace App\Services;

use App\Models\School;
use App\Models\Teacher;
use Illuminate\Support\Collection;

/**
 * RecipientCompilerService
 *
 * Compiles recipient lists for WA Blast from schools and teachers.
 * Handles filtering by category, jenjang, school IDs, and phone normalization.
 */
class RecipientCompilerService
{
    public function __construct(
        private PhoneNormalizerService $phoneNormalizer
    ) {}

    /**
     * Compile recipients based on category, school IDs, jenjang filter, and excluded phones.
     *
     * @param string $category Recipient category: 'kepala_sekolah', 'gtk', or 'both'
     * @param array $schoolIds School IDs to filter by (empty = all schools)
     * @param array $jenjang Jenjang levels to filter by (empty = all jenjang)
     * @param array $excludedPhones Phone numbers to exclude (normalized format)
     * @return array Array of recipient data with keys: recipient_name, school_name, phone_number, recipient_type, delivery_status
     */
    public function compile(
        string $category,
        array $schoolIds = [],
        array $jenjang = [],
        array $excludedPhones = []
    ): array {
        $recipients = [];

        // Compile from kepala_sekolah if category includes it
        if (in_array($category, ['kepala_sekolah', 'both'])) {
            $recipients = array_merge(
                $recipients,
                $this->compileFromHeadmasters($schoolIds, $jenjang, $excludedPhones)
            );
        }

        // Compile from gtk if category includes it
        if (in_array($category, ['gtk', 'both'])) {
            $recipients = array_merge(
                $recipients,
                $this->compileFromTeachers($schoolIds, $jenjang, $excludedPhones)
            );
        }

        // Deduplicate by phone number (keep first occurrence)
        $recipients = $this->deduplicateByPhone($recipients);

        return $recipients;
    }

    /**
     * Compile recipients from school headmasters (kepala_whatsapp).
     *
     * @param array $schoolIds School IDs to filter by (empty = all)
     * @param array $jenjang Jenjang levels to filter by (empty = all)
     * @param array $excludedPhones Excluded phone numbers
     * @return array Array of recipient data
     */
    private function compileFromHeadmasters(
        array $schoolIds = [],
        array $jenjang = [],
        array $excludedPhones = []
    ): array {
        $query = School::query();

        // Filter by jenjang if provided
        if (!empty($jenjang)) {
            $query->whereIn('jenjang', $jenjang);
        }

        // Filter by school IDs if provided
        if (!empty($schoolIds)) {
            $query->whereIn('id', $schoolIds);
        }

        // Only include schools with non-empty kepala_whatsapp
        $query->whereNotNull('kepala_whatsapp')
            ->where('kepala_whatsapp', '!=', '');

        $schools = $query->get();

        $recipients = [];

        foreach ($schools as $school) {
            $normalizedPhone = $this->phoneNormalizer->normalize($school->kepala_whatsapp);

            // Skip if phone is in excluded list
            if (in_array($normalizedPhone, $excludedPhones)) {
                continue;
            }

            $isValid = $this->phoneNormalizer->isValid($normalizedPhone);

            $recipients[] = [
                'recipient_name' => $school->kepala_madrasah ?? 'Kepala Madrasah',
                'school_name' => $school->nama,
                'phone_number' => $normalizedPhone,
                'recipient_type' => 'kepala_sekolah',
                'delivery_status' => $isValid ? 'pending' : 'invalid_number',
            ];
        }

        return $recipients;
    }

    /**
     * Compile recipients from teachers (phone_number).
     *
     * @param array $schoolIds School IDs to filter by (empty = all)
     * @param array $jenjang Jenjang levels to filter by (empty = all)
     * @param array $excludedPhones Excluded phone numbers
     * @return array Array of recipient data
     */
    private function compileFromTeachers(
        array $schoolIds = [],
        array $jenjang = [],
        array $excludedPhones = []
    ): array {
        $query = Teacher::query()
            ->where('is_active', true)
            ->whereNotNull('phone_number')
            ->where('phone_number', '!=', '');

        // Filter by jenjang via school relationship
        if (!empty($jenjang)) {
            $query->whereHas('school', function ($q) use ($jenjang) {
                $q->whereIn('jenjang', $jenjang);
            });
        }

        // Filter by school IDs if provided
        if (!empty($schoolIds)) {
            $query->whereIn('school_id', $schoolIds);
        }

        $teachers = $query->with('school')->get();

        $recipients = [];

        foreach ($teachers as $teacher) {
            $normalizedPhone = $this->phoneNormalizer->normalize($teacher->phone_number);

            // Skip if phone is in excluded list
            if (in_array($normalizedPhone, $excludedPhones)) {
                continue;
            }

            $isValid = $this->phoneNormalizer->isValid($normalizedPhone);

            $recipients[] = [
                'recipient_name' => $teacher->nama,
                'school_name' => $teacher->school->nama,
                'phone_number' => $normalizedPhone,
                'recipient_type' => 'gtk',
                'delivery_status' => $isValid ? 'pending' : 'invalid_number',
            ];
        }

        return $recipients;
    }

    /**
     * Deduplicate recipients by phone number, keeping first occurrence.
     *
     * @param array $recipients Array of recipient data
     * @return array Deduplicated array
     */
    private function deduplicateByPhone(array $recipients): array
    {
        $seen = [];
        $deduplicated = [];

        foreach ($recipients as $recipient) {
            $phone = $recipient['phone_number'];

            if (!isset($seen[$phone])) {
                $seen[$phone] = true;
                $deduplicated[] = $recipient;
            }
        }

        return $deduplicated;
    }
}
