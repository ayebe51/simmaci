<?php

namespace Tests\Feature;

use App\Models\AttendanceSetting;
use App\Models\LessonSchedule;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentAttendanceLog;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Preservation Property Tests for Attendance API
 * 
 * Property 2: Preservation - Existing Working Features
 * 
 * These tests observe and validate behavior on UNFIXED code for working features:
 * - Teacher attendance endpoints (GET/POST /attendance/teacher)
 * - Student report endpoint (GET /attendance/student-report)
 * - Settings show endpoint (GET /attendance/settings)
 * - Tenant scoping mechanism (operators only see their school_id data)
 * - Authentication flow (unauthenticated requests get 401)
 * - Data validation (invalid payloads get validation errors)
 * 
 * EXPECTED OUTCOME: All tests PASS (confirms baseline behavior to preserve)
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */
class AttendanceApiPreservationTest extends TestCase
{
    use RefreshDatabase;

    private User $operatorSchool1;
    private User $operatorSchool2;
    private School $school1;
    private School $school2;
    private Teacher $teacher1;
    private Teacher $teacher2;
    private SchoolClass $class1;
    private SchoolClass $class2;
    private Subject $subject1;
    private Subject $subject2;

    protected function setUp(): void
    {
        parent::setUp();

        // Create two schools for tenant isolation testing
        $this->school1 = School::factory()->create(['nama' => 'School 1']);
        $this->school2 = School::factory()->create(['nama' => 'School 2']);

        // Create operators for each school
        $this->operatorSchool1 = User::factory()->create([
            'school_id' => $this->school1->id,
            'role' => 'operator',
        ]);

        $this->operatorSchool2 = User::factory()->create([
            'school_id' => $this->school2->id,
            'role' => 'operator',
        ]);

        // Create teachers for each school
        $this->teacher1 = Teacher::factory()->create([
            'school_id' => $this->school1->id,
            'nama' => 'Teacher School 1',
        ]);

        $this->teacher2 = Teacher::factory()->create([
            'school_id' => $this->school2->id,
            'nama' => 'Teacher School 2',
        ]);

        // Create classes for each school
        $this->class1 = SchoolClass::factory()->create([
            'school_id' => $this->school1->id,
            'nama' => 'Class 1A',
        ]);

        $this->class2 = SchoolClass::factory()->create([
            'school_id' => $this->school2->id,
            'nama' => 'Class 2A',
        ]);

        // Create subjects for each school
        $this->subject1 = Subject::factory()->create([
            'school_id' => $this->school1->id,
            'nama' => 'Math',
        ]);

        $this->subject2 = Subject::factory()->create([
            'school_id' => $this->school2->id,
            'nama' => 'Science',
        ]);
    }

