<?php

namespace App\Services;

use App\Models\Meeting;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Settings;
use PhpOffice\PhpWord\Shared\Inches;
use PhpOffice\PhpWord\Shared\Pt;
use PhpOffice\PhpWord\Shared\RGBColor;

/**
 * MeetingReportService
 *
 * Generates PDF and Excel reports for meeting attendance.
 * Uses PHPWord (with DomPDF renderer) for PDF generation and Maatwebsite Excel for Excel export.
 */
class MeetingReportService
{
    /**
     * Generate PDF report for meeting attendance.
     *
     * Creates a PDF file with:
     * - Header: Logo + "DAFTAR HADIR RAPAT" + meeting details
     * - Stats table: Total/Hadir/Tidak Hadir/Delegasi/Walk-in
     * - Attendance table: No | Nama | Jabatan | Instansi | Status | Waktu Check-in | Verifikasi | Keterangan
     * - Footer: Tanggal cetak + nama admin
     *
     * @param Meeting $meeting
     * @return string Binary PDF content
     */
    public function generatePdf(Meeting $meeting): string
    {
        // Ensure participants and attendance are loaded
        $meeting->loadMissing(['participants.attendance', 'attendances']);

        // Configure PHPWord to use DomPDF renderer
        Settings::setPdfRendererName(Settings::PDF_RENDERER_DOMPDF);
        Settings::setPdfRendererPath(base_path('vendor/dompdf/dompdf'));

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
        $section->addText('DAFTAR HADIR RAPAT', $titleStyle);

        // Add meeting details
        $detailsStyle = ['size' => 11, 'alignment' => 'center'];
        $section->addText("Rapat: {$meeting->title}", $detailsStyle);
        $section->addText("Tanggal: {$meeting->started_at->format('d-m-Y')}", $detailsStyle);
        $section->addText("Waktu: {$meeting->started_at->format('H:i')} - {$meeting->ended_at->format('H:i')}", $detailsStyle);
        $section->addText("Lokasi: {$meeting->location}", $detailsStyle);

        if ($meeting->agenda) {
            $section->addText("Agenda: {$meeting->agenda}", $detailsStyle);
        }

        $section->addTextBreak(1);

        // Add statistics table
        $this->addStatsTable($section, $meeting);

        $section->addTextBreak(1);

        // Add attendance table
        $this->addAttendanceTable($section, $meeting);

        $section->addTextBreak(2);

        // Add minutes page if available
        if ($meeting->minutes) {
            $this->addMinutesPage($phpWord, $meeting);
        }

        // Add photos page if available
        if ($meeting->photos()->exists()) {
            $this->addPhotosPage($phpWord, $meeting);
        }

        // Add footer
        $footerStyle = ['size' => 10, 'italic' => true];
        $section->addText("Tanggal cetak: " . now()->format('d-m-Y H:i:s'), $footerStyle);
        $section->addText("Dicetak oleh: " . auth()->user()?->name ?? 'Admin', $footerStyle);

        // Save as PDF to a temporary file and return binary content
        $tempPath = tempnam(sys_get_temp_dir(), 'meeting_report_') . '.pdf';

        try {
            $writer = IOFactory::createWriter($phpWord, 'PDF');
            $writer->save($tempPath);

            $content = file_get_contents($tempPath);
        } finally {
            if (file_exists($tempPath)) {
                unlink($tempPath);
            }
        }

        return $content;
    }

