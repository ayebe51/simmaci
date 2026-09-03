<?php

namespace App\Services;

use App\Models\PpdbPeriod;
use App\Models\PpdbRegistration;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use App\Models\WaBlastConfig;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PpdbService
{
    protected GoWaGatewayService $waGatewayService;

    public function __construct(GoWaGatewayService $waGatewayService)
    {
        $this->waGatewayService = $waGatewayService;
    }

    /**
     * Generate unique registration number
     * Format: PPDB-{YEAR}-{JENJANG_OR_NSM_SUFFIX}-{00001}
     */
    public function generateRegistrationNumber(School $school): string
    {
        $year = date('Y');
        $prefixJenjang = strtoupper($school->jenjang ?? 'MAD');
        $schoolCode = str_pad(substr($school->nsm ?? $school->npsn ?? (string)$school->id, -4), 4, '0', STR_PAD_LEFT);
        
        $prefix = "PPDB-{$year}-{$prefixJenjang}{$schoolCode}-";

        return DB::transaction(function () use ($prefix) {
            $lastReg = PpdbRegistration::withoutTenantScope()
                ->where('registration_number', 'LIKE', "{$prefix}%")
                ->orderBy('id', 'desc')
                ->lockForUpdate()
                ->first();

            $nextSequence = 1;
            if ($lastReg) {
                $parts = explode('-', $lastReg->registration_number);
                $lastSeq = (int) end($parts);
                $nextSequence = $lastSeq + 1;
            }

            return $prefix . str_pad((string)$nextSequence, 4, '0', STR_PAD_LEFT);
        });
    }

    /**
     * Register a new student online
     */
    public function createRegistration(array $data, array $files = []): PpdbRegistration
    {
        return DB::transaction(function () use ($data, $files) {
            $school = School::findOrFail($data['school_id']);
            $period = PpdbPeriod::withoutTenantScope()->findOrFail($data['period_id']);

            // Validate period is active and open
            $today = now()->toDateString();
            if (!$period->is_active || $period->start_date > $today || $period->end_date < $today) {
                throw new \InvalidArgumentException('Periode pendaftaran ini sedang tidak aktif atau sudah ditutup.');
            }

            // Check duplicate registration in the same school and academic year by NIK or NISN
            $duplicateQuery = PpdbRegistration::withoutTenantScope()
                ->where('school_id', $school->id)
                ->where('period_id', $period->id)
                ->where(function ($q) use ($data) {
                    $q->where('nik', $data['nik']);
                    if (!empty($data['nisn'])) {
                        $q->orWhere('nisn', $data['nisn']);
                    }
                });

            if ($duplicateQuery->exists()) {
                throw new \InvalidArgumentException('Calon peserta dengan NIK atau NISN ini sudah terdaftar di madrasah ini.');
            }

            // Generate registration number
            $regNumber = $this->generateRegistrationNumber($school);

            // Handle file uploads
            $uploadedUrls = [];
            $uploadFields = ['foto', 'kk', 'akta', 'ijazah', 'prestasi'];
            foreach ($uploadFields as $field) {
                if (isset($files[$field]) && $files[$field] instanceof UploadedFile) {
                    $uploadedUrls["{$field}_url"] = $this->uploadDocument($files[$field], $regNumber, $field);
                }
            }

            // Prepare registration payload
            $registrationData = array_merge($data, $uploadedUrls, [
                'registration_number' => $regNumber,
                'status'              => 'submitted',
                'is_reregistered'     => false,
            ]);

            $registration = PpdbRegistration::create($registrationData);

            // Send automated WhatsApp confirmation notification
            $this->sendRegistrationNotification($registration);

            return $registration;
        });
    }

    /**
     * Verify documents by operator
     */
    public function verifyRegistration(PpdbRegistration $registration, string $status, ?string $notes, ?User $verifier): PpdbRegistration
    {
        if (!in_array($status, ['verified', 'revision_needed', 'rejected', 'submitted'])) {
            throw new \InvalidArgumentException("Status verifikasi tidak valid: {$status}");
        }

        $registration->update([
            'status'             => $status,
            'verification_notes' => $notes,
            'verified_by'        => $verifier?->id,
            'verified_at'        => now(),
        ]);

        // Send WhatsApp Notification for status update
        $this->sendStatusUpdateNotification($registration, $status, $notes);

        return $registration;
    }

    /**
     * Input selection scores & decide acceptance
     */
    public function recordSelectionScore(PpdbRegistration $registration, array $scores, string $decision, ?string $notes = null): PpdbRegistration
    {
        if (!in_array($decision, ['accepted', 'reserved', 'rejected'])) {
            throw new \InvalidArgumentException("Keputusan hasil seleksi tidak valid: {$decision}");
        }

        $testScore = isset($scores['test_score']) ? (float)$scores['test_score'] : null;
        $interviewScore = isset($scores['interview_score']) ? (float)$scores['interview_score'] : null;
        $achievementScore = isset($scores['achievement_score']) ? (float)$scores['achievement_score'] : null;

        // Calculate weighted final score if provided
        $finalScore = null;
        $scoreCount = 0;
        $scoreSum = 0;

        if ($testScore !== null) { $scoreSum += $testScore; $scoreCount++; }
        if ($interviewScore !== null) { $scoreSum += $interviewScore; $scoreCount++; }
        if ($achievementScore !== null) { $scoreSum += $achievementScore; $scoreCount++; }

        if ($scoreCount > 0) {
            $finalScore = round($scoreSum / $scoreCount, 2);
        }

        $registration->update([
            'test_score'        => $testScore,
            'interview_score'   => $interviewScore,
            'achievement_score' => $achievementScore,
            'final_score'       => $finalScore,
            'status'            => $decision,
            'selection_notes'   => $notes,
        ]);

        // Notify parent/student
        $this->sendSelectionResultNotification($registration, $decision);

        return $registration;
    }

    /**
     * Confirm Re-registration (Daftar Ulang) & AUTO-SYNC to Student Master Data
     */
    public function confirmReregistration(PpdbRegistration $registration): Student
    {
        return DB::transaction(function () use ($registration) {
            if ($registration->status !== 'accepted' && $registration->status !== 'reregistered') {
                throw new \InvalidArgumentException('Hanya pendaftar dengan status Diterima yang dapat melakukan Daftar Ulang.');
            }

            $school = $registration->school;
            if (!$school) {
                $school = School::findOrFail($registration->school_id);
            }

            // Determine entry grade level based on school jenjang
            $defaultClass = match (strtoupper($school->jenjang ?? '')) {
                'MI', 'SD'   => '1',
                'MTS', 'SMP' => '7',
                'MA', 'SMA', 'SMK' => '10',
                default      => '1',
            };

            // Check if student already exists in Master Data (e.g. by NISN or NIK in the same school)
            $student = Student::withoutTenantScope()
                ->where('school_id', $school->id)
                ->where(function ($q) use ($registration) {
                    if (!empty($registration->nisn)) {
                        $q->where('nisn', $registration->nisn);
                    }
                    if (!empty($registration->nik)) {
                        $q->orWhere('nik', $registration->nik);
                    }
                })
                ->first();

            $qrPayload = json_encode([
                'type'     => 'student_kta',
                'reg_no'   => $registration->registration_number,
                'nisn'     => $registration->nisn,
                'nama'     => $registration->nama_lengkap,
                'sekolah'  => $school->nama,
            ]);

            if (!$student) {
                // Generate Nomor Induk Ma'arif
                $nimPrefix = $school->npsm_nu ?? $school->nsm ?? substr($school->npsn ?? '0000', -4);
                $nimSequence = Student::withoutTenantScope()->where('school_id', $school->id)->count() + 1;
                $nim = "NIM-{$nimPrefix}-" . date('y') . str_pad((string)$nimSequence, 4, '0', STR_PAD_LEFT);

                // Insert into Master Data Siswa
                $student = Student::create([
                    'school_id'           => $school->id,
                    'nama_sekolah'        => $school->nama,
                    'npsn'                => $school->npsn,
                    'nisn'                => $registration->nisn,
                    'nik'                 => $registration->nik,
                    'nomor_induk_maarif'  => $nim,
                    'nama'                => $registration->nama_lengkap,
                    'jenis_kelamin'       => $registration->jenis_kelamin,
                    'tempat_lahir'        => $registration->tempat_lahir,
                    'tanggal_lahir'       => $registration->tanggal_lahir?->format('Y-m-d'),
                    'nama_ayah'           => $registration->nama_ayah,
                    'nama_ibu'            => $registration->nama_ibu,
                    'nama_wali'           => $registration->nama_wali,
                    'alamat'              => $registration->alamat,
                    'provinsi'            => $registration->provinsi,
                    'kabupaten'           => $registration->kabupaten,
                    'kecamatan'           => $registration->kecamatan,
                    'kelurahan'           => $registration->kelurahan,
                    'kelas'               => $defaultClass,
                    'nomor_telepon'       => $registration->no_whatsapp,
                    'is_verified'         => true,
                    'status'              => 'Aktif',
                    'qr_code'             => $qrPayload,
                    'last_transition_at'  => now(),
                ]);
            } else {
                // Update existing student
                $student->update([
                    'status'             => 'Aktif',
                    'is_verified'        => true,
                    'kelas'              => $defaultClass,
                    'last_transition_at' => now(),
                ]);
            }

            // Update registration record
            $registration->update([
                'is_reregistered' => true,
                'reregistered_at' => now(),
                'status'          => 'reregistered',
                'student_id'      => $student->id,
            ]);

            // Dispatch WhatsApp Welcome Notification
            $this->sendReregistrationWelcomeNotification($registration, $student, $school);

            return $student;
        });
    }

    /**
     * Upload document helper
     */
    private function uploadDocument(UploadedFile $file, string $regNumber, string $folder): string
    {
        $cleanReg = Str::slug($regNumber);
        $filename = "ppdb_{$cleanReg}_{$folder}_" . time() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs("ppdb/{$folder}", $filename, 'public');
        return Storage::url($path);
    }

    /**
     * Send WhatsApp Registration Received
     */
    private function sendRegistrationNotification(PpdbRegistration $reg): void
    {
        $school = $reg->school;
        $phone = $reg->no_whatsapp;
        if (empty($phone)) return;

        $message = "Assalamu'alaikum Wr. Wb.\n\n" .
            "Terima kasih telah mendaftar di *{$school->nama}* (LP Ma'arif NU Cilacap).\n\n" .
            "📋 *Data Pendaftaran:*\n" .
            "• No. Registrasi: *{$reg->registration_number}*\n" .
            "• Nama Calon Siswa: *{$reg->nama_lengkap}*\n" .
            "• Jalur: *" . strtoupper($reg->track) . "*\n" .
            "• Status: *Menunggu Verifikasi Berkas*\n\n" .
            "Simpan Nomor Registrasi Anda untuk mengecek status seleksi sewaktu-waktu melalui portal PPDB:\n" .
            config('app.url') . "/ppdb/status?reg=" . urlencode($reg->registration_number) . "\n\n" .
            "Wassalamu'alaikum Wr. Wb.";

        $this->dispatchWaMessage($phone, $message);
    }

    /**
     * Send WhatsApp Status Update
     */
    private function sendStatusUpdateNotification(PpdbRegistration $reg, string $status, ?string $notes): void
    {
        $phone = $reg->no_whatsapp;
        if (empty($phone)) return;

        $statusText = match ($status) {
            'verified'        => '✅ Berkas Terverifikasi & Diterima',
            'revision_needed' => '⚠️ Perlu Perbaikan Berkas',
            'rejected'        => '❌ Berkas Ditolak',
            default           => '🔄 Sedang Diproses',
        };

        $message = "Assalamu'alaikum Wr. Wb.\n\n" .
            "Pembaruan status pendaftaran PPDB *{$reg->school->nama}*:\n\n" .
            "• No. Registrasi: *{$reg->registration_number}*\n" .
            "• Nama: *{$reg->nama_lengkap}*\n" .
            "• Status Berkas: *{$statusText}*\n";

        if (!empty($notes)) {
            $message .= "• Catatan Operator: _{$notes}_\n";
        }

        $message .= "\nSilakan pantau perkembangan selanjutnya di portal PPDB Ma'arif Cilacap.\n" .
            config('app.url') . "/ppdb/status?reg=" . urlencode($reg->registration_number) . "\n\n" .
            "Terima kasih.";

        $this->dispatchWaMessage($phone, $message);
    }

    /**
     * Send WhatsApp Selection Result
     */
    private function sendSelectionResultNotification(PpdbRegistration $reg, string $decision): void
    {
        $phone = $reg->no_whatsapp;
        if (empty($phone)) return;

        $decisionText = match ($decision) {
            'accepted' => '🎉 SELAMAT! Anda Dinyatakan DITERIMA',
            'reserved' => '📋 Anda Masuk Daftar CADANGAN',
            'rejected' => 'Mohon Maaf, Anda Belum Diterima',
            default    => 'Hasil Seleksi Telah Diperbarui',
        };

        $message = "Assalamu'alaikum Wr. Wb.\n\n" .
            "Pengumuman Hasil Seleksi PPDB *{$reg->school->nama}*:\n\n" .
            "• No. Registrasi: *{$reg->registration_number}*\n" .
            "• Nama: *{$reg->nama_lengkap}*\n" .
            "• Hasil Seleksi: *{$decisionText}*\n";

        if ($decision === 'accepted') {
            $message .= "\nSilakan segera melakukan proses *Daftar Ulang* sesuai petunjuk madrasah.\n";
        }

        $message .= "\nCek informasi lengkap di: " . config('app.url') . "/ppdb/status?reg=" . urlencode($reg->registration_number) . "\n\n" .
            "Wassalamu'alaikum Wr. Wb.";

        $this->dispatchWaMessage($phone, $message);
    }

    /**
     * Send WhatsApp Re-registration Welcome
     */
    private function sendReregistrationWelcomeNotification(PpdbRegistration $reg, Student $student, School $school): void
    {
        $phone = $reg->no_whatsapp;
        if (empty($phone)) return;

        $message = "Alhamdulillah!\n\n" .
            "Proses Daftar Ulang atas nama *{$student->nama}* di *{$school->nama}* telah *SELESAI & BERHASIL DIVERIFIKASI*.\n\n" .
            "🎓 Data Siswa telah resmi tercatat di Sistem Informasi Manajemen Ma'arif NU Cilacap (SIMMACI).\n" .
            "• Nomor Induk Ma'arif: *{$student->nomor_induk_maarif}*\n" .
            "• Kelas: *{$student->kelas}*\n" .
            "• Status: *Siswa Aktif*\n\n" .
            "Selamat bergabung di keluarga besar LP Ma'arif NU Cilacap!";

        $this->dispatchWaMessage($phone, $message);
    }

    /**
     * Dispatch WhatsApp message safely without crashing on gateway downtime
     */
    private function dispatchWaMessage(string $phone, string $message): void
    {
        try {
            $config = WaBlastConfig::where('is_active', true)->first();
            if ($config) {
                $this->waGatewayService->sendMessage($config, $phone, $message);
            }
        } catch (\Throwable $e) {
            Log::warning("PPDB WA Notification failed to {$phone}: " . $e->getMessage());
        }
    }
}
