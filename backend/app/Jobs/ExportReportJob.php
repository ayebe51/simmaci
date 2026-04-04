<?php

namespace App\Jobs;

use App\Models\School;
use App\Models\SkDocument;
use App\Models\Teacher;
use App\Models\Student;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class ExportReportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 300;

    public function __construct(
        public string $reportType, // 'teachers', 'students', 'sk', 'schools'
        public ?int $schoolId = null,
        public string $format = 'csv' // csv or json
    ) {}

    public function handle(): void
    {
        $data = match ($this->reportType) {
            'teachers' => $this->exportTeachers(),
            'students' => $this->exportStudents(),
            'sk' => $this->exportSk(),
            'schools' => $this->exportSchools(),
            default => [],
        };

        $filename = "exports/{$this->reportType}_" . now()->format('Ymd_His');

        if ($this->format === 'json') {
            $content = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            $filename .= '.json';
        } else {
            $content = $this->toCsv($data);
            $filename .= '.csv';
        }

        Storage::disk('local')->put($filename, $content);
    }

    private function exportTeachers(): array
    {
        $query = Teacher::with('school');
        if ($this->schoolId) $query->where('school_id', $this->schoolId);

        return $query->get()->map(fn($t) => [
            'nama' => $t->nama,
            'nuptk' => $t->nuptk,
            'nim' => $t->nomor_induk_maarif,
            'unit_kerja' => $t->unit_kerja,
            'status' => $t->status,
            'is_active' => $t->is_active ? 'Ya' : 'Tidak',
            'is_certified' => $t->is_certified ? 'Ya' : 'Tidak',
        ])->toArray();
    }

    private function exportStudents(): array
    {
        $query = Student::with('school');
        if ($this->schoolId) $query->where('school_id', $this->schoolId);

        return $query->get()->map(fn($s) => [
            'nama' => $s->nama,
            'nisn' => $s->nisn,
            'sekolah' => $s->nama_sekolah,
            'kelas' => $s->kelas,
            'status' => $s->status,
        ])->toArray();
    }

    private function exportSk(): array
    {
        $query = SkDocument::with('teacher');
        if ($this->schoolId) $query->where('school_id', $this->schoolId);

        return $query->get()->map(fn($sk) => [
            'nomor_sk' => $sk->nomor_sk,
            'nama' => $sk->nama,
            'jenis_sk' => $sk->jenis_sk,
            'unit_kerja' => $sk->unit_kerja,
            'status' => $sk->status,
            'tanggal' => $sk->tanggal_penetapan,
        ])->toArray();
    }

    private function exportSchools(): array
    {
        return School::all()->map(fn($s) => [
            'nama' => $s->nama,
            'nsm' => $s->nsm,
            'npsn' => $s->npsn,
            'npsm_nu' => $s->npsm_nu,
            'kecamatan' => $s->kecamatan,
            'kepala_madrasah' => $s->kepala_madrasah,
        ])->toArray();
    }

    private function toCsv(array $data): string
    {
        if (empty($data)) return '';

        $output = fopen('php://temp', 'r+');
        fputcsv($output, array_keys($data[0]));
        foreach ($data as $row) {
            fputcsv($output, $row);
        }
        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        return $csv;
    }
}
