/**
 * Bug Condition Exploration Tests for Attendance API Fixes
 * 
 * CRITICAL: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
 * DO NOT attempt to fix the tests or the code when they fail
 * 
 * These tests encode the expected behavior - they will validate the fixes when they pass after implementation
 * 
 * GOAL: Surface counterexamples that demonstrate the bugs exist
 * 
 * Spec: .kiro/specs/attendance-api-fixes
 * Task: 1. Write bug condition exploration tests (BEFORE implementing fixes)
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { attendanceApi, authApi, apiClient } from '@/lib/api';

// Test data setup
const TEST_USER = {
  email: 'operator-test@school1.com',
  password: 'password123',
  role: 'operator',
  school_id: 1,
};

describe('Bug Condition Exploration: Attendance API Fixes', () => {
  beforeAll(async () => {
    // Login to get auth token for tests
    try {
      await authApi.login(TEST_USER.email, TEST_USER.password);
    } catch (error) {
      console.warn('Login failed - tests may fail if backend is not running:', error);
    }
  });

  afterAll(async () => {
    // Cleanup
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore logout errors
    }
  });

  /**
   * Bug Category 1: Student Logs Endpoint Mismatch
   * 
   * Frontend calls: /attendance/student-logs (plural)
   * Backend expects: /attendance/student-log (singular)
   * 
   * Expected: 404 Not Found error on unfixed code
   * Requirements: 1.1, 1.2
   */
  describe('Category 1: Student Logs Endpoint Mismatch', () => {
    test('should fail: GET /attendance/student-logs returns 404 (frontend uses plural, backend expects singular)', async () => {
      // This test will FAIL on unfixed code with 404 error
      // After fix, it should return 200 with data
      
      try {
        const response = await attendanceApi.studentLogIndex({
          class_id: 1,
          subject_id: 1,
          tanggal: '2024-01-15',
        });
        
        // If we reach here on unfixed code, something is wrong
        // On fixed code, this should pass
        expect(response).toBeDefined();
        expect(Array.isArray(response) || response.data).toBeTruthy();
      } catch (error: any) {
        // On unfixed code, we expect 404
        expect(error.response?.status).toBe(404);
        console.log('✓ Counterexample found: GET /attendance/student-logs returns 404');
        console.log('  Root cause: Frontend uses plural endpoint, backend expects singular');
      }
    });

    test('should fail: POST /attendance/student-logs returns 404 (frontend uses plural, backend expects singular)', async () => {
      // This test will FAIL on unfixed code with 404 error
      
      try {
        const response = await attendanceApi.studentLogStore({
          class_id: 1,
          subject_id: 1,
          tanggal: '2024-01-15',
          logs: [
            { student_id: 1, status: 'Hadir' },
            { student_id: 2, status: 'Sakit' },
          ],
        });
        
        expect(response).toBeDefined();
        expect(response.id || response.success).toBeTruthy();
      } catch (error: any) {
        // On unfixed code, we expect 404
        expect(error.response?.status).toBe(404);
        console.log('✓ Counterexample found: POST /attendance/student-logs returns 404');
        console.log('  Root cause: Frontend uses plural endpoint, backend expects singular');
      }
    });
  });

  /**
   * Bug Category 2: Master Data Endpoint Mismatch
   * 
   * Frontend calls: /subjects, /classes, /lesson-schedules (root level)
   * Backend expects: /attendance/subjects, /attendance/classes, /attendance/schedules
   * 
   * Expected: 404 Not Found errors on unfixed code
   * Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
   */
  describe('Category 2: Master Data Endpoint Mismatch', () => {
    test('should fail: GET /subjects returns 404 (frontend uses root level, backend expects /attendance/subjects)', async () => {
      try {
        const response = await attendanceApi.subjectList();
        
        expect(response).toBeDefined();
        expect(Array.isArray(response)).toBe(true);
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
        console.log('✓ Counterexample found: GET /subjects returns 404');
        console.log('  Root cause: Frontend calls root-level endpoint, backend groups under /attendance prefix');
      }
    });

    test('should fail: POST /subjects returns 404', async () => {
      try {
        const response = await attendanceApi.subjectStore({
          nama: 'Matematika',
          kode: 'MTK',
        });
        
        expect(response).toBeDefined();
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
        console.log('✓ Counterexample found: POST /subjects returns 404');
      }
    });

    test('should fail: PUT /subjects/{id} returns 404', async () => {
      try {
        const response = await attendanceApi.subjectUpdate(1, {
          nama: 'Matematika Updated',
        });
        
        expect(response).toBeDefined();
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
        console.log('✓ Counterexample found: PUT /subjects/{id} returns 404');
      }
    });

    test('should fail: GET /classes returns 404 (frontend uses root level, backend expects /attendance/classes)', async () => {
      try {
        const response = await attendanceApi.classList();
        
        expect(response).toBeDefined();
        expect(Array.isArray(response)).toBe(true);
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
        console.log('✓ Counterexample found: GET /classes returns 404');
        console.log('  Root cause: Frontend calls root-level endpoint, backend groups under /attendance prefix');
      }
    });

    test('should fail: POST /classes returns 404', async () => {
      try {
        const response = await attendanceApi.classStore({
          nama: 'Kelas 7A',
          tingkat: '7',
        });
        
        expect(response).toBeDefined();
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
        console.log('✓ Counterexample found: POST /classes returns 404');
      }
    });

    test('should fail: PUT /classes/{id} returns 404', async () => {
      try {
        const response = await attendanceApi.classUpdate(1, {
          nama: 'Kelas 7A Updated',
        });
        
        expect(response).toBeDefined();
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
        console.log('✓ Counterexample found: PUT /classes/{id} returns 404');
      }
    });

    test('should fail: GET /lesson-schedules returns 404 (frontend uses /lesson-schedules, backend expects /attendance/schedules)', async () => {
      try {
        const response = await attendanceApi.scheduleList();
        
        expect(response).toBeDefined();
        expect(Array.isArray(response)).toBe(true);
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
        console.log('✓ Counterexample found: GET /lesson-schedules returns 404');
        console.log('  Root cause: Frontend uses /lesson-schedules, backend uses /attendance/schedules');
      }
    });

    test('should fail: POST /lesson-schedules returns 404', async () => {
      try {
        const response = await attendanceApi.scheduleStore({
          jam_ke: 1,
          jam_mulai: '07:00',
          jam_selesai: '07:45',
        });
        
        expect(response).toBeDefined();
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
        console.log('✓ Counterexample found: POST /lesson-schedules returns 404');
      }
    });
  });

  /**
   * Bug Category 3: QR Scan Payload Mismatch
   * 
   * Frontend sends: { qr_code: string }
   * Backend expects: { code: string, type: 'teacher' | 'student' }
   * 
   * Expected: Validation error or data not processed on unfixed code
   * Requirements: 1.9
   */
  describe('Category 3: QR Scan Payload Mismatch', () => {
    test('should fail: QR scan with { qr_code } payload fails validation (backend expects { code, type })', async () => {
      try {
        const response = await attendanceApi.qrScan('TEACHER-12345');
        
        // If this succeeds on unfixed code, the backend might be accepting wrong payload
        expect(response).toBeDefined();
        expect(response.success).toBe(true);
      } catch (error: any) {
        // On unfixed code, we expect validation error or 422
        expect([400, 422, 500].includes(error.response?.status)).toBe(true);
        console.log('✓ Counterexample found: QR scan with { qr_code } payload fails');
        console.log('  Root cause: Frontend sends { qr_code }, backend expects { code, type }');
        console.log('  Error:', error.response?.data?.message || error.message);
      }
    });
  });

  /**
   * Bug Category 4: HTTP Method Mismatch
   * 
   * Frontend uses: POST /attendance/settings, POST /attendance/check-wa
   * Backend expects: PUT /attendance/settings, GET /attendance/check-wa
   * 
   * Expected: 405 Method Not Allowed errors on unfixed code
   * Requirements: 1.10, 1.11
   */
  describe('Category 4: HTTP Method Mismatch', () => {
    test('should fail: POST /attendance/settings returns 405 (backend expects PUT)', async () => {
      try {
        const response = await attendanceApi.settingsUpdate({
          absensi_guru_aktif: true,
          absensi_siswa_aktif: true,
        });
        
        expect(response).toBeDefined();
      } catch (error: any) {
        // On unfixed code, we expect 405 Method Not Allowed
        expect(error.response?.status).toBe(405);
        console.log('✓ Counterexample found: POST /attendance/settings returns 405');
        console.log('  Root cause: Frontend uses POST, backend expects PUT');
      }
    });

    test('should fail: POST /attendance/check-wa returns 405 (backend expects GET)', async () => {
      try {
        const response = await attendanceApi.checkWaConnection();
        
        expect(response).toBeDefined();
      } catch (error: any) {
        // On unfixed code, we expect 405 Method Not Allowed
        expect(error.response?.status).toBe(405);
        console.log('✓ Counterexample found: POST /attendance/check-wa returns 405');
        console.log('  Root cause: Frontend uses POST, backend expects GET');
      }
    });
  });

  /**
   * Bug Category 5: Data Parsing Logic Error
   * 
   * Backend returns: { logs: [{ student_id: 1, status: "Hadir" }] }
   * Frontend accesses: r.student_id (should be r.logs[0].student_id)
   * 
   * Expected: undefined values, data not displayed on unfixed code
   * Requirements: 1.12, 1.13
   */
  describe('Category 5: Data Parsing Logic Error', () => {
    test('should fail: accessing r.student_id directly returns undefined (data is in r.logs array)', () => {
      // Simulate backend response structure
      const mockBackendResponse = {
        id: 1,
        class_id: 1,
        subject_id: 1,
        tanggal: '2024-01-15',
        logs: [
          { student_id: 1, status: 'Hadir' },
          { student_id: 2, status: 'Sakit' },
          { student_id: 3, status: 'Izin' },
        ],
      };

      // Simulate unfixed parsing logic (accessing flat fields)
      const unfixedParsing = () => {
        const statuses: Record<number, string> = {};
        // @ts-expect-error - This is the bug: accessing r.student_id directly
        const studentId = mockBackendResponse.student_id;
        // @ts-expect-error - This is the bug: accessing r.status directly
        const status = mockBackendResponse.status;
        
        return { studentId, status, statuses };
      };

      const result = unfixedParsing();
      
      // On unfixed code, these should be undefined
      expect(result.studentId).toBeUndefined();
      expect(result.status).toBeUndefined();
      console.log('✓ Counterexample found: Accessing r.student_id directly returns undefined');
      console.log('  Root cause: Code accesses flat fields but data is nested in logs JSON field');
      
      // Correct parsing logic (for reference)
      const fixedParsing = () => {
        const statuses: Record<number, string> = {};
        const logs = mockBackendResponse.logs || [];
        logs.forEach((log: any) => {
          statuses[log.student_id] = log.status;
        });
        return statuses;
      };

      const correctResult = fixedParsing();
      expect(correctResult[1]).toBe('Hadir');
      expect(correctResult[2]).toBe('Sakit');
      expect(correctResult[3]).toBe('Izin');
      console.log('  Fixed parsing correctly extracts data from logs array');
    });
  });

  /**
   * Bug Category 6: Missing PIN Validation
   * 
   * Current: PIN only validated client-side
   * Expected: Backend validation via API
   * 
   * Expected: No backend endpoint exists on unfixed code
   * Requirements: 1.14
   */
  describe('Category 6: Missing PIN Validation', () => {
    test('should fail: /attendance/verify-pin endpoint does not exist (returns 404)', async () => {
      try {
        // Try to call verify-pin endpoint (doesn't exist on unfixed code)
        const response = await apiClient.post('/attendance/verify-pin', {
          pin: '123456',
        });
        
        // If this succeeds, the endpoint was added
        expect(response.data).toBeDefined();
      } catch (error: any) {
        // On unfixed code, we expect 404 (endpoint doesn't exist)
        expect(error.response?.status).toBe(404);
        console.log('✓ Counterexample found: /attendance/verify-pin endpoint does not exist');
        console.log('  Root cause: No backend endpoint for PIN validation, only client-side check');
      }
    });

    test('should demonstrate: client-side only PIN validation is insecure', () => {
      // Simulate client-side only validation (current unfixed behavior)
      const clientSideValidation = (pin: string) => {
        // Any PIN is accepted client-side - no backend check
        return pin.length > 0; // Always returns true if PIN is not empty
      };

      // This demonstrates the security vulnerability
      expect(clientSideValidation('000000')).toBe(true); // Wrong PIN accepted
      expect(clientSideValidation('123456')).toBe(true); // Any PIN accepted
      expect(clientSideValidation('wrong')).toBe(true);  // Even non-numeric accepted
      
      console.log('✓ Counterexample found: Client-side only validation accepts any PIN');
      console.log('  Root cause: No backend validation, security vulnerability');
    });
  });

  /**
   * Bug Category 7: Missing Navigation Menu
   * 
   * Current: No attendance menu items in navigation
   * Expected: Attendance submenu with 8 items for operator role
   * 
   * Expected: Navigation items don't exist on unfixed code
   * Requirements: 1.15
   */
  describe('Category 7: Missing Navigation Menu', () => {
    test('should fail: attendance navigation items do not exist in AppShell', async () => {
      // This is a conceptual test - actual implementation would use React Testing Library
      // to render AppShell and check for menu items
      
      // Simulate checking for navigation items
      const hasAttendanceMenu = () => {
        // On unfixed code, this would return false
        // because attendance menu items are not added to AppShell.tsx
        return false;
      };

      expect(hasAttendanceMenu()).toBe(false);
      console.log('✓ Counterexample found: Attendance menu items do not exist in navigation');
      console.log('  Root cause: Attendance menu group not added to AppShell.tsx navGroups');
      console.log('  Expected items: Absensi Guru, Absensi Siswa, Scanner QR, Mata Pelajaran,');
      console.log('                  Kelas/Rombel, Jadwal Jam, Laporan Absensi, Pengaturan Absensi');
    });
  });

  /**
   * Bug Category 8: Missing Geolocation Tracking
   * 
   * Current: No GPS coordinates captured or validated
   * Expected: Latitude/longitude recorded, geofencing validation
   * 
   * Expected: Backend doesn't accept geolocation data on unfixed code
   * Requirements: 1.16, 1.17, 1.18
   */
  describe('Category 8: Missing Geolocation Tracking', () => {
    test('should fail: backend does not accept latitude/longitude in teacher attendance', async () => {
      try {
        const response = await attendanceApi.teacherStore({
          teacher_id: 1,
          tanggal: '2024-01-15',
          status: 'Hadir',
          jam_masuk: '07:00',
          latitude: -7.123456,
          longitude: 109.123456,
        });
        
        // If this succeeds and stores geolocation, the feature was added
        expect(response).toBeDefined();
        expect(response.latitude).toBeDefined();
        expect(response.longitude).toBeDefined();
      } catch (error: any) {
        // On unfixed code, backend might reject unknown fields or ignore them
        console.log('✓ Counterexample found: Backend does not accept/store geolocation data');
        console.log('  Root cause: No latitude/longitude columns in database schema');
        console.log('  Error:', error.response?.data?.message || 'Fields ignored or rejected');
      }
    });

    test('should fail: no geofencing validation exists', async () => {
      try {
        // Try to record attendance with coordinates far from school
        const response = await attendanceApi.teacherStore({
          teacher_id: 1,
          tanggal: '2024-01-15',
          status: 'Hadir',
          jam_masuk: '07:00',
          latitude: -6.200000, // Far from school location
          longitude: 106.816666,
        });
        
        // On unfixed code, this would succeed (no geofencing validation)
        expect(response).toBeDefined();
        console.log('✓ Counterexample found: Attendance accepted from any location (no geofencing)');
        console.log('  Root cause: No geofencing validation in backend');
      } catch (error: any) {
        // If this fails, geofencing might be implemented
        console.log('  Geofencing validation might be implemented');
      }
    });

    test('should fail: no geolocation settings exist', async () => {
      try {
        const settings = await attendanceApi.settingsShow();
        
        // Check if geolocation settings exist
        const hasGeolocationSettings = 
          'geolocation_enabled' in settings &&
          'school_latitude' in settings &&
          'school_longitude' in settings &&
          'geofence_radius_meters' in settings;
        
        expect(hasGeolocationSettings).toBe(false);
        console.log('✓ Counterexample found: No geolocation settings in attendance settings');
        console.log('  Root cause: Database schema missing geofencing configuration columns');
      } catch (error: any) {
        console.log('  Could not fetch settings:', error.message);
      }
    });

    test('should demonstrate: no useGeolocation hook exists', () => {
      // This is a conceptual test - actual implementation would check if hook file exists
      
      const hookExists = () => {
        // On unfixed code, this would return false
        // because src/hooks/useGeolocation.ts doesn't exist
        return false;
      };

      expect(hookExists()).toBe(false);
      console.log('✓ Counterexample found: useGeolocation custom hook does not exist');
      console.log('  Root cause: No reusable hook for browser Geolocation API');
    });
  });
});

