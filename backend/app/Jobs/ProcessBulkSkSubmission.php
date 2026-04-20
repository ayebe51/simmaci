<?php

namespace App\Jobs;

use App\Models\School;
use App\Models\Teacher;
use App\Models\SkDocument;
use App\Models\ActivityLog;
use App\Models\User;
use App\Services\NormalizationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessBulkSkSubmission implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // 10 minutes timeout for large batches
    public $tries = 1; // Don't retry on failure

    /**
     * Create a new job instance.
     */
    public function __construct(
        public array $documents,
        public string $suratPermohonanUrl,
        public int $userId,
        public string $userEmail,
        public ?int $userSchoolId = null,
        public string $userRole = 'operator'
    ) {}

    /**
     * Execute the job.
     */
    public function handle(NormalizationService $normalizationService): void
    {
        Log::info('ProcessBulkSkSubmission: Starting', [
            'total_documents' => count($this->documents),
            'user_id' => $this->userId,
        ]);

        $created = 0;
        $skipped = 0;
        $errors = [];
        $schoolCache = [];
        $year = now()->year;

        // Get the highest existing REQ/{year}/NNNN sequence number in one query,
        // then increment locally — avoids a per-row existence-check loop.
        $maxSeq = (int) SkDocument::withoutTenantScope()
            ->whereYear('created_at', $year)
            ->where('nomor_sk', 'like', "REQ/{$year}/%")
            ->selectRaw("MAX(CAST(SPLIT_PART(nomor_sk, '/', 3) AS INTEGER)) as max_seq")
            ->value('max_seq');
        $seq = $maxSeq;

        foreach ($this->documents as $index => $doc) {
            try {
                // Normalize school name and teacher name before processing
                $doc['unit_kerja'] = $normalizationService->normalizeSchoolName($doc['unit_kerja'] ?? null);
                $doc['nama'] = $normalizationService->normalizeTeacherName($doc['nama']);

                $schoolId = null;

                // Force user's school if operator
                if ($this->userRole === 'operator') {
                    $schoolId = $this->userSchoolId;
                    // If unit_kerja is blank, fall back to the operator's school name
                    if (empty(trim((string)($doc['unit_kerja'] ?? '')))) {
                        if (!isset($schoolCache['__operator__'])) {
                            $schoolCache['__operator__'] = School::find($schoolId)?->nama;
                        }
                        $doc['unit_kerja'] = $schoolCache['__operator__'];
                    }
                } elseif (isset($doc['unit_kerja'])) {
                    // Case-insensitive school lookup with normalized name
                    if (!isset($schoolCache[$doc['unit_kerja']])) {
                        $schoolCache[$doc['unit_kerja']] = School::where('nama', 'ILIKE', $doc['unit_kerja'])->value('id');
                    }
                    $schoolId = $schoolCache[$doc['unit_kerja']];
                }

                // Upsert Teacher with normalized data
                $teacherData = [
                    'nama'                => $doc['nama'],
                    'nuptk'               => $doc['nuptk'] ?? null,
                    'nip'                 => $doc['nip'] ?? null,
                    'nomor_induk_maarif'  => $doc['nomor_induk_maarif'] ?? null,
                    'unit_kerja'          => $doc['unit_kerja'] ?? null,
                    'school_id'           => $schoolId,
                    'tempat_lahir'        => $doc['tempat_lahir'] ?? null,
                    'tanggal_lahir'       => $doc['tanggal_lahir'] ?? null,
                    'pendidikan_terakhir' => $doc['pendidikan_terakhir'] ?? null,
                    'tmt'                 => $doc['tmt'] ?? null,
                    'kecamatan'           => $doc['kecamatan'] ?? null,
                    'status'              => $doc['status'] ?? 'Draft',
                    'is_verified'         => false,
                ];

                // Sync NIP and NIM if one is empty
                if (empty($teacherData['nip']) && !empty($teacherData['nomor_induk_maarif'])) {
                    $teacherData['nip'] = $teacherData['nomor_induk_maarif'];
                }
                if (empty($teacherData['nomor_induk_maarif']) && !empty($teacherData['nip'])) {
                    $teacherData['nomor_induk_maarif'] = $teacherData['nip'];
                }

                // Find existing teacher
                $teacher = null;
                if (!empty($teacherData['nuptk'])) {
                    $teacher = Teacher::where('nuptk', $teacherData['nuptk'])->first();
                }

                if (!$teacher && !empty($teacherData['nip'])) {
                    $teacher = Teacher::where('nip', $teacherData['nip'])->first();
                }

                if (!$teacher && !empty($teacherData['nomor_induk_maarif'])) {
                    $teacher = Teacher::where('nomor_induk_maarif', $teacherData['nomor_induk_maarif'])->first();
                }

                if (!$teacher) {
                    $teacher = Teacher::where('nama', $teacherData['nama'])
                        ->where('school_id', $schoolId)
                        ->first();
                }

                if ($teacher) {
                    $teacher->update($teacherData);
                } else {
                    $teacher = Teacher::create($teacherData);
                }

                // Auto-generate unique nomor_sk: increment local counter, no per-row DB loop
                $seq++;
                $nomorSk = 'REQ/' . $year . '/' . str_pad($seq, 4, '0', STR_PAD_LEFT);

                $jenisSk = $doc['status_kepegawaian'] ?? $doc['status'] ?? $doc['jenis_sk'] ?? 'GTY';

                SkDocument::create([
                    'nomor_sk'             => $nomorSk,
                    'teacher_id'           => $teacher->id,
                    'nama'                 => $doc['nama'],
                    'jenis_sk'             => $jenisSk,
                    'unit_kerja'           => $doc['unit_kerja'] ?? null,
                    'school_id'            => $schoolId,
                    'surat_permohonan_url' => $this->suratPermohonanUrl,
                    'nomor_permohonan'     => $doc['nomor_permohonan'] ?? null,
                    'tanggal_permohonan'   => $doc['tanggal_permohonan'] ?? null,
                    'status'               => 'pending',
                    'created_by'           => $this->userEmail,
                    'tanggal_penetapan'    => now()->format('Y-m-d'),
                ]);

                $created++;

                // Log progress every 10 records
                if ($created % 10 === 0) {
                    Log::info("ProcessBulkSkSubmission: Progress {$created}/{$this->documents->count()}");
                }
            } catch (\Throwable $e) {
                $skipped++;
                $errors[] = [
                    'row' => $index + 1,
                    'nama' => $doc['nama'] ?? 'unknown',
                    'error' => $e->getMessage(),
                ];

                Log::warning('ProcessBulkSkSubmission: skip row', [
                    'row' => $index + 1,
                    'nama' => $doc['nama'] ?? 'unknown',
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Create activity log
        try {
            $user = User::find($this->userId);
            ActivityLog::log(
                description: "Bulk Pengajuan SK: {$created} permohonan dibuat, {$skipped} dilewati",
                event: 'bulk_sk_request',
                logName: 'sk',
                causer: $user,
                schoolId: $this->userSchoolId
            );
        } catch (\Exception $e) {
            Log::error('ProcessBulkSkSubmission: Failed to create activity log', ['error' => $e->getMessage()]);
        }

        Log::info('ProcessBulkSkSubmission: Completed', [
            'created' => $created,
            'skipped' => $skipped,
            'errors' => $errors,
        ]);
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('ProcessBulkSkSubmission: Job failed', [
            'user_id' => $this->userId,
            'total_documents' => count($this->documents),
            'error' => $exception->getMessage(),
            'trace' => $exception->getTraceAsString(),
        ]);
    }
}