    /**
     * Generate Excel report for meeting attendance.
     *
     * Creates an Excel file with:
     * - Sheet "Daftar Hadir" with columns: No | Nama | Jabatan | Instansi | Status | Waktu Check-in | Verifikasi | Keterangan
     *
     * @param Meeting $meeting
     * @return string Binary Excel content
     */
    public function generateExcel(Meeting $meeting): string
    {
        // Ensure participants and attendance are loaded
        $meeting->loadMissing(['participants.attendance', 'attendances']);

        // Create Excel export using proper Maatwebsite Excel interfaces
        $export = new class($meeting) implements FromCollection, WithHeadings {
            public function __construct(private Meeting $meeting) {}

            public function headings(): array
            {
                return ['No', 'Nama', 'Jabatan', 'Instansi', 'Status', 'Waktu Check-in', 'Verifikasi', 'Keterangan'];
            }

            public function collection()
            {
                $data = [];
                $no = 1;

                foreach ($this->meeting->participants as $participant) {
                    $attendance = $participant->attendance;
                    $status = $this->getAttendanceStatus($participant);
                    $checkedInAt = $attendance?->checked_in_at?->format('d-m-Y H:i:s') ?? '-';
                    $verification = $this->getVerification($attendance);
                    $notes = $this->getNotes($participant, $attendance);

                    $data[] = [
                        $no++,
                        $participant->name,
                        $participant->jabatan,
                        $participant->instansi,
                        $status,
                        $checkedInAt,
                        $verification,
                        $notes,
                    ];
                }

                // Add walk-in attendees
                $walkIns = $this->meeting->attendances()
                    ->where('attendance_type', 'qr_umum')
                    ->whereNull('participant_id')
                    ->get();

                foreach ($walkIns as $walkIn) {
                    $data[] = [
                        $no++,
                        $walkIn->walk_in_name,
                        $walkIn->walk_in_jabatan,
                        $walkIn->walk_in_instansi,
                        'Hadir (Walk-in)',
                        $walkIn->checked_in_at->format('d-m-Y H:i:s'),
                        '✓ Terverifikasi via QR Umum pada ' . $walkIn->checked_in_at->format('d-m-Y H:i:s'),
                        'Peserta walk-in',
                    ];
                }

                return collect($data);
            }

            private function getAttendanceStatus($participant): string
            {
                if (!$participant->attendance) {
                    return 'Tidak Hadir';
                }

                if ($participant->attendance->is_delegation) {
                    return 'Hadir (Delegasi)';
                }

                return 'Hadir';
            }

            private function getVerification($attendance): string
            {
                if (!$attendance) {
                    return '-';
                }

                if ($attendance->attendance_type === 'qr_personal') {
                    return '✓ Terverifikasi via QR Personal pada ' . $attendance->checked_in_at->format('d-m-Y H:i:s');
                }

                if ($attendance->attendance_type === 'manual') {
                    $adminName = $attendance->checkedInByAdmin?->name ?? 'Admin';
                    return "✓ Check-in Manual oleh {$adminName} pada " . $attendance->checked_in_at->format('d-m-Y H:i:s');
                }

                return '✓ Terverifikasi via QR Umum pada ' . $attendance->checked_in_at->format('d-m-Y H:i:s');
            }

            private function getNotes($participant, $attendance): string
            {
                if (!$attendance) {
                    return '-';
                }

                if ($attendance->is_delegation) {
                    $delegatedFor = $attendance->delegatedForParticipant?->name ?? 'Unknown';
                    return "Mewakili: {$delegatedFor}";
                }

                return '-';
            }
        };

        // Return binary Excel content directly
        return Excel::raw($export, \Maatwebsite\Excel\Excel::XLSX);
    }

    /**
     * Add statistics table to PDF section.
     *
     * @param \PhpOffice\PhpWord\Element\Section $section
     * @param Meeting $meeting
     */
    private function addStatsTable($section, Meeting $meeting): void
    {
        $stats = $this->calculateStats($meeting);

        $table = $section->addTable(['borderSize' => 6, 'borderColor' => '000000']);
        $table->addRow();
        $table->addCell(2000)->addText('Statistik', ['bold' => true]);
        $table->addCell(2000)->addText('Jumlah', ['bold' => true]);
        $table->addCell(2000)->addText('Persentase', ['bold' => true]);

        $table->addRow();
        $table->addCell(2000)->addText('Total Peserta');
        $table->addCell(2000)->addText((string) $stats['total']);
        $table->addCell(2000)->addText('100%');

        $table->addRow();
        $table->addCell(2000)->addText('Hadir');
        $table->addCell(2000)->addText((string) $stats['present']);
        $table->addCell(2000)->addText($stats['total'] > 0 ? round(($stats['present'] / $stats['total']) * 100, 1) . '%' : '0%');

        $table->addRow();
        $table->addCell(2000)->addText('Tidak Hadir');
        $table->addCell(2000)->addText((string) $stats['absent']);
        $table->addCell(2000)->addText($stats['total'] > 0 ? round(($stats['absent'] / $stats['total']) * 100, 1) . '%' : '0%');

        $table->addRow();
        $table->addCell(2000)->addText('Delegasi');
        $table->addCell(2000)->addText((string) $stats['delegation']);
        $table->addCell(2000)->addText($stats['total'] > 0 ? round(($stats['delegation'] / $stats['total']) * 100, 1) . '%' : '0%');

        $table->addRow();
        $table->addCell(2000)->addText('Walk-in');
        $table->addCell(2000)->addText((string) $stats['walk_in']);
        $table->addCell(2000)->addText('-');
    }

