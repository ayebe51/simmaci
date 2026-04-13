<?php

namespace App\Jobs;

use App\Models\SkDocument;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\IOFactory;

class GenerateSkDocxJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 120;

    public function __construct(
        public int $skDocumentId,
        public string $templateType = 'default'
    ) {}

    public function handle(): void
    {
        $sk = SkDocument::with('teacher', 'school')->findOrFail($this->skDocumentId);

        $phpWord = new PhpWord();
        $section = $phpWord->addSection();

        // Header
        $section->addText('SURAT KEPUTUSAN', ['bold' => true, 'size' => 16], ['alignment' => 'center']);
        $section->addText("Nomor: {$sk->nomor_sk}", ['name' => 'Consolas', 'bold' => true, 'size' => 12], ['alignment' => 'center']);
        $section->addTextBreak(1);

        // Content
        $section->addText("Jenis SK: {$sk->jenis_sk}");
        
        $textRun = $section->addTextRun();
        $textRun->addText("Nama: ");
        $textRun->addText($sk->nama, ['bold' => true]);
        
        $section->addText("Jabatan: " . ($sk->jabatan ?? '-'));
        $section->addText("Unit Kerja: " . ($sk->unit_kerja ?? '-'));

        $tglPenetapan = \Carbon\Carbon::parse($sk->tanggal_penetapan)->locale('id')->translatedFormat('d F Y');
        $section->addText("Tanggal Penetapan: {$tglPenetapan}");

        if ($sk->teacher) {
            $section->addTextBreak(1);
            $section->addText("NUPTK: " . ($sk->teacher->nuptk ?? '-'));
            $nim = $sk->teacher->nomor_induk_maarif ?? '-';
            $section->addText("NIM: {$nim}");
            
            if ($sk->teacher->tmt) {
                $tmtFormatted = \Carbon\Carbon::parse($sk->teacher->tmt)->locale('id')->translatedFormat('d F Y');
                $section->addText("Terhitung Mulai Tanggal (TMT): {$tmtFormatted}");
            }
        }

        // Save to temp then upload to S3
        $filename = "sk/{$sk->nomor_sk}.docx";
        $tempPath = tempnam(sys_get_temp_dir(), 'sk_') . '.docx';

        $writer = IOFactory::createWriter($phpWord, 'Word2007');
        $writer->save($tempPath);

        // Upload to S3 storage
        Storage::disk('s3')->put($filename, file_get_contents($tempPath));
        unlink($tempPath);

        // Update SK document with file URL
        $sk->update([
            'file_url' => Storage::disk('s3')->url($filename),
            'status' => 'active',
        ]);

        // Mark teacher as SK generated
        if ($sk->teacher) {
            $sk->teacher->update(['is_sk_generated' => true]);
        }
    }
}
