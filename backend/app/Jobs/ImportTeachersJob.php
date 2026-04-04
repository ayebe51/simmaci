<?php

namespace App\Jobs;

use App\Models\School;
use App\Models\Teacher;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ImportTeachersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 600;

    public function __construct(
        public array $rows,
        public string $importedBy = 'system'
    ) {}

    public function handle(): void
    {
        $created = 0;
        $updated = 0;
        $errors = [];
        $schoolCache = [];

        foreach ($this->rows as $idx => $row) {
            try {
                // Resolve school_id from unit_kerja
                $schoolId = null;
                $unitKerja = $row['unit_kerja'] ?? $row['unitKerja'] ?? null;

                if ($unitKerja) {
                    if (!isset($schoolCache[$unitKerja])) {
                        $school = School::where('nama', $unitKerja)->first();
                        $schoolCache[$unitKerja] = $school?->id;
                    }
                    $schoolId = $schoolCache[$unitKerja];
                }

                $data = [
                    'nama' => $row['nama'] ?? $row['name'] ?? '',
                    'nuptk' => $row['nuptk'] ?? null,
                    'nomor_induk_maarif' => $row['nomor_induk_maarif'] ?? $row['nim'] ?? null,
                    'nip' => $row['nip'] ?? null,
                    'jenis_kelamin' => $row['jenis_kelamin'] ?? null,
                    'tempat_lahir' => $row['tempat_lahir'] ?? null,
                    'tanggal_lahir' => $row['tanggal_lahir'] ?? null,
                    'pendidikan_terakhir' => $row['pendidikan_terakhir'] ?? null,
                    'mapel' => $row['mapel'] ?? null,
                    'unit_kerja' => $unitKerja,
                    'school_id' => $schoolId,
                    'status' => $row['status'] ?? null,
                    'phone_number' => $row['phone_number'] ?? $row['telepon'] ?? null,
                    'email' => $row['email'] ?? null,
                    'pdpkpnu' => $row['pdpkpnu'] ?? null,
                    'is_active' => true,
                ];

                $identifier = $row['nuptk'] ?? null;

                if ($identifier) {
                    $result = Teacher::updateOrCreate(
                        ['nuptk' => $identifier],
                        $data
                    );
                    $result->wasRecentlyCreated ? $created++ : $updated++;
                } else {
                    Teacher::create($data);
                    $created++;
                }
            } catch (\Throwable $e) {
                $errors[] = "Row {$idx}: {$e->getMessage()}";
            }
        }

        Log::info("ImportTeachersJob completed", [
            'created' => $created,
            'updated' => $updated,
            'errors' => count($errors),
            'imported_by' => $this->importedBy,
        ]);
    }
}