    /**
     * Add attendance table to PDF section.
     *
     * @param \PhpOffice\PhpWord\Element\Section $section
     * @param Meeting $meeting
     */
    private function addAttendanceTable($section, Meeting $meeting): void
    {
        $table = $section->addTable(['borderSize' => 6, 'borderColor' => '000000']);

        // Header row
        $table->addRow();
        $headerCells = ['No', 'Nama', 'Jabatan', 'Instansi', 'Status', 'Waktu Check-in', 'Verifikasi', 'Keterangan'];
        foreach ($headerCells as $header) {
            $table->addCell(1200)->addText($header, ['bold' => true]);
        }

        // Data rows
        $no = 1;

        foreach ($meeting->participants as $participant) {
            $attendance = $participant->attendance;
            $status = $this->getAttendanceStatus($participant);
            $checkedInAt = $attendance?->checked_in_at?->format('d-m-Y H:i:s') ?? '-';
            $verification = $this->getVerification($attendance);
            $notes = $this->getNotes($participant, $attendance);

            $table->addRow();
            $table->addCell(1200)->addText((string) $no++);
            $table->addCell(1200)->addText($participant->name);
            $table->addCell(1200)->addText($participant->jabatan);
            $table->addCell(1200)->addText($participant->instansi);
            $table->addCell(1200)->addText($status);
            $table->addCell(1200)->addText($checkedInAt);
            $table->addCell(1200)->addText($verification);
            $table->addCell(1200)->addText($notes);
        }

        // Add walk-in attendees
        $walkIns = $meeting->attendances()
            ->where('attendance_type', 'qr_umum')
            ->whereNull('participant_id')
            ->get();

        foreach ($walkIns as $walkIn) {
            $table->addRow();
            $table->addCell(1200)->addText((string) $no++);
            $table->addCell(1200)->addText($walkIn->walk_in_name);
            $table->addCell(1200)->addText($walkIn->walk_in_jabatan);
            $table->addCell(1200)->addText($walkIn->walk_in_instansi);
            $table->addCell(1200)->addText('Hadir (Walk-in)');
            $table->addCell(1200)->addText($walkIn->checked_in_at->format('d-m-Y H:i:s'));
            $table->addCell(1200)->addText('✓ Terverifikasi via QR Umum');
            $table->addCell(1200)->addText('Peserta walk-in');
        }
    }

    /**
     * Calculate attendance statistics.
     *
     * @param Meeting $meeting
     * @return array Statistics with keys: total, present, absent, delegation, walk_in
     */
    private function calculateStats(Meeting $meeting): array
    {
        $total = $meeting->participants->count();
        $present = $meeting->attendances()
            ->where('attendance_type', 'qr_personal')
            ->where('is_delegation', false)
            ->count();
        $delegation = $meeting->attendances()
            ->where('is_delegation', true)
            ->count();
        $walkIn = $meeting->attendances()
            ->where('attendance_type', 'qr_umum')
            ->whereNull('participant_id')
            ->count();
        $absent = $total - $present - $delegation;

        return [
            'total' => $total,
            'present' => $present,
            'absent' => max(0, $absent),
            'delegation' => $delegation,
            'walk_in' => $walkIn,
        ];
    }

    /**
     * Get attendance status for a participant.
     *
     * @param $participant
     * @return string
     */
    private function getAttendanceStatus($participant): string
    {
        if (!$participant->attendance) {
            return 'Tidak Hadir';
        }

        if ($participant->attendance->is_delegation) {
            return 'Hadir (Delegasi)';
        }

        return 'Hadir';
    }

    /**
     * Get verification text for attendance.
     *
     * @param $attendance
     * @return string
     */
    private function getVerification($attendance): string
    {
        if (!$attendance) {
            return '-';
        }

        if ($attendance->attendance_type === 'qr_personal') {
            return '✓ Terverifikasi via QR Personal pada ' . $attendance->checked_in_at->format('d-m-Y H:i:s');
        }

        if ($attendance->attendance_type === 'manual') {
            $adminName = $attendance->checkedInByAdmin?->name ?? 'Admin';
            return "✓ Check-in Manual oleh {$adminName} pada " . $attendance->checked_in_at->format('d-m-Y H:i:s');
        }

        return '✓ Terverifikasi via QR Umum pada ' . $attendance->checked_in_at->format('d-m-Y H:i:s');
    }

    /**
     * Get notes for attendance.
     *
     * @param $participant
     * @param $attendance
     * @return string
     */
    private function getNotes($participant, $attendance): string
    {
        if (!$attendance) {
            return '-';
        }

        if ($attendance->is_delegation) {
            $delegatedFor = $attendance->delegatedForParticipant?->name ?? 'Unknown';
            return "Mewakili: {$delegatedFor}";
        }

        return '-';
    }

