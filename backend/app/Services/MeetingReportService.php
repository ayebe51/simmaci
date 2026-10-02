<?php

namespace App\Services;

use App\Models\Meeting;
use App\Traits\SanitizesExportFormulas;
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
    use SanitizesExportFormulas;
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
        $meeting->loadMissing(['participants.attendance', 'attendances', 'minutes.creator', 'photos.uploader', 'creator']);

        // Configure PHPWord to use DomPDF renderer
        Settings::setPdfRendererName(Settings::PDF_RENDERER_DOMPDF);
        Settings::setPdfRendererPath(base_path('vendor/dompdf/dompdf'));

        $phpWord = new PhpWord();
        $phpWord->setDefaultFontName('Calibri');
        $phpWord->setDefaultFontSize(10);

        // ── Page 1: Daftar Hadir & Berita Acara (Landscape) ──
        $section = $phpWord->addSection([
            'orientation' => 'landscape',
            'marginTop' => 500,
            'marginBottom' => 500,
            'marginLeft' => 700,
            'marginRight' => 700,
        ]);

        // Kop surat — load from setting (uploaded via Settings page), fallback to storage paths
        $kopTempPath = null;
        $kopSuratSetting = \App\Models\Setting::getValue('kop_surat_meeting');

        if ($kopSuratSetting) {
            // Setting contains a storage path (e.g., "logo/kop-surat.png")
            if (Storage::exists($kopSuratSetting)) {
                $kopContent = Storage::get($kopSuratSetting);
                $ext = pathinfo($kopSuratSetting, PATHINFO_EXTENSION) ?: 'png';
                $kopTempPath = tempnam(sys_get_temp_dir(), 'kop_') . '.' . $ext;
                file_put_contents($kopTempPath, $kopContent);
            }
        }

        if (!$kopTempPath) {
            // Fallback: try default path in storage
            $defaultKopPath = 'logo/kop-surat.png';
            if (Storage::exists($defaultKopPath)) {
                $kopContent = Storage::get($defaultKopPath);
                $kopTempPath = tempnam(sys_get_temp_dir(), 'kop_') . '.png';
                file_put_contents($kopTempPath, $kopContent);
            } else {
                // Last fallback: local filesystem
                $localKopPath = storage_path('app/public/logo/kop-surat.png');
                if (file_exists($localKopPath)) {
                    $kopTempPath = $localKopPath;
                }
            }
        }

        if ($kopTempPath && file_exists($kopTempPath)) {
            $section->addImage($kopTempPath, [
                'width' => 700,
                'alignment' => 'center',
            ]);
            $section->addTextBreak(1);
        } else {
            // Header resmi teks fallback jika kop gambar belum diunggah
            $section->addText("PENGURUS CABANG LEMBAGA PENDIDIKAN MA'ARIF NU KABUPATEN CILACAP", ['bold' => true, 'size' => 12], ['alignment' => 'center']);
            $section->addText("SISTEM INFORMASI MANAJEMEN MA'ARIF NU CILACAP (SIMMACI)", ['size' => 9, 'color' => '555555'], ['alignment' => 'center']);
            $section->addText("Jl. Masjid No. 09 Cilacap 53223 | info@maarifnu-cilacap.or.id", ['size' => 8, 'italic' => true, 'color' => '777777'], ['alignment' => 'center']);
            $section->addTextBreak(1);
        }

        // Header
        $section->addText(
            'LAPORAN PERTANGGUNGJAWABAN (LPJ) & DAFTAR HADIR RAPAT',
            ['bold' => true, 'size' => 13],
            ['alignment' => 'center', 'spaceAfter' => 80]
        );
        $section->addText(
            strtoupper($meeting->title),
            ['bold' => true, 'size' => 11],
            ['alignment' => 'center', 'spaceAfter' => 150]
        );

        // Meeting info
        $section->addText("Hari / Tanggal : {$meeting->started_at->translatedFormat('l, d F Y')}", ['size' => 9.5]);
        $section->addText("Waktu          : {$meeting->started_at->format('H:i')} - {$meeting->ended_at->format('H:i')} WIB", ['size' => 9.5]);
        $section->addText("Tempat         : {$meeting->location}", ['size' => 9.5]);
        if ($meeting->agenda) {
            $section->addText("Agenda         : {$meeting->agenda}", ['size' => 9.5]);
        }
        $section->addTextBreak(1);

        // Attendance table
        $this->addAttendanceTable($section, $meeting);

        $section->addTextBreak(1);

        // Summary
        $totalParticipants = $meeting->participants->count();
        $presentCount = $meeting->participants->filter(fn($p) => $p->attendance !== null)->count();
        $walkInsCount = $meeting->attendances()->where('attendance_type', 'qr_umum')->whereNull('participant_id')->count();
        $totalHadir = $presentCount + $walkInsCount;

        $section->addText(
            "Rekapitulasi: Undangan: {$totalParticipants} | Hadir: {$presentCount} | Walk-in: {$walkInsCount} | Total Hadir: {$totalHadir} | Tidak Hadir: " . max(0, $totalParticipants - $presentCount),
            ['size' => 9.5, 'bold' => true]
        );

        $section->addTextBreak(1);

        // Tanda Tangan Resmi (Pimpinan Rapat & Notulis)
        $signTable = $section->addTable(['borderSize' => 0, 'cellMargin' => 30]);
        $signTable->addRow();

        $notulisName = $meeting->minutes?->creator?->name ?? '............................................';
        $pimpinanName = $meeting->creator?->name ?? '............................................';
        $tanggalRapat = $meeting->started_at ? $meeting->started_at->translatedFormat('d F Y') : now()->translatedFormat('d F Y');

        $signTable->addCell(6000)->addText(
            "Notulis Rapat,\n\n\n\n\n( {$notulisName} )",
            ['size' => 9],
            ['alignment' => 'center']
        );

        $signTable->addCell(6000)->addText(
            "Cilacap, {$tanggalRapat}\nPimpinan Rapat,\n\n\n\n( {$pimpinanName} )",
            ['size' => 9],
            ['alignment' => 'center']
        );

        $section->addTextBreak(1);

        // Footer
        $section->addText(
            "Dokumen LPJ Rapat ini digenerate secara otomatis oleh SIMMACI pada: " . now()->format('d-m-Y H:i:s') . " WIB oleh " . (auth()->user()?->name ?? 'Admin'),
            ['size' => 7.5, 'italic' => true, 'color' => '777777']
        );

        // ── Page 2: Notulensi (if exists) ──
        if ($meeting->minutes) {
            $this->addMinutesPage($phpWord, $meeting);
        }

        // ── Page 3: Foto Kegiatan (if exists) ──
        $tempImageFiles = [];
        if ($meeting->photos->isNotEmpty()) {
            $this->addPhotosPage($phpWord, $meeting, $tempImageFiles);
        }

        // Save as PDF
        $tempPath = tempnam(sys_get_temp_dir(), 'meeting_report_') . '.pdf';

        try {
            $writer = IOFactory::createWriter($phpWord, 'PDF');
            $writer->save($tempPath);
            $content = file_get_contents($tempPath);
        } finally {
            // Clean up PDF temp file
            if (file_exists($tempPath)) {
                unlink($tempPath);
            }
            // Clean up photo temp files AFTER save (PHPWord reads images at save time)
            foreach ($tempImageFiles as $tempFile) {
                if (file_exists($tempFile)) {
                    @unlink($tempFile);
                }
            }
            // Clean up kop surat temp file (only if it was downloaded from S3)
            if ($kopTempPath && $kopTempPath !== ($localKopPath ?? '') && file_exists($kopTempPath)) {
                @unlink($kopTempPath);
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
                        ? 'Diwakili oleh: ' . ($attendance->walk_in_name ?? '-') . ($attendance->walk_in_jabatan ? ' (' . $attendance->walk_in_jabatan . ')' : '')
                        : '-';

                    $data[] = [
                        $no++,
                        MeetingReportService::sanitizeFormula($participant->name),
                        MeetingReportService::sanitizeFormula($participant->jabatan),
                        MeetingReportService::sanitizeFormula($participant->instansi),
                        MeetingReportService::sanitizeFormula($status),
                        $checkedInAt,
                        MeetingReportService::sanitizeFormula($verification),
                        MeetingReportService::sanitizeFormula($notes)
                    ];
                }

                // Walk-in attendees
                $walkIns = $this->meeting->attendances()->where('attendance_type', 'qr_umum')->whereNull('participant_id')->get();
                foreach ($walkIns as $walkIn) {
                    $data[] = [
                        $no++,
                        MeetingReportService::sanitizeFormula($walkIn->walk_in_name),
                        MeetingReportService::sanitizeFormula($walkIn->walk_in_jabatan),
                        MeetingReportService::sanitizeFormula($walkIn->walk_in_instansi),
                        'Hadir (Walk-in)',
                        $walkIn->checked_in_at->format('d-m-Y H:i:s'),
                        'Terverifikasi via QR Umum',
                        'Peserta walk-in',
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
                ? 'Diwakili oleh: ' . ($attendance->walk_in_name ?? '-') . ($attendance->walk_in_jabatan ? ' (' . $attendance->walk_in_jabatan . ')' : '')
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
        $section = $phpWord->addSection([
            'orientation' => 'portrait',
            'marginTop' => 500,
            'marginBottom' => 500,
            'marginLeft' => 700,
            'marginRight' => 700,
        ]);

        $section->addText('NOTULENSI RAPAT & KEPUTUSAN', ['bold' => true, 'size' => 13], ['alignment' => 'center', 'spaceAfter' => 60]);
        $section->addText(strtoupper($meeting->title), ['size' => 11, 'bold' => true], ['alignment' => 'center', 'spaceAfter' => 120]);
        $section->addTextBreak(1);

        // Strip HTML and render as plain text
        $content = $meeting->minutes->content ?? '';
        $content = preg_replace('/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i', "\n$1\n", $content);
        $content = preg_replace('/<p[^>]*>(.*?)<\/p>/i', "$1\n", $content);
        $content = preg_replace('/<br\s*\/?>/i', "\n", $content);
        $content = preg_replace('/<li[^>]*>(.*?)<\/li>/i', "• $1\n", $content);
        $content = preg_replace('/<[^>]+>/', '', $content);
        $content = html_entity_decode(trim($content));

        $section->addText("Ringkasan Pembahasan & Keputusan:", ['size' => 10, 'bold' => true]);
        $section->addText($content, ['size' => 9.5]);
        $section->addTextBreak(2);

        // Signatures for notulensi
        $notulisName = $meeting->minutes->creator?->name ?? 'Notulis';
        $pimpinanName = $meeting->creator?->name ?? 'Pimpinan Rapat';
        $tanggalRapat = $meeting->started_at ? $meeting->started_at->translatedFormat('d F Y') : now()->translatedFormat('d F Y');

        $notulensiSignTable = $section->addTable(['borderSize' => 0, 'cellMargin' => 40]);
        $notulensiSignTable->addRow();
        $notulensiSignTable->addCell(4500)->addText("Notulis Rapat,\n\n\n\n\n( {$notulisName} )", ['size' => 9], ['alignment' => 'center']);
        $notulensiSignTable->addCell(4500)->addText("Cilacap, {$tanggalRapat}\nMengetahui,\nPimpinan Rapat,\n\n\n\n( {$pimpinanName} )", ['size' => 9], ['alignment' => 'center']);
    }

    private function addPhotosPage(PhpWord $phpWord, Meeting $meeting, array &$tempFiles = []): void
    {
        $section = $phpWord->addSection([
            'orientation' => 'portrait',
            'marginTop' => 500,
            'marginBottom' => 500,
            'marginLeft' => 700,
            'marginRight' => 700,
        ]);

        $section->addText('DOKUMENTASI FOTO KEGIATAN RAPAT', ['bold' => true, 'size' => 13], ['alignment' => 'center', 'spaceAfter' => 60]);
        $section->addText(strtoupper($meeting->title), ['size' => 11, 'bold' => true], ['alignment' => 'center', 'spaceAfter' => 120]);
        $section->addTextBreak(1);

        $photos = $meeting->photos;
        $section->addText("Lampiran Dokumentasi ({$photos->count()} Foto Terverifikasi):", ['size' => 9.5, 'italic' => true]);
        $section->addTextBreak(1);

        $photoTable = $section->addTable(['borderSize' => 1, 'borderColor' => 'CCCCCC', 'cellMargin' => 60]);
        $chunks = $photos->chunk(2);

        foreach ($chunks as $chunk) {
            $photoTable->addRow();
            foreach ($chunk as $photo) {
                $cell = $photoTable->addCell(4500);
                try {
                    // Read photo binary from storage directly (not via URL)
                    if (Storage::exists($photo->storage_path)) {
                        $imageContent = Storage::get($photo->storage_path);
                        $tempImagePath = tempnam(sys_get_temp_dir(), 'photo_') . '.' . pathinfo($photo->original_filename, PATHINFO_EXTENSION);
                        file_put_contents($tempImagePath, $imageContent);

                        $cell->addImage($tempImagePath, [
                            'width' => 210,
                            'height' => 155,
                            'alignment' => 'center',
                        ]);

                        // Track temp file for cleanup AFTER save() — PHPWord reads images at save time
                        $tempFiles[] = $tempImagePath;
                    } else {
                        $cell->addText("[Foto tidak ditemukan: {$photo->original_filename}]", ['italic' => true, 'size' => 8]);
                    }
                } catch (\Exception $e) {
                    $cell->addText("[Gagal memuat foto: {$photo->original_filename}]", ['italic' => true, 'size' => 8]);
                }

                $cell->addText($photo->original_filename, ['size' => 8, 'bold' => true], ['alignment' => 'center']);
                $uploaderName = $photo->uploader?->name ?? 'Admin';
                $cell->addText("Diupload: " . $photo->created_at->format('d-m-Y H:i') . " ({$uploaderName})", ['size' => 7.5, 'italic' => true, 'color' => '666666'], ['alignment' => 'center']);
            }

            // Fill empty cell if odd number of photos in the row
            if ($chunk->count() < 2) {
                $photoTable->addCell(4500)->addText('');
            }
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
