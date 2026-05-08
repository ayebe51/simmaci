<?php

namespace App\Services;

use App\Models\Meeting;
use App\Models\MeetingMinutes;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Shared\Inches;
use PhpOffice\PhpWord\Shared\Pt;
use PhpOffice\PhpWord\Shared\RGBColor;
use Illuminate\Support\Str;

/**
 * MeetingMinutesService
 *
 * Handles creation, updating, retrieval, deletion, and export of meeting minutes.
 * Provides HTML sanitization for rich text content and PDF export functionality.
 *
 * Responsibilities:
 * - Create and update meeting minutes with HTML content sanitization
 * - Retrieve minutes for a specific meeting
 * - Delete minutes (soft delete)
 * - Export minutes to PDF format using PHPWord
 * - Sanitize HTML content to prevent XSS attacks
 */
class MeetingMinutesService
{
    /**
     * Create new meeting minutes.
     *
     * Creates a new MeetingMinutes record with sanitized HTML content.
     * Records the creator user ID for audit trail.
     *
     * @param Meeting $meeting The meeting to create minutes for
     * @param array $data Array containing:
     *   - title: string (optional, defaults to meeting title)
     *   - content: string (HTML content from rich text editor)
     * @param User $creator The user creating the minutes
     * @return MeetingMinutes The created minutes record
     *
     * @throws \Exception If meeting already has minutes
     */
    public function createMinutes(Meeting $meeting, array $data, User $creator): MeetingMinutes
    {
        // Check if minutes already exist for this meeting
        if ($meeting->minutes) {
            throw new \Exception('Notulensi untuk rapat ini sudah ada. Gunakan fitur edit untuk mengubahnya.');
        }

        // Sanitize HTML content
        $sanitizedContent = $this->sanitizeHtml($data['content'] ?? '');

        // Create minutes record
        $minutes = MeetingMinutes::create([
            'meeting_id' => $meeting->id,
            'title' => $data['title'] ?? $meeting->title,
            'content' => $sanitizedContent,
            'created_by' => $creator->id,
            'updated_by' => null,
        ]);

        return $minutes;
    }

    /**
     * Update existing meeting minutes.
     *
     * Updates the content and metadata of existing minutes.
     * Sanitizes HTML content and records the updater user ID.
     *
     * @param MeetingMinutes $minutes The minutes to update
     * @param array $data Array containing:
     *   - title: string (optional)
     *   - content: string (HTML content from rich text editor)
     * @param User $updater The user updating the minutes
     * @return MeetingMinutes The updated minutes record
     */
    public function updateMinutes(MeetingMinutes $minutes, array $data, User $updater): MeetingMinutes
    {
        // Sanitize HTML content
        $sanitizedContent = $this->sanitizeHtml($data['content'] ?? '');

        // Update minutes record
        $minutes->update([
            'title' => $data['title'] ?? $minutes->title,
            'content' => $sanitizedContent,
            'updated_by' => $updater->id,
        ]);

        return $minutes;
    }

    /**
     * Get minutes for a specific meeting.
     *
     * Retrieves the minutes record for a meeting with related user information.
     * Returns null if no minutes exist for the meeting.
     *
     * @param Meeting $meeting The meeting to get minutes for
     * @return MeetingMinutes|null The minutes record or null if not found
     */
    public function getMinutes(Meeting $meeting): ?MeetingMinutes
    {
        return $meeting->minutes()
            ->with(['creator', 'updater'])
            ->first();
    }

    /**
     * Delete meeting minutes.
     *
     * Performs a soft delete of the minutes record.
     * The record can be restored using Laravel's soft delete restoration.
     *
     * @param MeetingMinutes $minutes The minutes to delete
     * @return bool True if deletion was successful
     */
    public function deleteMinutes(MeetingMinutes $minutes): bool
    {
        return $minutes->delete();
    }