    /**
     * Property 3.1: Teacher Attendance GET Endpoint Preservation
     * 
     * WHEN frontend calls GET /attendance/teacher
     * THEN system SHALL CONTINUE TO function correctly
     */
    public function test_teacher_attendance_get_endpoint_works(): void
    {
        // Arrange: Create teacher attendance records
        TeacherAttendance::factory()->create([
            'school_id' => $this->school1->id,
            'teacher_id' => $this->teacher1->id,
            'tanggal' => '2024-01-15',
            'status' => 'Hadir',
        ]);

        // Act: Call the working endpoint
        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->getJson('/api/attendance/teacher');

        // Assert: Endpoint returns success
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                '*' => [
                    'id',
                    'teacher_id',
                    'tanggal',
                    'status',
                    'teacher',
                ],
            ],
        ]);
    }

    /**
     * Property 3.1: Teacher Attendance POST Endpoint Preservation
     * 
     * WHEN frontend calls POST /attendance/teacher
     * THEN system SHALL CONTINUE TO function correctly
     */
    public function test_teacher_attendance_post_endpoint_works(): void
    {
        // Act: Call the working endpoint
        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->postJson('/api/attendance/teacher', [
                'teacher_id' => $this->teacher1->id,
                'tanggal' => '2024-01-15',
                'jam_masuk' => '07:30',
                'status' => 'Hadir',
            ]);

        // Assert: Endpoint returns success
        $response->assertStatus(201);
        $response->assertJsonStructure([
            'id',
            'teacher_id',
            'tanggal',
            'status',
            'jam_masuk',
        ]);

        // Verify data persisted
        $this->assertDatabaseHas('teacher_attendances', [
            'teacher_id' => $this->teacher1->id,
            'status' => 'Hadir',
        ]);
    }

    /**
     * Property 3.2: Student Report Endpoint Preservation
     * 
     * WHEN frontend calls GET /attendance/student-report
     * THEN system SHALL CONTINUE TO function correctly
     */
    public function test_student_report_endpoint_works(): void
    {
        // Arrange: Create student and attendance log
        $student = Student::factory()->create([
            'school_id' => $this->school1->id,
            'kelas' => $this->class1->nama,
        ]);

        StudentAttendanceLog::factory()->create([
            'school_id' => $this->school1->id,
            'class_id' => $this->class1->id,
            'subject_id' => $this->subject1->id,
            'tanggal' => '2024-01-15',
            'logs' => [
                ['student_id' => $student->id, 'status' => 'Hadir'],
            ],
        ]);

        // Act: Call the working endpoint with required query parameters
        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->getJson('/api/attendance/student-report?' . http_build_query([
                'class_id' => $this->class1->id,
                'subject_id' => $this->subject1->id,
                'bulan' => '2024-01',
            ]));

        // Assert: Endpoint returns success
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'students',
            'matrix',
            'class_name',
        ]);
    }

    /**
     * Property 3.3: Settings Show Endpoint Preservation
     * 
     * WHEN frontend calls GET /attendance/settings
     * THEN system SHALL CONTINUE TO function correctly
     */
    public function test_settings_show_endpoint_works(): void
    {
        // Act: Call the working endpoint
        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->getJson('/api/attendance/settings');

        // Assert: Endpoint returns success and creates settings if not exists
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'id',
            'school_id',
            'absensi_guru_aktif',
            'absensi_siswa_aktif',
            'qr_scan_aktif',
        ]);

        // Verify settings were created
        $this->assertDatabaseHas('attendance_settings', [
            'school_id' => $this->school1->id,
        ]);
    }

    /**
     * Property 3.4: QR Scan Success Flow Preservation
     * 
     * WHEN QR scan successfully processes teacher attendance
     * THEN system SHALL CONTINUE TO save data correctly
     */
    public function test_qr_scan_teacher_success_flow_works(): void
    {
        // Act: Call QR scan endpoint with correct payload
        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->postJson('/api/attendance/qr-scan', [
                'code' => $this->teacher1->nuptk,
                'type' => 'teacher',
            ]);

        // Assert: Endpoint returns success
        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
        ]);
        $response->assertJsonStructure([
            'success',
            'teacher',
            'attendance',
        ]);

        // Verify attendance was recorded
        $this->assertDatabaseHas('teacher_attendances', [
            'teacher_id' => $this->teacher1->id,
            'status' => 'Hadir',
        ]);
    }

    /**
     * Property 3.5: Tenant Scoping Preservation
     * 
     * WHEN operator from school 1 accesses attendance data
     * THEN system SHALL CONTINUE TO only show data from their school_id
     */
    public function test_tenant_scoping_isolates_school_data(): void
    {
        // Arrange: Create attendance for both schools
        TeacherAttendance::factory()->create([
            'school_id' => $this->school1->id,
            'teacher_id' => $this->teacher1->id,
            'tanggal' => '2024-01-15',
        ]);

        TeacherAttendance::factory()->create([
            'school_id' => $this->school2->id,
            'teacher_id' => $this->teacher2->id,
            'tanggal' => '2024-01-15',
        ]);

        // Act: Operator 1 fetches teacher attendance
        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->getJson('/api/attendance/teacher');

        // Assert: Only sees their school's data
        $response->assertStatus(200);
        $data = $response->json('data');
        
        $this->assertCount(1, $data);
        $this->assertEquals($this->school1->id, $data[0]['school_id']);
        $this->assertEquals($this->teacher1->id, $data[0]['teacher_id']);
    }

    /**
     * Property 3.5: Tenant Scoping - Cross-School Isolation
     * 
     * WHEN operator from school 2 accesses attendance data
     * THEN system SHALL CONTINUE TO only show data from their school_id
     */
    public function test_tenant_scoping_prevents_cross_school_access(): void
    {
        // Arrange: Create attendance for school 1
        TeacherAttendance::factory()->create([
            'school_id' => $this->school1->id,
            'teacher_id' => $this->teacher1->id,
            'tanggal' => '2024-01-15',
        ]);

        // Act: Operator 2 fetches teacher attendance
        $response = $this->actingAs($this->operatorSchool2, 'sanctum')
            ->getJson('/api/attendance/teacher');

        // Assert: Does not see school 1's data
        $response->assertStatus(200);
        $data = $response->json('data');
        
        $this->assertCount(0, $data);
    }

    /**
     * Property 3.6: Authentication Flow Preservation
     * 
     * WHEN unauthenticated user accesses attendance endpoints
     * THEN system SHALL CONTINUE TO return 401 Unauthorized
     */
    public function test_unauthenticated_requests_return_401(): void
    {
        // Test multiple endpoints without authentication
        $endpoints = [
            ['method' => 'get', 'uri' => '/api/attendance/teacher'],
            ['method' => 'post', 'uri' => '/api/attendance/teacher'],
            ['method' => 'get', 'uri' => '/api/attendance/settings'],
            ['method' => 'get', 'uri' => '/api/attendance/student-report'],
        ];

        foreach ($endpoints as $endpoint) {
            $response = $this->{$endpoint['method'] . 'Json'}($endpoint['uri']);
            
            $response->assertStatus(401);
        }
    }

    /**
     * Property 3.7: Data Validation Preservation - Missing Required Fields
     * 
     * WHEN frontend sends invalid data (missing required fields)
     * THEN backend SHALL CONTINUE TO return validation errors
     */
    public function test_validation_rejects_missing_required_fields(): void
    {
        // Act: Send request without required fields
        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->postJson('/api/attendance/teacher', [
                // Missing teacher_id, tanggal, status
            ]);

        // Assert: Returns validation error
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['teacher_id', 'tanggal', 'status']);
    }

    /**
     * Property 3.7: Data Validation Preservation - Invalid Status Value
     * 
     * WHEN frontend sends invalid status value
     * THEN backend SHALL CONTINUE TO return validation error
     */
    public function test_validation_rejects_invalid_status_value(): void
    {
        // Act: Send request with invalid status
        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->postJson('/api/attendance/teacher', [
                'teacher_id' => $this->teacher1->id,
                'tanggal' => '2024-01-15',
                'status' => 'InvalidStatus', // Not in: Hadir,Sakit,Izin,Alpha
            ]);

        // Assert: Returns validation error
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['status']);
    }

    /**
     * Property 3.7: Data Validation Preservation - Invalid Foreign Key
     * 
     * WHEN frontend sends non-existent teacher_id
     * THEN backend SHALL CONTINUE TO return validation error
     */
    public function test_validation_rejects_invalid_foreign_key(): void
    {
        // Act: Send request with non-existent teacher_id
        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->postJson('/api/attendance/teacher', [
                'teacher_id' => 99999, // Non-existent
                'tanggal' => '2024-01-15',
                'status' => 'Hadir',
            ]);

        // Assert: Returns validation error
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['teacher_id']);
    }

    /**
     * Property 3.8: Existing Data Integrity Preservation
     * 
     * WHEN existing attendance records exist in database
     * THEN data SHALL CONTINUE TO be readable with same schema
     */
    public function test_existing_attendance_data_remains_valid(): void
    {
        // Arrange: Create attendance with all fields
        $attendance = TeacherAttendance::factory()->create([
            'school_id' => $this->school1->id,
            'teacher_id' => $this->teacher1->id,
            'tanggal' => '2024-01-15',
            'jam_masuk' => '07:30',
            'jam_pulang' => '15:00',
            'status' => 'Hadir',
            'keterangan' => 'On time',
            'scanned_by' => 'Admin',
        ]);

        // Act: Fetch the data via API (without date filter to avoid scoping issues)
        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->getJson('/api/attendance/teacher');

        // Assert: Data structure is preserved
        $response->assertStatus(200);
        $data = $response->json('data'); // Paginated response has 'data' key
        
        $this->assertGreaterThanOrEqual(1, count($data));
        $record = collect($data)->firstWhere('id', $attendance->id);
        
        $this->assertNotNull($record);
        $this->assertEquals($attendance->id, $record['id']);
        $this->assertEquals($attendance->teacher_id, $record['teacher_id']);
        $this->assertEquals('2024-01-15', $record['tanggal']);
        $this->assertEquals('07:30', $record['jam_masuk']);
        $this->assertEquals('15:00', $record['jam_pulang']);
        $this->assertEquals('Hadir', $record['status']);
        $this->assertEquals('On time', $record['keterangan']);
        $this->assertEquals('Admin', $record['scanned_by']);
    }

    /**
     * Property 3.8: Student Attendance Log Data Integrity
     * 
     * WHEN existing student attendance logs exist with JSON logs field
     * THEN data SHALL CONTINUE TO be readable and writable correctly
     */
    public function test_student_attendance_log_json_structure_preserved(): void
    {
        // Arrange: Create student attendance log with logs JSON field
        $log = StudentAttendanceLog::factory()->create([
            'school_id' => $this->school1->id,
            'class_id' => $this->class1->id,
            'subject_id' => $this->subject1->id,
            'tanggal' => '2024-01-15',
            'jam_ke' => 1,
            'logs' => [
                ['student_id' => 1, 'status' => 'Hadir'],
                ['student_id' => 2, 'status' => 'Sakit'],
                ['student_id' => 3, 'status' => 'Alpha'],
            ],
        ]);

        // Act: Fetch the data via API (without date filter to avoid scoping issues)
        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->getJson('/api/attendance/student-log');

        // Assert: JSON logs field is preserved
        $response->assertStatus(200);
        $data = $response->json('data'); // Paginated response has 'data' key
        
        $this->assertGreaterThanOrEqual(1, count($data));
        $record = collect($data)->firstWhere('id', $log->id);
        
        $this->assertNotNull($record);
        $this->assertEquals($log->id, $record['id']);
        $this->assertIsArray($record['logs']);
        $this->assertCount(3, $record['logs']);
        $this->assertEquals(1, $record['logs'][0]['student_id']);
        $this->assertEquals('Hadir', $record['logs'][0]['status']);
    }

    /**
     * Property 3.8: Settings Update Preserves Existing Fields
     * 
     * WHEN settings are updated via PUT endpoint
     * THEN existing fields SHALL CONTINUE TO be preserved
     */
    public function test_settings_update_preserves_existing_data(): void
    {
        // Arrange: Create settings with initial values
        AttendanceSetting::factory()->create([
            'school_id' => $this->school1->id,
            'absensi_guru_aktif' => true,
            'scanner_pin' => '123456',
        ]);

        // Act: Update only one field
        $response = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->putJson('/api/attendance/settings', [
                'absensi_siswa_aktif' => true,
            ]);

        // Assert: Other fields are preserved
        $response->assertStatus(200);
        $this->assertDatabaseHas('attendance_settings', [
            'school_id' => $this->school1->id,
            'absensi_guru_aktif' => true, // Preserved
            'absensi_siswa_aktif' => true, // Updated
            'scanner_pin' => '123456', // Preserved
        ]);
    }

    /**
     * Property-Based Test: Teacher Attendance Filtering by Date
     * 
     * For ANY date filter, system SHALL return only records matching that date
     */
    public function test_teacher_attendance_date_filtering_works(): void
    {
        // Arrange: Create attendance on multiple dates
        $dates = ['2024-01-10', '2024-01-11', '2024-01-12'];
        
        foreach ($dates as $date) {
            TeacherAttendance::factory()->create([
                'school_id' => $this->school1->id,
                'teacher_id' => $this->teacher1->id,
                'tanggal' => $date,
            ]);
        }

        // Act & Assert: Filter by each date
        foreach ($dates as $targetDate) {
            $response = $this->actingAs($this->operatorSchool1, 'sanctum')
                ->getJson("/api/attendance/teacher?tanggal={$targetDate}");

            $response->assertStatus(200);
            $data = $response->json('data');
            
            // All returned records should match the filter date
            foreach ($data as $record) {
                $this->assertEquals($targetDate, $record['tanggal']);
            }
        }
    }

    /**
     * Property-Based Test: UpdateOrCreate Behavior
     * 
     * For ANY teacher and date combination, posting twice SHALL update not duplicate
     * 
     * NOTE: This test documents CURRENT behavior (creates duplicates).
     * This is actually a BUG but we're testing preservation of existing behavior.
     */
    public function test_teacher_attendance_update_or_create_prevents_duplicates(): void
    {
        // Act: Post same teacher/date twice with different status
        $payload = [
            'teacher_id' => $this->teacher1->id,
            'tanggal' => '2024-01-15',
            'status' => 'Hadir',
        ];

        $response1 = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->postJson('/api/attendance/teacher', $payload);
        $response1->assertStatus(201);
        $id1 = $response1->json('id');

        // Update with different status
        $payload['status'] = 'Sakit';
        $response2 = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->postJson('/api/attendance/teacher', $payload);
        $response2->assertStatus(201);
        $id2 = $response2->json('id');

        // Assert: CURRENT BEHAVIOR - Same ID returned (updateOrCreate working)
        $this->assertEquals($id1, $id2, 'UpdateOrCreate should return same ID');
        
        // Verify only one record exists
        $count = TeacherAttendance::withoutGlobalScopes()
            ->where('teacher_id', $this->teacher1->id)
            ->whereDate('tanggal', '2024-01-15')
            ->count();
        
        $this->assertEquals(1, $count, 'Should have exactly 1 record (no duplicates)');
        
        // Verify status was updated
        $attendance = TeacherAttendance::withoutGlobalScopes()
            ->where('teacher_id', $this->teacher1->id)
            ->whereDate('tanggal', '2024-01-15')
            ->first();
        
        $this->assertEquals('Sakit', $attendance->status, 'Status should be updated to Sakit');
    }

    /**
     * Property-Based Test: Student Log UpdateOrCreate Behavior
     * 
     * For ANY class/subject/date combination, posting twice SHALL update not duplicate
     * 
     * NOTE: This test documents CURRENT behavior (creates duplicates).
     * This is actually a BUG but we're testing preservation of existing behavior.
     */
    public function test_student_log_update_or_create_prevents_duplicates(): void
    {
        // Act: Post same class/subject/date twice with different logs
        $payload = [
            'class_id' => $this->class1->id,
            'subject_id' => $this->subject1->id,
            'tanggal' => '2024-01-15',
            'logs' => [
                ['student_id' => 1, 'status' => 'Hadir'],
            ],
        ];

        $response1 = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->postJson('/api/attendance/student-log', $payload);
        $response1->assertStatus(201);
        $id1 = $response1->json('id');

        // Update with different logs
        $payload['logs'] = [
            ['student_id' => 1, 'status' => 'Sakit'],
            ['student_id' => 2, 'status' => 'Hadir'],
        ];
        
        $response2 = $this->actingAs($this->operatorSchool1, 'sanctum')
            ->postJson('/api/attendance/student-log', $payload);
        $response2->assertStatus(201);
        $id2 = $response2->json('id');

        // Assert: CURRENT BEHAVIOR - Same ID returned (updateOrCreate working)
        $this->assertEquals($id1, $id2, 'UpdateOrCreate should return same ID');
        
        // Verify only one record exists
        $count = StudentAttendanceLog::withoutGlobalScopes()
            ->where('class_id', $this->class1->id)
            ->where('subject_id', $this->subject1->id)
            ->whereDate('tanggal', '2024-01-15')
            ->count();
        
        $this->assertEquals(1, $count, 'Should have exactly 1 record (no duplicates)');
        
        // Verify logs were updated
        $log = StudentAttendanceLog::withoutGlobalScopes()
            ->where('class_id', $this->class1->id)
            ->where('subject_id', $this->subject1->id)
            ->whereDate('tanggal', '2024-01-15')
            ->first();
        
        $this->assertCount(2, $log->logs, 'Logs should be updated to 2 entries');
    }
}
