<?php

namespace App\Services;

/**
 * PhoneNormalizerService
 *
 * Handles normalization and validation of Indonesian WhatsApp phone numbers.
 * Converts various formats (0812..., +6281..., 6281...) to standard format (62xxxxxxxxx).
 */
class PhoneNormalizerService
{
    /**
     * Normalize a phone number to standard Indonesian WhatsApp format.
     *
     * Removes spaces and hyphens, converts leading 0 to 62, removes + prefix.
     * Result format: 62[0-9]{9,13}
     *
     * @param string $phone Raw phone number
     * @return string Normalized phone number
     */
    public function normalize(string $phone): string
    {
        // Remove spaces and hyphens
        $phone = str_replace([' ', '-'], '', $phone);

        // Remove leading + if present
        $phone = ltrim($phone, '+');

        // Replace leading 0 with 62
        if (str_starts_with($phone, '0')) {
            $phone = '62' . substr($phone, 1);
        }

        return $phone;
    }

    /**
     * Validate if a normalized phone number matches the valid pattern.
     *
     * Valid pattern: ^62[0-9]{9,13}$
     * - Starts with 62 (Indonesia country code)
     * - Followed by 9-13 digits
     *
     * @param string $normalizedPhone Normalized phone number
     * @return bool True if valid, false otherwise
     */
    public function isValid(string $normalizedPhone): bool
    {
        return (bool) preg_match('/^62[0-9]{9,13}$/', $normalizedPhone);
    }
}
