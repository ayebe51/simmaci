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
     * Layout: Landscape orientation, no statistics table.
     * Pages: 1) Daftar Hadir  2) Notulensi (if exists)  3) Foto Kegiatan (if exists)
     *
     * @param Meeting $meeting
     * @return string Binary PDF content
     */
    public function generatePdf(Meeting $meeting): string
    {
        // Ensure participants and attendance are loaded
        $meeting->loadMissing(['participants.attendance', 'attendances', 'minutes', 'photos']);

        // Configure PHPWord to use DomPDF renderer
        Settings::setPdfRendererName(Settings::PDF_RENDERER_DOMPDF);
        Settings::setPdfRendererPath(base_path('vendor/dompdf/dompdf'));

        $phpWord = new PhpWord();
        $phpWord->setDefaultFontName('Calibri');
        $phpWord->setDefaultFontSize(10);

        // ── Page 1: Daftar Hadir (Landscape) ──
        $section = $phpWord->addSection([
            'orientation' => 'landscape',
            'marginTop' => 600,
            'marginBottom' => 600,
            'marginLeft' => 800,
            'marginRight' => 800,
        ]);

        // Kop surat (if exists)
        $kopPath = storage_path('app/public/logo/kop-surat.png');
        if (file_exists($kopPath)) {
            $section->addImage($kopPath, [
                'width' => 700,
                'alignment' => 'center',
            ]);
            $section->addTextBreak(1);
        }

        // Header
        $section->addText('DAFTAR HADIR RAPAT', ['bold' => true, 'size' => 14]);
        $section->addText("Rapat: {$meeting->title}", ['size' => 11]);
        $section->addText("Tanggal: {$meeting->started_at->format('d-m-Y')}", ['size' => 11]);
        $section->addText("Waktu: {$meeting->started_at->format('H:i')} - {$meeting->ended_at->format('H:i')}", ['size' => 11]);
        $section->addText("Lokasi: {$meeting->location}", ['size' => 11]);
        if ($meeting->agenda) {
            $section->addText("Agenda: {$meeting->agenda}", ['size' => 11]);
        }
        $section->addTextBreak(1);

        // Attendance table
        $this->addAttendanceTable($section, $meeting);

        $section->addTextBreak(2);

        // Footer
        $section->addText("Tanggal cetak: " . now()->format('d-m-Y H:i:s'), ['size' => 9, 'italic' => true]);
        $section->addText("Dicetak oleh: " . (auth()->user()?->name ?? 'Admin'), ['size' => 9, 'italic' => true]);

        // ── Page 2: Notulensi (if exists) ──
        if ($meeting->minutes) {
            $this->addMinutesPage($phpWord, $meeting);
        }

        // ── Page 3: Foto Kegiatan (if exists) ──
        if ($meeting->photos->isNotEmpty()) {
            $this->addPhotosPage($phpWord, $meeting);
        }

        // Save as PDF
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
     */
    public function generateExcel(Meeting $meeting): string
    {
        $meeting->loadMissing(['participants.attendance', 'attendances']);

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
                    $status = $attendance ? ($attendance->is_delegation ? 'Hadir (Delegasi)' : 'Hadir') : 'Tidak Hadir';
                    $checkedInAt = $attendance?->checked_in_at?->format('d-m-Y H:i:s') ?? '-';
                    $verification = $this->getVerification($attendance);
                    $notes = $attendance?->is_delegation
                        ? 'Mewakili: ' . ($attendance->delegatedForParticipant?->name ?? '-')
                        : '-';

                    $data[] = [$no++, $participant->name, $participant->jabatan, $participant->instansi, $status, $checkedInAt, $verification, $notes];
                }

                // Walk-in attendees
                $walkIns = $this->meeting->attendances()->where('attendance_type', 'qr_umum')->whereNull('participant_id')->get();
                foreach ($walkIns as $walkIn) {
                    $data[] = [
                        $no++, $walkIn->walk_in_name, $walkIn->walk_in_jabatan, $walkIn->walk_in_instansi,
                        'Hadir (Walk-in)', $walkIn->checked_in_at->format('d-m-Y H:i:s'),
                        'Terverifikasi via QR Umum', 'Peserta walk-in',
                    ];
                }

                return collect($data);
            }

            private function getVerification($attendance): string
            {
                if (!$attendance) return '-';
                $time = $attendance->checked_in_at->format('d-m-Y H:i:s');
                return match ($attendance->attendance_type) {
                    'qr_personal' => "Terverifikasi via QR Personal pada {$time}",
                    'manual' => "Check-in Manual oleh " . ($attendance->checkedInByAdmin?->name ?? 'Admin') . " pada {$time}",
                    default => "Terverifikasi via QR Umum pada {$time}",
                };
            }
        };

        return Excel::raw($export, \Maatwebsite\Excel\Excel::XLSX);
    }

    // ── Private Methods ──

    private function addAttendanceTable($section, Meeting $meeting): void
    {
        $table = $section->addTable(['borderSize' => 4, 'borderColor' => '000000', 'cellMargin' => 50]);

        // Header row
        $headerStyle = ['bold' => true, 'size' => 9];
        $table->addRow();
        $table->addCell(500)->addText('No', $headerStyle);
        $table->addCell(2500)->addText('Nama', $headerStyle);
        $table->addCell(1500)->addText('Jabatan', $headerStyle);
        $table->addCell(2500)->addText('Instansi', $headerStyle);
        $table->addCell(1200)->addText('Status', $headerStyle);
        $table->addCell(2000)->addText('Waktu Check-in', $headerStyle);
        $table->addCell(3500)->addText('Verifikasi', $headerStyle);
        $table->addCell(1800)->addText('Keterangan', $headerStyle);

        // Data rows
        $no = 1;
        $cellStyle = ['size' => 9];

        foreach ($meeting->participants as $participant) {
            $attendance = $participant->attendance;
            $status = $attendance ? ($attendance->is_delegation ? 'Hadir (Delegasi)' : 'Hadir') : 'Tidak Hadir';
            $checkedInAt = $attendance?->checked_in_at?->format('d-m-Y H:i:s') ?? '-';
            $verification = $this->getVerification($attendance);
            $notes = $attendance?->is_delegation
                ? 'Mewakili: ' . ($attendance->delegatedForParticipant?->name ?? '-')
                : '-';

            $table->addRow();
            $table->addCell(500)->addText((string) $no++, $cellStyle);
            $table->addCell(2500)->addText($participant->name, $cellStyle);
            $table->addCell(1500)->addText($participant->jabatan, $cellStyle);
            $table->addCell(2500)->addText($participant->instansi, $cellStyle);
            $table->addCell(1200)->addText($status, $cellStyle);
            $table->addCell(2000)->addText($checkedInAt, $cellStyle);
            $table->addCell(3500)->addText($verification, $cellStyle);
            $table->addCell(1800)->addText($notes, $cellStyle);
        }

        // Walk-in attendees
        $walkIns = $meeting->attendances()->where('attendance_type', 'qr_umum')->whereNull('participant_id')->get();
        foreach ($walkIns as $walkIn) {
            $table->addRow();
            $table->addCell(500)->addText((string) $no++, $cellStyle);
            $table->addCell(2500)->addText($walkIn->walk_in_name, $cellStyle);
            $table->addCell(1500)->addText($walkIn->walk_in_jabatan, $cellStyle);
            $table->addCell(2500)->addText($walkIn->walk_in_instansi, $cellStyle);
            $table->addCell(1200)->addText('Hadir (Walk-in)', $cellStyle);
            $table->addCell(2000)->addText($walkIn->checked_in_at->format('d-m-Y H:i:s'), $cellStyle);
            $table->addCell(3500)->addText('Terverifikasi via QR Umum', $cellStyle);
            $table->addCell(1800)->addText('Peserta walk-in', $cellStyle);
        }
    }

    private function addMinutesPage(PhpWord $phpWord, Meeting $meeting): void
    {
        $section = $phpWord->addSection();

        $section->addText('NOTULENSI RAPAT', ['bold' => true, 'size' => 14]);
        $section->addText($meeting->title, ['size' => 12, 'bold' => true]);
        $section->addTextBreak(1);

        // Strip HTML and render as plain text
        $content = $meeting->minutes->content ?? '';
        $content = preg_replace('/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i', "\n$1\n", $content);
        $content = preg_replace('/<p[^>]*>(.*?)<\/p>/i', "$1\n", $content);
        $content = preg_replace('/<br\s*\/?>/i', "\n", $content);
        $content = preg_replace('/<li[^>]*>(.*?)<\/li>/i', "• $1\n", $content);
        $content = preg_replace('/<[^>]+>/', '', $content);
        $content = html_entity_decode(trim($content));

        $section->addText($content, ['size' => 11]);
        $section->addTextBreak(1);

        $section->addText("Dibuat oleh: " . ($meeting->minutes->creator?->name ?? 'Admin'), ['size' => 10, 'italic' => true]);
        $section->addText("Tanggal: " . $meeting->minutes->created_at->format('d-m-Y H:i:s'), ['size' => 10, 'italic' => true]);
    }

    private function addPhotosPage(PhpWord $phpWord, Meeting $meeting): void
    {
        $section = $phpWord->addSection();

        $section->addText('FOTO KEGIATAN RAPAT', ['bold' => true, 'size' => 14]);
        $section->addTextBreak(1);

        $photos = $meeting->photos;
        $section->addText("Total foto: {$photos->count()}", ['size' => 11]);
        $section->addTextBreak(1);

        foreach ($photos as $photo) {
            try {
                // Read photo binary from storage directly (not via URL)
                if (Storage::exists($photo->storage_path)) {
                    $imageContent = Storage::get($photo->storage_path);
                    $tempImagePath = tempnam(sys_get_temp_dir(), 'photo_') . '.' . pathinfo($photo->original_filename, PATHINFO_EXTENSION);
                    file_put_contents($tempImagePath, $imageContent);

                    $section->addImage($tempImagePath, [
                        'width' => 400,
                        'height' => 300,
                        'alignment' => 'center',
                    ]);

                    // Clean up temp file
                    @unlink($tempImagePath);
                } else {
                    $section->addText("[Foto tidak ditemukan: {$photo->original_filename}]", ['italic' => true, 'size' => 9]);
                }
            } catch (\Exception $e) {
                $section->addText("[Gagal memuat foto: {$photo->original_filename}]", ['italic' => true, 'size' => 9]);
            }

            $section->addText($photo->original_filename, ['size' => 9]);
            $section->addText("Diupload: " . $photo->created_at->format('d-m-Y H:i') . " oleh " . ($photo->uploader?->name ?? 'Admin'), ['size' => 9, 'italic' => true]);
            $section->addTextBreak(1);
        }
    }

    private function getVerification($attendance): string
    {
        if (!$attendance) return '-';
        $time = $attendance->checked_in_at->format('d-m-Y H:i:s');
        return match ($attendance->attendance_type) {
            'qr_personal' => "Terverifikasi via QR Personal pada {$time}",
            'manual' => "Check-in Manual oleh " . ($attendance->checkedInByAdmin?->name ?? 'Admin') . " pada {$time}",
            default => "Terverifikasi via QR Umum pada {$time}",
        };
    }
}