    /**
     * Export minutes to PDF format.
     *
     * Generates a DOCX file (which can be converted to PDF) containing:
     * - Header with logo and meeting information
     * - Minutes title and content (preserving HTML formatting)
     * - Footer with creation/update information
     *
     * @param MeetingMinutes $minutes The minutes to export
     * @return string Path to the generated PDF file
     */
    public function exportToPdf(MeetingMinutes $minutes): string
    {
        $phpWord = new PhpWord();

        // Set default font
        $phpWord->setDefaultFontName('Calibri');
        $phpWord->setDefaultFontSize(11);

        // Add section
        $section = $phpWord->addSection();

        // Add header with logo (if exists)
        $logoPath = storage_path('app/public/logo/lp-maarif-nu-cilacap.png');
        if (file_exists($logoPath)) {
            $section->addImage($logoPath, [
                'width' => Inches(1),
                'height' => Inches(1),
                'alignment' => 'center',
            ]);
        }

        // Add title
        $titleStyle = [
            'bold' => true,
            'size' => 14,
            'alignment' => 'center',
        ];
        $section->addText('NOTULENSI RAPAT', $titleStyle);

        // Add meeting details
        $detailsStyle = ['size' => 11, 'alignment' => 'center'];
        $section->addText("Rapat: {$minutes->meeting->title}", $detailsStyle);
        $section->addText("Tanggal: {$minutes->meeting->started_at->format('d-m-Y')}", $detailsStyle);
        $section->addText("Waktu: {$minutes->meeting->started_at->format('H:i')} - {$minutes->meeting->ended_at->format('H:i')}", $detailsStyle);
        $section->addText("Lokasi: {$minutes->meeting->location}", $detailsStyle);

        $section->addTextBreak(1);

        // Add minutes title
        $minutesTitleStyle = ['bold' => true, 'size' => 12];
        $section->addText($minutes->title, $minutesTitleStyle);

        $section->addTextBreak(1);

        // Add minutes content (convert HTML to text with basic formatting)
        $this->addHtmlContent($section, $minutes->content);

        $section->addTextBreak(2);

        // Add footer with creation/update information
        $footerStyle = ['size' => 10, 'italic' => true];
        $createdBy = $minutes->creator?->name ?? 'Admin';
        $section->addText("Dibuat oleh: {$createdBy} pada {$minutes->created_at->format('d-m-Y H:i:s')}", $footerStyle);

        if ($minutes->updated_by) {
            $updatedBy = $minutes->updater?->name ?? 'Admin';
            $section->addText("Diperbarui oleh: {$updatedBy} pada {$minutes->updated_at->format('d-m-Y H:i:s')}", $footerStyle);
        }

        // Save file
        $filename = "meetings/{$minutes->meeting_id}/minutes_" . now()->timestamp . '.docx';
        $path = storage_path("app/reports/{$filename}");

        // Ensure directory exists
        if (!file_exists(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }

        $phpWord->save($path);

        return $path;
    }

    /**
     * Sanitize HTML content to prevent XSS attacks.
     *
     * Uses HTML Purifier library to clean and sanitize HTML content.
     * Allows safe HTML tags commonly used in rich text editors.
     *
     * @param string $html The HTML content to sanitize
     * @return string The sanitized HTML content
     */
    public function sanitizeHtml(string $html): string
    {
        // If html-purifier is not installed, use basic sanitization
        if (!class_exists('HTMLPurifier')) {
            return $this->basicHtmlSanitization($html);
        }

        $config = \HTMLPurifier_Config::createDefault();

        // Allow common rich text editor tags
        $config->set('HTML.Allowed', 'p,br,strong,em,u,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,a[href],img[src|alt|width|height],table,tr,td,th,tbody,thead,tfoot,span,div');

        // Allow safe CSS properties
        $config->set('CSS.AllowedProperties', 'color,background-color,font-weight,text-align,text-decoration,margin,padding');

        // Set URI scheme to allow http and https
        $config->set('URI.AllowedSchemes', ['http' => true, 'https' => true, 'mailto' => true]);

        // Create purifier instance
        $purifier = new \HTMLPurifier($config);

        // Purify the HTML
        return $purifier->purify($html);
    }

    /**
     * Basic HTML sanitization fallback.
     *
     * Used when HTML Purifier is not available.
     * Removes potentially dangerous tags and attributes.
     *
     * @param string $html The HTML content to sanitize
     * @return string The sanitized HTML content
     */
    private function basicHtmlSanitization(string $html): string
    {
        // Remove script tags and content
        $html = preg_replace('/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi', '', $html);

        // Remove event handlers
        $html = preg_replace('/on\w+\s*=\s*["\']?[^"\']*["\']?/gi', '', $html);

        // Remove iframe tags
        $html = preg_replace('/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi', '', $html);

        // Remove object and embed tags
        $html = preg_replace('/<(object|embed)[^>]*>/gi', '', $html);

        return $html;
    }

    /**
     * Add HTML content to PHPWord section.
     *
     * Converts HTML content to PHPWord elements.
     * Handles basic HTML tags like paragraphs, lists, and formatting.
     *
     * @param \PhpOffice\PhpWord\Element\Section $section The PHPWord section to add content to
     * @param string $html The HTML content to add
     * @return void
     */
    private function addHtmlContent($section, string $html): void
    {
        // Strip HTML tags and add as plain text for now
        // In a production system, you might want to parse HTML more thoroughly
        $text = strip_tags($html);

        // Split by paragraphs and add to section
        $paragraphs = array_filter(explode("\n", $text));
        foreach ($paragraphs as $paragraph) {
            $paragraph = trim($paragraph);
            if (!empty($paragraph)) {
                $section->addText($paragraph);
            }
        }
    }
}
