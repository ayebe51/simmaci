<?php

/**
 * Setup Test Data for E2E Attendance Tests
 * 
 * Run this script to create test data for E2E tests:
 * php e2e/setup-test-data.php
 * 
 * Or run via artisan tinker:
 * php artisan tinker
 * require 'e2e/setup-test-data.php';
 */

require __DIR__ . '/../backend/vendor/autoload.php';

$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\School;
use App\Models\User;
use App\Models\Teacher;
use App\Models\Student;
use App\Models\AttendanceSubject;
use App\Models\AttendanceClass;
use App\Models\AttendanceSchedule;
use App\Models\AttendanceSetting;
use Illuminate\Support\Facades\Hash;

echo "🚀 Setting up E2E test data...\n\n";

// Check if test school already exists
$existingSchool = School::where('npsn', '99999999')->first();
if ($existingSchool) {
    echo "⚠️  Test school already exists (ID: {$existingSchool->id})\n";
    echo "   Do you want to delete and recreate? (y/n): ";
    $handle = fopen("php://stdin", "r");
    $line = fgets($handle);
    if (trim($line) !== 'y') {
        echo "❌ Aborted.\n";
        exit(0);
    }
    
    // Delete existing test data
    echo "🗑️  Deleting existing test data...\n";
    User::where('school_id', $existingSchool->id)->delete();
    Teacher::where('school_id', $existingSchool->id)->delete();
    Student::where('school_id', $existingSchool->id)->delete();
    AttendanceSubject::where('school_id', $existingSchool->id)->delete();
    AttendanceClass::where('school_id', $existingSchool->id)->delete();
    AttendanceSchedule::where('school_id', $existingSchool->id)->delete();
    AttendanceSetting::where('school_id', $existingSchool->id)->delete();
    $existingSchool->delete();
    echo "✅ Deleted existing test data\n\n";
}

// Create test school
echo "🏫 Creating test school...\n";
$school = School::create([
    'nama' => 'Sekolah Test E2E',
    'npsn' => '99999999',
    'alamat' => 'Jl. Test No. 1',
    'kecamatan_id' => 1, // Adjust if needed
    'jenjang' => 'MI',
    'status' => 'Aktif',
]);
echo "✅ School created (ID: {$school->id})\n\n";

// Create test operator user
echo "👤 Creating test operator user...\n";
$user = User::create([
    'name' => 'Operator Test',
    'username' => 'operator_test',
    'email' => 'operator_test@example.com',
    'password' => Hash::make('password123'),
    'school_id' => $school->id,
]);

// Assign operator role
$user->assignRole('operator');
echo "✅ User created (ID: {$user->id}, username: operator_test, password: password123)\n\n";

// Create test subjects
echo "📚 Creating test subjects...\n";
$subjects = [];
$subjectNames = ['Matematika', 'Bahasa Indonesia', 'IPA', 'IPS', 'Bahasa Inggris'];
foreach ($subjectNames as $name) {
    $subject = AttendanceSubject::create([
        'school_id' => $school->id,
        'nama' => $name,
    ]);
    $subjects[] = $subject;
    echo "   - {$name} (ID: {$subject->id})\n";
}
echo "✅ Created " . count($subjects) . " subjects\n\n";

// Create test classes
echo "🎓 Creating test classes...\n";
$classes = [];
$classNames = ['Kelas 7A', 'Kelas 7B', 'Kelas 8A', 'Kelas 8B'];
foreach ($classNames as $name) {
    $class = AttendanceClass::create([
        'school_id' => $school->id,
        'nama' => $name,
    ]);
    $classes[] = $class;
    echo "   - {$name} (ID: {$class->id})\n";
}
echo "✅ Created " . count($classes) . " classes\n\n";

// Create test schedules
echo "⏰ Creating test schedules...\n";
$schedules = [
    ['jam_ke' => 1, 'waktu_mulai' => '07:00', 'waktu_selesai' => '08:00'],
    ['jam_ke' => 2, 'waktu_mulai' => '08:00', 'waktu_selesai' => '09:00'],
    ['jam_ke' => 3, 'waktu_mulai' => '09:00', 'waktu_selesai' => '10:00'],
    ['jam_ke' => 4, 'waktu_mulai' => '10:00', 'waktu_selesai' => '11:00'],
];
foreach ($schedules as $scheduleData) {
    $schedule = AttendanceSchedule::create([
        'school_id' => $school->id,
        'jam_ke' => $scheduleData['jam_ke'],
        'waktu_mulai' => $scheduleData['waktu_mulai'],
        'waktu_selesai' => $scheduleData['waktu_selesai'],
    ]);
    echo "   - Jam ke {$scheduleData['jam_ke']} ({$scheduleData['waktu_mulai']} - {$scheduleData['waktu_selesai']})\n";
}
echo "✅ Created " . count($schedules) . " schedules\n\n";

// Create test teachers
echo "👨‍🏫 Creating test teachers...\n";
$teachers = [];
for ($i = 1; $i <= 5; $i++) {
    $teacher = Teacher::create([
        'school_id' => $school->id,
        'nama' => "Guru Test $i",
        'nip' => "123456789" . $i,
        'jenis_kelamin' => $i % 2 === 0 ? 'L' : 'P',
    ]);
    $teachers[] = $teacher;
    echo "   - Guru Test $i (ID: {$teacher->id})\n";
}
echo "✅ Created " . count($teachers) . " teachers\n\n";

// Create test students
echo "👨‍🎓 Creating test students...\n";
$students = [];
foreach ($classes as $class) {
    for ($i = 1; $i <= 10; $i++) {
        $student = Student::create([
            'school_id' => $school->id,
            'nama' => "Siswa {$class->nama} - $i",
            'nisn' => "99999" . str_pad($class->id, 2, '0', STR_PAD_LEFT) . str_pad($i, 3, '0', STR_PAD_LEFT),
            'class_id' => $class->id,
            'jenis_kelamin' => $i % 2 === 0 ? 'L' : 'P',
        ]);
        $students[] = $student;
    }
    echo "   - Created 10 students for {$class->nama}\n";
}
echo "✅ Created " . count($students) . " students\n\n";

// Create attendance settings with PIN
echo "⚙️  Creating attendance settings...\n";
$settings = AttendanceSetting::create([
    'school_id' => $school->id,
    'scanner_pin' => '123456',
    'geolocation_enabled' => false,
    'school_latitude' => null,
    'school_longitude' => null,
    'geofence_radius_meters' => 100,
]);
echo "✅ Settings created (PIN: 123456)\n\n";

echo "🎉 Test data setup complete!\n\n";
echo "📋 Summary:\n";
echo "   School: {$school->nama} (NPSN: {$school->npsn})\n";
echo "   User: operator_test / password123\n";
echo "   Subjects: " . count($subjects) . "\n";
echo "   Classes: " . count($classes) . "\n";
echo "   Schedules: " . count($schedules) . "\n";
echo "   Teachers: " . count($teachers) . "\n";
echo "   Students: " . count($students) . "\n";
echo "   Scanner PIN: 123456\n\n";
echo "🚀 You can now run E2E tests:\n";
echo "   npm run test:e2e\n";
echo "   npx playwright test e2e/attendance.spec.ts\n";
