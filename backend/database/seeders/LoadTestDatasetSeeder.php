<?php

namespace Database\Seeders;

use App\Models\School;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class LoadTestDatasetSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Seeding synthetic dataset for load testing (SEC-PERF-002)...');
        $startTime = microtime(true);

        $kecamatans = [
            'Cilacap Selatan', 'Cilacap Tengah', 'Cilacap Utara', 'Kroya',
            'Majenang', 'Sidareja', 'Wanareja', 'Kesugihan', 'Adipala',
            'Maos', 'Sampang', 'Jeruklegi', 'Kawunganten', 'Gandrungmangu'
        ];
        $jenjangs = ['MI', 'MTs', 'MA', 'SMK'];

        // 1. Core Users
        $passwordHash = Hash::make('admin123');

        User::updateOrCreate(
            ['email' => 'admin@simmaci.com'],
            ['name' => 'Super Admin', 'password' => $passwordHash, 'role' => 'super_admin', 'is_active' => true]
        );
        User::updateOrCreate(
            ['email' => 'yayasan@simmaci.com'],
            ['name' => 'Admin Yayasan', 'password' => $passwordHash, 'role' => 'admin_yayasan', 'is_active' => true]
        );

        // 2. Insert Schools (120 schools)
        $existingSchoolCount = School::count();
        $targetSchools = 120;
        $schoolsToCreate = max(0, $targetSchools - $existingSchoolCount);

        if ($schoolsToCreate > 0) {
            $schoolRows = [];
            for ($i = 1; $i <= $schoolsToCreate; $i++) {
                $idx = $existingSchoolCount + $i;
                $kec = $kecamatans[($idx - 1) % count($kecamatans)];
                $jen = $jenjangs[($idx - 1) % count($jenjangs)];
                $schoolRows[] = [
                    'nsm' => '1112' . str_pad($idx, 8, '0', STR_PAD_LEFT),
                    'npsn' => '2030' . str_pad($idx, 4, '0', STR_PAD_LEFT),
                    'nama' => "{$jen} Ma'arif NU {$idx} {$kec}",
                    'alamat' => "Jl. Pendidikan Ma'arif No. {$idx}",
                    'provinsi' => 'Jawa Tengah',
                    'kabupaten' => 'Cilacap',
                    'kecamatan' => $kec,
                    'kelurahan' => "Desa {$kec} {$idx}",
                    'telepon' => '0282' . str_pad($idx, 6, '0', STR_PAD_LEFT),
                    'email' => "sekolah{$idx}@maarifcilacap.sch.id",
                    'kepala_madrasah' => "Kepala Madrasah {$idx}, M.Pd.I",
                    'akreditasi' => ($idx % 3 === 0) ? 'A' : 'B',
                    'status' => 'Jamiyyah',
                    'status_jamiyyah' => 'aktif',
                    'npsm_nu' => 'NU-CLP-' . str_pad($idx, 5, '0', STR_PAD_LEFT),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
            foreach (array_chunk($schoolRows, 100) as $chunk) {
                DB::table('schools')->insert($chunk);
            }
        }

        $allSchoolIds = School::pluck('id')->toArray();
        $this->command->info('Schools ready: ' . count($allSchoolIds));

        // Create Operator Users for first 10 schools
        for ($i = 0; $i < min(10, count($allSchoolIds)); $i++) {
            $sId = $allSchoolIds[$i];
            User::updateOrCreate(
                ['email' => "operator{$sId}@simmaci.com"],
                ['name' => "Operator Sekolah {$sId}", 'password' => $passwordHash, 'role' => 'operator', 'school_id' => $sId, 'is_active' => true]
            );
        }

        // 3. Teachers (10 per school = 1,200+ teachers)
        $teacherCount = DB::table('teachers')->count();
        if ($teacherCount < 1200) {
            $this->command->info('Generating teachers...');
            $teachersNeeded = 1200 - $teacherCount;
            $teacherRows = [];
            $tIdx = 1;
            foreach ($allSchoolIds as $sId) {
                for ($k = 1; $k <= 10; $k++) {
                    if ($tIdx > $teachersNeeded) break 2;
                    $status = ($k <= 4) ? 'PNS' : (($k <= 8) ? 'GTY' : 'GTT');
                    $teacherRows[] = [
                        'nama' => "Guru {$tIdx} ({$status})",
                        'nuptk' => '3301' . str_pad($tIdx, 12, '0', STR_PAD_LEFT),
                        'nip' => ($status === 'PNS') ? '198001012005011' . str_pad($tIdx, 3, '0', STR_PAD_LEFT) : null,
                        'nomor_induk_maarif' => 'NIM-' . str_pad($tIdx, 8, '0', STR_PAD_LEFT),
                        'jenis_kelamin' => ($tIdx % 2 === 0) ? 'L' : 'P',
                        'tempat_lahir' => 'Cilacap',
                        'tanggal_lahir' => '1985-05-15',
                        'pendidikan_terakhir' => ($tIdx % 5 === 0) ? 'S2' : 'S1',
                        'mapel' => ['Matematika', 'Bahasa Indonesia', 'IPA', 'PAI', 'Aswaja'][$tIdx % 5],
                        'unit_kerja' => "Sekolah {$sId}",
                        'school_id' => $sId,
                        'provinsi' => 'Jawa Tengah',
                        'kabupaten' => 'Cilacap',
                        'kecamatan' => $kecamatans[$sId % count($kecamatans)],
                        'kelurahan' => 'Kelurahan ' . $sId,
                        'status' => $status,
                        'tmt' => '2015-07-01',
                        'is_certified' => ($tIdx % 2 === 0),
                        'is_active' => true,
                        'is_verified' => true,
                        'is_sk_generated' => true,
                        'phone_number' => '0812' . str_pad($tIdx, 8, '0', STR_PAD_LEFT),
                        'email' => "guru{$tIdx}@maarifcilacap.sch.id",
                        'pdpkpnu' => 'Sudah',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                    $tIdx++;
                }
            }
            foreach (array_chunk($teacherRows, 500) as $chunk) {
                DB::table('teachers')->insert($chunk);
            }
        }
        $allTeacherIds = DB::table('teachers')->pluck('id')->toArray();
        $this->command->info('Teachers ready: ' . count($allTeacherIds));

        // 4. Students (10,000+ students)
        $studentCount = DB::table('students')->count();
        if ($studentCount < 10000) {
            $this->command->info('Generating 10,000 students in batches...');
            $studentsNeeded = 10000 - $studentCount;
            $studentRows = [];
            for ($s = 1; $s <= $studentsNeeded; $s++) {
                $sId = $allSchoolIds[($s - 1) % count($allSchoolIds)];
                $kelas = ['7A', '7B', '8A', '8B', '9A', '9B', '10', '11', '12'][$s % 9];
                $studentRows[] = [
                    'nisn' => '00' . str_pad($s, 8, '0', STR_PAD_LEFT),
                    'nik' => '330101' . str_pad($s, 10, '0', STR_PAD_LEFT),
                    'nomor_induk_maarif' => 'NS-' . str_pad($s, 8, '0', STR_PAD_LEFT),
                    'nama' => "Siswa {$s}",
                    'jenis_kelamin' => ($s % 2 === 0) ? 'L' : 'P',
                    'tempat_lahir' => 'Cilacap',
                    'tanggal_lahir' => '2010-08-10',
                    'nama_ayah' => "Ayah Siswa {$s}",
                    'nama_ibu' => "Ibu Siswa {$s}",
                    'alamat' => "Jl. Desa No. {$s}",
                    'provinsi' => 'Jawa Tengah',
                    'kabupaten' => 'Cilacap',
                    'kecamatan' => $kecamatans[$sId % count($kecamatans)],
                    'kelurahan' => 'Desa ' . ($sId % 50),
                    'nama_sekolah' => "Sekolah {$sId}",
                    'npsn' => '2030' . str_pad($sId, 4, '0', STR_PAD_LEFT),
                    'school_id' => $sId,
                    'kelas' => $kelas,
                    'nomor_telepon' => '0821' . str_pad($s, 8, '0', STR_PAD_LEFT),
                    'is_verified' => true,
                    'status' => 'Aktif',
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                if (count($studentRows) >= 1000) {
                    DB::table('students')->insert($studentRows);
                    $studentRows = [];
                }
            }
            if (!empty($studentRows)) {
                DB::table('students')->insert($studentRows);
            }
        }
        $this->command->info('Students ready: ' . DB::table('students')->count());

        // 5. PPDB Periods & Registrations (5,000+ registrations)
        $periodCount = DB::table('ppdb_periods')->count();
        if ($periodCount < 20) {
            $this->command->info('Generating PPDB periods...');
            $periodRows = [];
            foreach (array_slice($allSchoolIds, 0, 30) as $sId) {
                $periodRows[] = [
                    'school_id' => $sId,
                    'academic_year' => '2026/2027',
                    'wave_name' => 'Gelombang 1 Reguler',
                    'description' => 'PPDB Reguler Tahun Ajaran 2026/2027',
                    'start_date' => Carbon::now()->subDays(10)->toDateString(),
                    'end_date' => Carbon::now()->addMonths(2)->toDateString(),
                    'announcement_date' => Carbon::now()->addMonths(2)->addDays(5)->toDateString(),
                    'reregistration_end_date' => Carbon::now()->addMonths(2)->addDays(12)->toDateString(),
                    'quota' => 200,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
            DB::table('ppdb_periods')->insert($periodRows);
        }
        $allPeriodIds = DB::table('ppdb_periods')->pluck('id')->toArray();

        $ppdbRegCount = DB::table('ppdb_registrations')->count();
        if ($ppdbRegCount < 5000) {
            $this->command->info('Generating 5,000 PPDB registrations...');
            $ppdbRows = [];
            for ($r = 1; $r <= 5000; $r++) {
                $pId = $allPeriodIds[($r - 1) % count($allPeriodIds)];
                $sId = $allSchoolIds[($r - 1) % count($allSchoolIds)];
                $ppdbRows[] = [
                    'registration_number' => 'PPDB-2026-' . str_pad($r, 6, '0', STR_PAD_LEFT),
                    'school_id' => $sId,
                    'period_id' => $pId,
                    'track' => ['reguler', 'prestasi', 'afirmasi', 'tahfidz'][$r % 4],
                    'nisn' => '0099' . str_pad($r, 6, '0', STR_PAD_LEFT),
                    'nik' => '330102' . str_pad($r, 10, '0', STR_PAD_LEFT),
                    'nama_lengkap' => "Calon Santri {$r}",
                    'jenis_kelamin' => ($r % 2 === 0) ? 'L' : 'P',
                    'tempat_lahir' => 'Cilacap',
                    'tanggal_lahir' => '2012-06-15',
                    'asal_sekolah' => 'MI Al-Huda ' . ($r % 50),
                    'no_whatsapp' => '0857' . str_pad($r, 8, '0', STR_PAD_LEFT),
                    'alamat' => "Jl. Santri Baru No. {$r}",
                    'kecamatan' => $kecamatans[$sId % count($kecamatans)],
                    'kelurahan' => 'Desa ' . ($sId % 50),
                    'nama_ayah' => "Ayah Calon {$r}",
                    'status' => ['submitted', 'verified', 'approved', 'rejected'][$r % 4],
                    'created_at' => now()->subDays($r % 30),
                    'updated_at' => now(),
                ];
                if (count($ppdbRows) >= 1000) {
                    DB::table('ppdb_registrations')->insert($ppdbRows);
                    $ppdbRows = [];
                }
            }
            if (!empty($ppdbRows)) {
                DB::table('ppdb_registrations')->insert($ppdbRows);
            }
        }
        $this->command->info('PPDB registrations ready: ' . DB::table('ppdb_registrations')->count());

        // 6. SK Documents (5,000+ SK documents)
        $skCount = DB::table('sk_documents')->count();
        if ($skCount < 5000) {
            $this->command->info('Generating 5,000 SK documents...');
            $skRows = [];
            $statuses = ['draft', 'pending', 'approved', 'rejected'];
            $jenisList = ['Pengangkatan', 'Mutasi', 'Kenaikan Pangkat', 'Pemberhentian'];
            for ($k = 1; $k <= 5000; $k++) {
                $tId = $allTeacherIds[($k - 1) % count($allTeacherIds)];
                $sId = $allSchoolIds[($k - 1) % count($allSchoolIds)];
                $skRows[] = [
                    'nomor_sk' => 'SK/PCMNU/' . date('Y') . '/' . str_pad($k, 6, '0', STR_PAD_LEFT),
                    'jenis_sk' => $jenisList[$k % count($jenisList)],
                    'teacher_id' => $tId,
                    'nama' => "SK Guru {$tId}",
                    'jabatan' => 'Guru Mata Pelajaran',
                    'unit_kerja' => "Sekolah {$sId}",
                    'school_id' => $sId,
                    'tanggal_penetapan' => '2026-01-10',
                    'status' => $statuses[$k % count($statuses)],
                    'created_by' => 'admin@simmaci.com',
                    'created_at' => now()->subDays($k % 60),
                    'updated_at' => now(),
                ];
                if (count($skRows) >= 1000) {
                    DB::table('sk_documents')->insert($skRows);
                    $skRows = [];
                }
            }
            if (!empty($skRows)) {
                DB::table('sk_documents')->insert($skRows);
            }
        }
        $this->command->info('SK documents ready: ' . DB::table('sk_documents')->count());

        // 7. Activity Logs (10,000+ rows)
        $logCount = DB::table('activity_logs')->count();
        if ($logCount < 10000) {
            $this->command->info('Generating 10,000 activity logs...');
            $logRows = [];
            for ($a = 1; $a <= 10000; $a++) {
                $sId = $allSchoolIds[($a - 1) % count($allSchoolIds)];
                $logRows[] = [
                    'school_id' => $sId,
                    'log_name' => 'default',
                    'description' => "Activity log entry {$a} performed by user",
                    'event' => ['login', 'view_student', 'update_teacher', 'export_report', 'submit_sk'][$a % 5],
                    'properties' => json_encode(['ip' => '127.0.0.1', 'action_id' => $a]),
                    'created_at' => now()->subMinutes($a * 5),
                    'updated_at' => now()->subMinutes($a * 5),
                ];
                if (count($logRows) >= 1000) {
                    DB::table('activity_logs')->insert($logRows);
                    $logRows = [];
                }
            }
            if (!empty($logRows)) {
                DB::table('activity_logs')->insert($logRows);
            }
        }
        $this->command->info('Activity logs ready: ' . DB::table('activity_logs')->count());

        $duration = round(microtime(true) - $startTime, 2);
        $this->command->info("Synthetic dataset seeded successfully in {$duration} seconds!");
    }
}