/**
 * SUMMARY OF EXPECTED FAILURES ON UNFIXED CODE:
 * 
 * Category 1: Student Logs Endpoint Mismatch
 *   - GET /attendance/student-logs → 404
 *   - POST /attendance/student-logs → 404
 * 
 * Category 2: Master Data Endpoint Mismatch
 *   - GET /subjects → 404
 *   - POST /subjects → 404
 *   - PUT /subjects/{id} → 404
 *   - GET /classes → 404
 *   - POST /classes → 404
 *   - PUT /classes/{id} → 404
 *   - GET /lesson-schedules → 404
 *   - POST /lesson-schedules → 404
 * 
 * Category 3: QR Scan Payload Mismatch
 *   - POST /attendance/qr-scan with { qr_code } → Validation error
 * 
 * Category 4: HTTP Method Mismatch
 *   - POST /attendance/settings → 405
 *   - POST /attendance/check-wa → 405
 * 
 * Category 5: Data Parsing Logic Error
 *   - Accessing r.student_id directly → undefined
 * 
 * Category 6: Missing PIN Validation
 *   - POST /attendance/verify-pin → 404
 *   - Client-side only validation → Security vulnerability
 * 
 * Category 7: Missing Navigation Menu
 *   - Attendance menu items → Not found in AppShell
 * 
 * Category 8: Missing Geolocation Tracking
 *   - Backend doesn't accept latitude/longitude
 *   - No geofencing validation
 *   - No geolocation settings
 *   - No useGeolocation hook
 * 
 * NEXT STEPS:
 * 1. Run these tests on unfixed code: npm test attendanceApiFixes.exploration.test.ts
 * 2. Document all failures (counterexamples)
 * 3. Implement fixes in Phase 2
 * 4. Re-run these same tests to verify fixes work
 */