    /**
     * Add minutes page to PDF.
     *
     * Creates a new section with the meeting minutes content.
     * Renders the HTML content from the rich text editor.
     *
     * @param PhpWord $phpWord
     * @param Meeting $meeting
     * @return void
     */
    private function addMinutesPage(PhpWord $phpWord, Meeting $meeting): void
    {
        // Add page break
        $section = $phpWord->addSection();

        // Add title
        $titleStyle = [
            'bold' => true,
            'size' => 14,
            'alignment' => 'center',
        ];
        $section->addText('NOTULENSI RAPAT', $titleStyle);

        // Add minutes title
        $subtitleStyle = ['size' => 12, 'bold' => true];
        $section->addText($meeting->minutes->title, $subtitleStyle);

        $section->addTextBreak(1);

        // Add minutes content
        // Strip HTML tags and convert to plain text for PHPWord compatibility
        $content = $meeting->minutes->content;
        
        // Convert common HTML tags to plain text
        $content = preg_replace('/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i', "\n$1\n", $content);
        $content = preg_replace('/<p[^>]*>(.*?)<\/p>/i', "$1\n", $content);
        $content = preg_replace('/<br\s*\/?>/i', "\n", $content);
        $content = preg_replace('/<li[^>]*>(.*?)<\/li>/i', "• $1\n", $content);
        $content = preg_replace('/<[^>]+>/', '', $content);
        $content = html_entity_decode($content);
        $content = trim($content);

        // Add content with word wrapping
        $contentStyle = ['size' => 11];
        $section->addText($content, $contentStyle);

        $section->addTextBreak(1);

        // Add metadata
        $metaStyle = ['size' => 10, 'italic' => true];
        $section->addText("Dibuat oleh: " . $meeting->minutes->creator?->name ?? 'Admin', $metaStyle);
        $section->addText("Tanggal: " . $meeting->minutes->created_at->format('d-m-Y H:i:s'), $metaStyle);
        
        if ($meeting->minutes->updated_by) {
            $section->addText("Diperbarui oleh: " . $meeting->minutes->updater?->name ?? 'Admin', $metaStyle);
            $section->addText("Tanggal update: " . $meeting->minutes->updated_at->format('d-m-Y H:i:s'), $metaStyle);
        }
    }

    /**
     * Add photos page to PDF.
     *
     * Creates a new section with thumbnails of all photos uploaded for the meeting.
     * Displays photos in a grid layout with captions.
     *
     * @param PhpWord $phpWord
     * @param Meeting $meeting
     * @return void
     */
    private function addPhotosPage(PhpWord $phpWord, Meeting $meeting): void
    {
        // Add page break
        $section = $phpWord->addSection();

        // Add title
        $titleStyle = [
            'bold' => true,
            'size' => 14,
            'alignment' => 'center',
        ];
        $section->addText('FOTO KEGIATAN RAPAT', $titleStyle);

        $section->addTextBreak(1);

        // Get all photos
        $photos = $meeting->photos()->get();

        if ($photos->isEmpty()) {
            $section->addText('Tidak ada foto untuk rapat ini.', ['italic' => true]);
            return;
        }

        // Add photo count
        $countStyle = ['size' => 11];
        $section->addText("Total foto: {$photos->count()}", $countStyle);

        $section->addTextBreak(1);

        // Create table for photos (2 columns)
        $table = $section->addTable(['borderSize' => 6, 'borderColor' => 'CCCCCC']);

        $photoCount = 0;
        $currentRow = null;

        foreach ($photos as $photo) {
            // Start new row every 2 photos
            if ($photoCount % 2 === 0) {
                $currentRow = $table->addRow();
            }

            // Get photo URL
            $photoUrl = $photo->getPhotoUrl();

            // Try to add image if it's accessible
            try {
                $cell = $currentRow->addCell(2500);
                
                // Add image with max width of 2.5 inches
                $cell->addImage($photoUrl, [
                    'width' => Inches(2.5),
                    'height' => Inches(2),
                    'alignment' => 'center',
                ]);

                // Add photo metadata below image
                $metaStyle = ['size' => 9];
                $cell->addText("Ukuran: {$photo->width}x{$photo->height}px", $metaStyle);
                $cell->addText("Diupload: " . $photo->created_at->format('d-m-Y H:i'), $metaStyle);
                $cell->addText("Oleh: " . $photo->uploader?->name ?? 'Admin', $metaStyle);
            } catch (\Exception $e) {
                // If image fails to load, add placeholder text
                $cell = $currentRow->addCell(2500);
                $cell->addText("[Foto tidak dapat ditampilkan]", ['italic' => true, 'size' => 9]);
                $cell->addText($photo->original_filename, ['size' => 9]);
            }

            $photoCount++;
        }

        $section->addTextBreak(1);

        // Add footer with photo summary
        $footerStyle = ['size' => 10, 'italic' => true];
        $section->addText("Total foto yang diupload: {$photos->count()}", $footerStyle);
    }
}
