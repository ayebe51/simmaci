# Attendance API Fixes - Bugfix Design

## Overview

Fitur attendance di aplikasi SIMMACI sudah diimplementasikan di frontend dan backend, tetapi tidak berfungsi karena ada ketidakcocokan (mismatch) antara API endpoint, payload structure, HTTP methods, dan logic parsing data. Bug ini menyebabkan fitur attendance tidak dapat digunakan sama sekali.

**Fix Strategy**: Perbaikan akan dilakukan di **frontend** untuk menyesuaikan dengan endpoint dan contract yang sudah ada di backend. Backend sudah correct dan consistent, sehingga tidak perlu diubah. Pendekatan ini meminimalkan risk dan memastikan backward compatibility dengan data yang sudah ada.

## Glossary

- **Bug_Condition (C)**: Kondisi yang memicu bug - ketika frontend memanggil API endpoint yang tidak match dengan backend
- **Property (P)**: Behavior yang diharapkan - frontend berhasil fetch/save data attendance dengan endpoint yang benar
- **Preservation**: Existing backend behavior dan data yang sudah tersimpan harus tetap unchanged
- **AttendanceController**: Controller di `backend/app/Http/Controllers/Api/AttendanceController.php` yang handle semua attendance endpoints
- **attendanceApi**: Object di `src/lib/api.ts` yang define semua attendance API calls dari frontend
- **StudentAttendanceLog**: Model Laravel yang store aggregate attendance data dengan JSON field `logs`
- **Tenant Scoping**: Mekanisme multi-tenancy yang auto-filter data berdasarkan `school_id` user

## Bug Details

### Bug Condition

Bug manifests dalam 8 kategori berbeda yang semuanya disebabkan oleh mismatch antara frontend dan backend atau missing features:

**Formal Specification:**
```
FUNCTION isBugCondition(apiCall)
  INPUT: apiCall of type { method: string, endpoint: string, payload: object }
  OUTPUT: boolean
  
  RETURN (
    // Category 1: Student logs endpoint mismatch
    (apiCall.endpoint == '/attendance/student-logs' AND backendEndpoint == '/attendance/student-log')
    
    OR
    
    // Category 2: Master data endpoint mismatch
    (apiCall.endpoint IN ['/subjects', '/classes', '/lesson-schedules'] 
     AND backendEndpoint IN ['/attendance/subjects', '/attendance/classes', '/attendance/schedules'])
    
    OR
    
    // Category 3: QR scan payload mismatch
    (apiCall.endpoint == '/attendance/qr-scan' 
     AND apiCall.payload.qr_code EXISTS 
     AND backendExpects.code AND backendExpects.type)
    
    OR
    
    // Category 4: HTTP method mismatch
    (apiCall.method == 'POST' AND apiCall.endpoint == '/attendance/settings' AND backendMethod == 'PUT')
    OR (apiCall.method == 'POST' AND apiCall.endpoint == '/attendance/check-wa' AND backendMethod == 'GET')
    
    OR
    
    // Category 5: Data parsing logic error
    (apiCall.endpoint == '/attendance/student-log' 
     AND frontendCode accesses r.student_id directly 
     AND actualData.logs[].student_id)
    
    OR
    
    // Category 6: Missing PIN validation
    (userAction == 'enterPIN' AND validation == 'client-side-only')
    
    OR
    
    // Category 7: Missing navigation menu
    (userRole == 'operator' AND attendanceMenuItems.length == 0)
    
    OR
    
    // Category 8: Missing geolocation tracking
    (userAction == 'recordAttendance' AND geolocationData == NULL)
    OR (attendanceSettings.geofencing_enabled AND geolocationValidation == FALSE)
  )
END FUNCTION
```

### Examples

**Category 1 - Student Logs Endpoint:**
- Frontend calls: `GET /attendance/student-logs`
- Backend expects: `GET /attendance/student-log` (singular)
- Result: 404 Not Found

**Category 2 - Master Data Endpoints:**
- Frontend calls: `GET /subjects`
- Backend expects: `GET /attendance/subjects`
- Result: 404 Not Found

**Category 3 - QR Scan Payload:**
- Frontend sends: `{ qr_code: "12345" }`
- Backend expects: `{ code: "12345", type: "teacher" }`
- Result: Validation error atau data tidak terproses

**Category 4 - HTTP Method:**
- Frontend calls: `POST /attendance/settings`
- Backend expects: `PUT /attendance/settings`
- Result: 405 Method Not Allowed

**Category 5 - Data Parsing:**
- Backend returns: `{ logs: [{ student_id: 1, status: "Hadir" }] }`
- Frontend accesses: `r.student_id` (should be `r.logs[0].student_id`)
- Result: undefined, data tidak ditampilkan

**Category 6 - PIN Validation:**
- User enters PIN: "123456"
- Frontend checks: client-side only (any PIN accepted)
- Expected: Backend validation via API
- Result: Security vulnerability

**Category 7 - Navigation Menu:**
- User role: `operator`
- Current menu: No attendance items visible
- Expected: Attendance submenu with 8 items
- Result: User cannot access attendance features via UI

**Category 8 - Geolocation Tracking:**
- User action: Record attendance (teacher or student)
- Current: No GPS coordinates captured
- Expected: Latitude/longitude recorded, geofencing validation
- Result: Cannot verify attendance location authenticity

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Backend API endpoints dan response structure harus tetap sama
- Data attendance yang sudah tersimpan di database harus tetap valid
- Tenant scoping mechanism harus tetap berfungsi (operator hanya lihat data school_id mereka)
- Authentication dan authorization flow harus tetap sama
- Teacher attendance endpoints yang sudah working (`/attendance/teacher`) harus tetap berfungsi
- Student report endpoint yang sudah working (`/attendance/student-report`) harus tetap berfungsi

**Scope:**
Semua backend code dan database schema akan tetap unchanged. Fix hanya dilakukan di frontend untuk menyesuaikan dengan backend contract yang sudah ada.

## Hypothesized Root Cause

Based on bug analysis, root causes untuk setiap kategori:

### 1. **Student Logs Endpoint Mismatch**
   - Frontend developer menggunakan plural form `/student-logs` (common REST convention)
   - Backend menggunakan singular form `/student-log` (Laravel convention untuk aggregate resource)
   - Tidak ada API documentation atau contract testing yang catch mismatch ini

### 2. **Master Data Endpoint Mismatch**
   - Frontend developer assume master data endpoints di root level (`/subjects`, `/classes`)
   - Backend group semua attendance-related endpoints under `/attendance` prefix untuk better organization
   - Inconsistent dengan pattern lain di aplikasi (e.g., `/teachers`, `/students` di root level)

### 3. **QR Scan Payload Mismatch**
   - Frontend mengirim `qr_code` sebagai single field
   - Backend expect `code` + `type` untuk distinguish antara teacher dan student QR codes
   - Frontend tidak implement type detection logic

### 4. **HTTP Method Mismatch**
   - Frontend menggunakan POST untuk update operations (common in some frameworks)
   - Backend menggunakan PUT untuk update (RESTful convention)
   - Frontend menggunakan POST untuk check-wa (treating it as action)
   - Backend menggunakan GET (treating it as query)

### 5. **Data Parsing Logic Error**
   - `StudentAttendanceLog` model menyimpan data sebagai aggregate dengan JSON field `logs`
   - Frontend developer tidak aware bahwa data structure adalah nested
   - Code ditulis dengan assumption bahwa response adalah flat array

### 6. **Missing PIN Validation**
   - PIN validation logic tidak diimplementasikan di backend
   - Frontend hanya check PIN di client-side untuk UX purposes
   - Tidak ada endpoint `/attendance/verify-pin` atau similar

### 7. **Missing Navigation Menu**
   - Attendance menu items tidak ditambahkan ke `AppShell.tsx` navigation config
   - Feature diimplementasikan tapi tidak di-wire ke main navigation
   - Conditional rendering logic untuk operator role tidak include attendance group

### 8. **Missing Geolocation Tracking**
   - Tidak ada implementasi browser Geolocation API untuk capture GPS coordinates
   - Database schema tidak memiliki kolom `latitude` dan `longitude` untuk attendance records
   - Tidak ada geofencing validation untuk memastikan user berada di lokasi sekolah
   - Settings tidak memiliki opsi untuk configure school coordinates dan geofencing radius
   - Attendance reports tidak menampilkan location data untuk verification

## Correctness Properties

Property 1: Bug Condition - API Endpoint Consistency

_For any_ API call from frontend to attendance endpoints, the fixed code SHALL use the correct endpoint paths that match backend routes definition in `backend/routes/api.php`, ensuring all requests return successful responses (200/201) instead of 404 errors.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

Property 2: Bug Condition - Payload Structure Consistency

_For any_ API call that sends data to backend (POST/PUT requests), the fixed code SHALL send payload with field names and structure that match backend validation rules in `AttendanceController`, ensuring data is processed correctly without validation errors.

**Validates: Requirements 2.9, 2.10, 2.11**

Property 3: Bug Condition - Data Parsing Correctness

_For any_ API response from backend containing nested data structures (e.g., `logs` JSON field), the fixed code SHALL correctly parse and access nested fields, ensuring data is displayed properly in the UI.

**Validates: Requirements 2.12, 2.13**

Property 4: Bug Condition - Security Validation

_For any_ security-sensitive operation (e.g., PIN entry for scanner mode), the fixed code SHALL validate credentials via backend API instead of client-side only, ensuring proper authorization.

**Validates: Requirements 2.14**

Property 5: Bug Condition - Navigation Accessibility

_For any_ user with `operator` role, the fixed navigation SHALL display attendance menu items, ensuring users can access attendance features through the UI.

**Validates: Requirements 2.15**

Property 6: Preservation - Backend Compatibility

_For any_ API endpoint that is already working correctly (teacher attendance, student report, settings show), the fixed code SHALL continue to use the same endpoints and payload structures, preserving existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

Property 7: Preservation - Tenant Isolation

_For any_ attendance data access by operator users, the fixed code SHALL continue to respect tenant scoping, ensuring operators only see data from their own `school_id`.

**Validates: Requirements 3.5**

Property 8: Preservation - Authentication & Authorization

_For any_ attendance API call, the fixed code SHALL continue to include authentication token and respect authorization rules, ensuring unauthenticated users get 401 errors.

**Validates: Requirements 3.6**

Property 9: Preservation - Data Validation

_For any_ invalid data submission (missing required fields, invalid formats), the backend SHALL continue to return validation errors, and frontend SHALL handle them appropriately.

**Validates: Requirements 3.7**

Property 10: Preservation - Existing Data Integrity

_For any_ existing attendance records in database, the fixed code SHALL continue to read and write data using the same schema and structure, ensuring no data corruption or loss.

**Validates: Requirements 3.8**

Property 11: Bug Condition - Geolocation Tracking & Validation

_For any_ attendance record creation (teacher or student), the fixed code SHALL capture GPS coordinates using browser Geolocation API, validate location against school geofencing settings if enabled, and store latitude/longitude in database for verification purposes.

**Validates: Requirements 2.16, 2.17, 2.18, 2.19**

## Fix Implementation

### Changes Required

All fixes will be made in **frontend code only**. Backend remains unchanged.

#### File 1: `src/lib/api.ts`

**Function**: `attendanceApi` object

**Specific Changes**:

1. **Fix Student Logs Endpoints** (Bug Category 1):
   - Change `studentLogIndex` from `/attendance/student-logs` to `/attendance/student-log`
   - Change `studentLogStore` from `/attendance/student-logs` to `/attendance/student-log`

2. **Fix Master Data Endpoints** (Bug Category 2):
   - Change `subjectList` from `/subjects` to `/attendance/subjects`
   - Change `subjectStore` from `/subjects` to `/attendance/subjects`
   - Change `subjectUpdate` from `/subjects/${id}` to `/attendance/subjects/${id}`
   - Change `classList` from `/classes` to `/attendance/classes`
   - Change `classStore` from `/classes` to `/attendance/classes`
   - Change `classUpdate` from `/classes/${id}` to `/attendance/classes/${id}`
   - Change `scheduleList` from `/lesson-schedules` to `/attendance/schedules`
   - Change `scheduleStore` from `/lesson-schedules` to `/attendance/schedules`

3. **Fix QR Scan Payload** (Bug Category 3):
   - Change `qrScan` payload from `{ qr_code: qrCode }` to `{ code: qrCode, type: 'teacher' }`
   - Add logic to determine type based on context (guru mode vs siswa mode)

4. **Fix HTTP Methods** (Bug Category 4):
   - Change `settingsUpdate` from `POST /attendance/settings` to `PUT /attendance/settings`
   - Change `checkWaConnection` from `POST /attendance/check-wa` to `GET /attendance/check-wa`

5. **Add PIN Validation Endpoint** (Bug Category 6):
   - Add new method `verifyPin: (pin: string) => apiClient.post('/attendance/verify-pin', { pin }).then((r) => r.data)`
   - Note: Backend endpoint needs to be added, but for now we can skip this or use settings endpoint

#### File 2: `src/features/attendance/StudentAttendancePage.tsx`

**Function**: `useEffect` hook that processes `existingRecords`

**Specific Changes** (Bug Category 5):

1. **Fix Data Parsing Logic**:
   ```typescript
   // BEFORE (incorrect):
   useEffect(() => {
     if (existingRecords.length > 0) {
       const statuses: Record<number, string> = {};
       existingRecords.forEach((r: any) => {
         statuses[r.student_id] = r.status;  // ❌ Wrong: accessing flat fields
       });
       setStudentStatuses(statuses);
     }
   }, [existingRecords]);
   
   // AFTER (correct):
   useEffect(() => {
     if (existingRecords.length > 0) {
       const statuses: Record<number, string> = {};
       existingRecords.forEach((r: any) => {
         // ✅ Correct: parse logs JSON field
         const logs = r.logs || [];
         logs.forEach((log: any) => {
           statuses[log.student_id] = log.status;
         });
       });
       setStudentStatuses(statuses);
     } else {
       setStudentStatuses({});
     }
   }, [existingRecords]);
   ```

2. **Fix Payload Structure for Store**:
   ```typescript
   // Ensure payload matches backend expectation:
   // Backend expects: { class_id, subject_id, tanggal, jam_ke?, logs: [...] }
   // Frontend currently sends: { class_id, subject_id, tanggal, records: [...] }
   
   // Change 'records' to 'logs' in handleSaveBulk function
   ```

#### File 3: `src/features/attendance/QrScannerPage.tsx`

**Function**: `qrScanMutation` and `handlePinSubmit`

**Specific Changes**:

1. **Fix QR Scan Payload** (Bug Category 3):
   ```typescript
   // BEFORE:
   const qrScanMutation = useMutation({
     queryFn: (qrCode: string) => attendanceApi.qrScan(qrCode),
     // ...
   });
   
   // AFTER:
   const qrScanMutation = useMutation({
     queryFn: ({ code, type }: { code: string; type: 'teacher' | 'student' }) => 
       attendanceApi.qrScan(code, type),
     // ...
   });
   
   // Update the mutation call in scanner callback:
   qrScanMutation.mutate({ 
     code: decodedText, 
     type: mode === 'guru' ? 'teacher' : 'student' 
   });
   ```

2. **Add PIN Validation** (Bug Category 6):
   ```typescript
   // BEFORE (client-side only):
   const handlePinSubmit = () => {
     if (!schoolId || !pin) {
       toast.error("Pilih sekolah dan masukkan PIN");
       return;
     }
     setAuthState("authenticated");
     toast.success("PIN diterima!");
   };
   
   // AFTER (with backend validation):
   const handlePinSubmit = async () => {
     if (!schoolId || !pin) {
       toast.error("Pilih sekolah dan masukkan PIN");
       return;
     }
     
     try {
       // Validate PIN via backend
       const result = await attendanceApi.verifyPin(pin);
       if (result.success) {
         setAuthState("authenticated");
         toast.success("PIN diterima!");
       } else {
         toast.error("PIN salah!");
       }
     } catch (error) {
       toast.error("Gagal memvalidasi PIN");
     }
   };
   ```

#### File 4: `src/components/layout/AppShell.tsx`

**Function**: `navGroups` array

**Specific Changes** (Bug Category 7):

1. **Add Attendance Navigation Menu**:
   ```typescript
   // Add new navigation group for Attendance (only for operators)
   const navGroups = [
     // ... existing groups ...
     
     // Add this group BEFORE "Manajemen SDM":
     ...(!isSuperAdmin ? [{
       title: "Absensi",
       items: [
         { label: "Absensi Guru", href: "/dashboard/attendance/teacher", icon: UserCheck },
         { label: "Absensi Siswa", href: "/dashboard/attendance/student", icon: GraduationCap },
         { label: "Scanner QR", href: "/dashboard/attendance/scanner", icon: ScanLine },
         { label: "Mata Pelajaran", href: "/dashboard/attendance/subjects", icon: BookOpen },
         { label: "Kelas / Rombel", href: "/dashboard/attendance/classes", icon: School },
         { label: "Jadwal Jam", href: "/dashboard/attendance/schedule", icon: ClipboardList },
         { label: "Laporan Absensi", href: "/dashboard/attendance/report", icon: FileBarChart },
         { label: "Pengaturan Absensi", href: "/dashboard/attendance/settings", icon: Settings },
       ]
     }] : []),
     
     // ... rest of groups ...
   ];
   ```

2. **Import Required Icons**:
   ```typescript
   // Add to existing imports at top of file:
   import { UserCheck, GraduationCap, ScanLine, BookOpen, ClipboardList } from "lucide-react";
   ```

#### File 5: `backend/app/Http/Controllers/Api/AttendanceController.php` (Optional)

**Function**: Add `verifyPin` method

**Specific Changes** (Bug Category 6 - Backend Support):

```php
public function verifyPin(Request $request): JsonResponse
{
    $request->validate([
        'pin' => 'required|string',
    ]);

    $settings = AttendanceSetting::where('school_id', $request->user()->school_id)->first();
    
    if (!$settings || !$settings->scanner_pin) {
        return response()->json([
            'success' => false,
            'message' => 'PIN scanner belum dikonfigurasi'
        ], 400);
    }

    if ($request->pin === $settings->scanner_pin) {
        return response()->json([
            'success' => true,
            'message' => 'PIN valid'
        ]);
    }

    return response()->json([
        'success' => false,
        'message' => 'PIN salah'
    ], 401);
}
```

**Add route in `backend/routes/api.php`**:
```php
Route::post('verify-pin', [AttendanceController::class, 'verifyPin']);
```

#### File 6: Database Migration - Add Geolocation Columns

**File**: `backend/database/migrations/YYYY_MM_DD_add_geolocation_to_attendance.php`

**Specific Changes** (Bug Category 8 - Database Schema):

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add geolocation columns to teacher_attendances
        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->decimal('latitude', 10, 8)->nullable()->after('scanned_by');
            $table->decimal('longitude', 11, 8)->nullable()->after('latitude');
            $table->boolean('location_verified')->default(false)->after('longitude');
        });

        // Add geolocation columns to student_attendance_logs
        Schema::table('student_attendance_logs', function (Blueprint $table) {
            $table->decimal('latitude', 10, 8)->nullable()->after('logs');
            $table->decimal('longitude', 11, 8)->nullable()->after('latitude');
            $table->boolean('location_verified')->default(false)->after('longitude');
        });

        // Add geofencing settings to attendance_settings
        Schema::table('attendance_settings', function (Blueprint $table) {
            $table->boolean('geolocation_enabled')->default(false)->after('gowa_device_id');
            $table->decimal('school_latitude', 10, 8)->nullable()->after('geolocation_enabled');
            $table->decimal('school_longitude', 11, 8)->nullable()->after('school_latitude');
            $table->integer('geofence_radius_meters')->default(100)->after('school_longitude');
        });
    }

    public function down(): void
    {
        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->dropColumn(['latitude', 'longitude', 'location_verified']);
        });

        Schema::table('student_attendance_logs', function (Blueprint $table) {
            $table->dropColumn(['latitude', 'longitude', 'location_verified']);
        });

        Schema::table('attendance_settings', function (Blueprint $table) {
            $table->dropColumn(['geolocation_enabled', 'school_latitude', 'school_longitude', 'geofence_radius_meters']);
        });
    }
};
```

#### File 7: Backend - Update AttendanceController for Geolocation

**Function**: Update `teacherStore` and `studentLogStore` methods

**Specific Changes** (Bug Category 8 - Backend Validation):

```php
// In teacherStore method, add geolocation validation:
public function teacherStore(Request $request): JsonResponse
{
    $data = $request->validate([
        'teacher_id' => 'required|exists:teachers,id',
        'tanggal' => 'required|date',
        'jam_masuk' => 'nullable|string',
        'jam_pulang' => 'nullable|string',
        'status' => 'required|string|in:Hadir,Sakit,Izin,Alpha',
        'keterangan' => 'nullable|string',
        'scanned_by' => 'nullable|string',
        'latitude' => 'nullable|numeric|between:-90,90',
        'longitude' => 'nullable|numeric|between:-180,180',
    ]);

    $data['school_id'] = $request->user()->school_id;

    // Geofencing validation
    if (isset($data['latitude']) && isset($data['longitude'])) {
        $settings = AttendanceSetting::where('school_id', $data['school_id'])->first();
        
        if ($settings && $settings->geolocation_enabled && $settings->school_latitude && $settings->school_longitude) {
            $distance = $this->calculateDistance(
                $data['latitude'], 
                $data['longitude'],
                $settings->school_latitude,
                $settings->school_longitude
            );
            
            $data['location_verified'] = $distance <= $settings->geofence_radius_meters;
            
            if (!$data['location_verified']) {
                return response()->json([
                    'success' => false,
                    'message' => "Lokasi Anda berada {$distance}m dari sekolah. Maksimal radius: {$settings->geofence_radius_meters}m",
                    'distance' => $distance,
                    'max_radius' => $settings->geofence_radius_meters
                ], 422);
            }
        }
    }

    $attendance = TeacherAttendance::updateOrCreate(
        ['teacher_id' => $data['teacher_id'], 'tanggal' => $data['tanggal']],
        $data
    );

    return response()->json($attendance, 201);
}

// Add helper method for distance calculation (Haversine formula)
private function calculateDistance($lat1, $lon1, $lat2, $lon2): float
{
    $earthRadius = 6371000; // meters
    
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    
    $a = sin($dLat/2) * sin($dLat/2) +
         cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
         sin($dLon/2) * sin($dLon/2);
    
    $c = 2 * atan2(sqrt($a), sqrt(1-$a));
    
    return $earthRadius * $c; // returns distance in meters
}
```

#### File 8: Frontend - Add Geolocation Hook

**File**: `src/hooks/useGeolocation.ts`

**Specific Changes** (Bug Category 8 - Frontend Geolocation):

```typescript
import { useState, useEffect } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation tidak didukung oleh browser Anda',
        loading: false,
      }));
      return;
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 10000,
      maximumAge: options.maximumAge ?? 0,
    };

    const onSuccess = (position: GeolocationPosition) => {
      setState({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        error: null,
        loading: false,
      });
    };

    const onError = (error: GeolocationPositionError) => {
      let errorMessage = 'Gagal mendapatkan lokasi';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Izin akses lokasi ditolak. Aktifkan GPS dan izinkan akses lokasi.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Informasi lokasi tidak tersedia';
          break;
        case error.TIMEOUT:
          errorMessage = 'Timeout mendapatkan lokasi';
          break;
      }

      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, geoOptions);
  }, [options.enableHighAccuracy, options.timeout, options.maximumAge]);

  return state;
}
```

#### File 9: Frontend - Update TeacherAttendancePage with Geolocation

**Function**: `handleStatusChange` in `TeacherAttendancePage.tsx`

**Specific Changes** (Bug Category 8):

```typescript
import { useGeolocation } from '@/hooks/useGeolocation';

export default function TeacherAttendancePage() {
  // ... existing code ...
  
  const geolocation = useGeolocation();

  const handleStatusChange = async (teacherId: number, status: string) => {
    const jamMasuk = status === "Hadir" ? new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }) : undefined;
    
    const payload: any = {
      teacher_id: teacherId,
      tanggal: selectedDate,
      status,
      jam_masuk: jamMasuk
    };

    // Add geolocation if available
    if (geolocation.latitude && geolocation.longitude) {
      payload.latitude = geolocation.latitude;
      payload.longitude = geolocation.longitude;
    }

    recordMutation.mutate(payload);
  };

  // Show geolocation status
  useEffect(() => {
    if (geolocation.error) {
      toast.warning(geolocation.error);
    }
  }, [geolocation.error]);

  // ... rest of component ...
}
```

#### File 10: Frontend - Update AttendanceSettingsPage with Geofencing

**Function**: Add geofencing settings UI

**Specific Changes** (Bug Category 8):

```typescript
// Add to formState:
const [formState, setFormState] = useState({
  // ... existing fields ...
  geolocation_enabled: false,
  school_latitude: null,
  school_longitude: null,
  geofence_radius_meters: 100,
});

// Add UI section in render:
<Card className="border-0 shadow-sm rounded-xl overflow-hidden md:col-span-2">
  <CardHeader className="pb-3 bg-slate-50/50">
    <CardTitle className="text-base flex items-center gap-2">
      <MapPin className="h-4 w-4 text-red-600" />
      Geolocation & Geofencing
    </CardTitle>
  </CardHeader>
  <CardContent className="pt-4 space-y-4">
    <div className="flex items-center justify-between">
      <Label className="text-sm text-slate-600">Aktifkan tracking lokasi GPS</Label>
      <Switch 
        checked={formState.geolocation_enabled} 
        onCheckedChange={(v) => setFormState({...formState, geolocation_enabled: v})} 
      />
    </div>
    
    {formState.geolocation_enabled && (
      <>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Latitude Sekolah</Label>
            <Input
              type="number"
              step="0.000001"
              placeholder="-7.123456"
              value={formState.school_latitude || ''}
              onChange={(e) => setFormState({...formState, school_latitude: parseFloat(e.target.value)})}
              className="font-mono text-sm rounded-xl h-11"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Longitude Sekolah</Label>
            <Input
              type="number"
              step="0.000001"
              placeholder="109.123456"
              value={formState.school_longitude || ''}
              onChange={(e) => setFormState({...formState, school_longitude: parseFloat(e.target.value)})}
              className="font-mono text-sm rounded-xl h-11"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Radius Geofencing (meter)
          </Label>
          <Input
            type="number"
            min="10"
            max="1000"
            step="10"
            value={formState.geofence_radius_meters}
            onChange={(e) => setFormState({...formState, geofence_radius_meters: parseInt(e.target.value)})}
            className="font-mono text-sm rounded-xl h-11"
          />
          <p className="text-xs text-slate-400">
            Absensi hanya valid jika dilakukan dalam radius {formState.geofence_radius_meters}m dari koordinat sekolah
          </p>
        </div>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition((pos) => {
                setFormState({
                  ...formState,
                  school_latitude: pos.coords.latitude,
                  school_longitude: pos.coords.longitude
                });
                toast.success('Koordinat lokasi saat ini berhasil diambil');
              });
            }
          }}
        >
          <MapPin className="h-4 w-4 mr-2" />
          Gunakan Lokasi Saat Ini
        </Button>
      </>
    )}
  </CardContent>
</Card>
```

### Summary of File Changes

| File | Changes | Bug Categories Fixed |
|------|---------|---------------------|
| `src/lib/api.ts` | Fix 11 endpoint paths, 2 HTTP methods, 1 payload structure | 1, 2, 3, 4 |
| `src/features/attendance/StudentAttendancePage.tsx` | Fix data parsing logic in useEffect | 5 |
| `src/features/attendance/QrScannerPage.tsx` | Fix QR scan payload, add PIN validation | 3, 6 |
| `src/components/layout/AppShell.tsx` | Add attendance navigation menu | 7 |
| `backend/app/Http/Controllers/Api/AttendanceController.php` | Add verifyPin method, geolocation validation | 6, 8 |
| `backend/routes/api.php` | Add verify-pin route | 6 |
| `backend/database/migrations/*_add_geolocation_to_attendance.php` | Add latitude, longitude, geofencing columns | 8 |
| `src/hooks/useGeolocation.ts` | Custom hook for browser Geolocation API | 8 |
| `src/features/attendance/TeacherAttendancePage.tsx` | Add geolocation capture on attendance | 8 |
| `src/features/attendance/AttendanceSettingsPage.tsx` | Add geofencing settings UI | 8 |

## Testing Strategy

### Validation Approach

Testing strategy follows three-phase approach:
1. **Exploratory Bug Condition Checking**: Run tests on UNFIXED code to confirm bugs exist
2. **Fix Checking**: Verify fixes work correctly for all buggy inputs
3. **Preservation Checking**: Verify existing working features remain unchanged

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate bugs BEFORE implementing fixes. Confirm root cause analysis.

**Test Plan**: Write integration tests that simulate real user flows and API calls. Run on UNFIXED code to observe failures.

**Test Cases**:

1. **Student Logs Endpoint Test** (will fail on unfixed code):
   ```typescript
   test('should fetch student logs with correct endpoint', async () => {
     const response = await attendanceApi.studentLogIndex({ 
       class_id: 1, 
       subject_id: 1, 
       tanggal: '2024-01-15' 
     });
     expect(response).toBeDefined();
     // Will fail with 404 on unfixed code
   });
   ```

2. **Master Data Endpoints Test** (will fail on unfixed code):
   ```typescript
   test('should fetch subjects from correct endpoint', async () => {
     const subjects = await attendanceApi.subjectList();
     expect(Array.isArray(subjects)).toBe(true);
     // Will fail with 404 on unfixed code
   });
   ```

3. **QR Scan Payload Test** (will fail on unfixed code):
   ```typescript
   test('should send correct QR scan payload', async () => {
     const response = await attendanceApi.qrScan('12345', 'teacher');
     expect(response.success).toBe(true);
     // Will fail with validation error on unfixed code
   });
   ```

4. **HTTP Method Test** (will fail on unfixed code):
   ```typescript
   test('should use PUT method for settings update', async () => {
     const response = await attendanceApi.settingsUpdate({ 
       absensi_guru_aktif: true 
     });
     expect(response).toBeDefined();
     // Will fail with 405 on unfixed code
   });
   ```

5. **Data Parsing Test** (will fail on unfixed code):
   ```typescript
   test('should correctly parse nested logs data', () => {
     const mockResponse = {
       logs: [
         { student_id: 1, status: 'Hadir' },
         { student_id: 2, status: 'Sakit' }
       ]
     };
     
     // Simulate unfixed parsing logic
     const statuses: Record<number, string> = {};
     // This will fail because r.student_id is undefined
     expect(mockResponse.student_id).toBeUndefined();
   });
   ```

6. **Navigation Menu Test** (will fail on unfixed code):
   ```typescript
   test('should display attendance menu for operator role', () => {
     const { getByText } = render(<AppShell><div /></AppShell>);
     // Will fail because menu items don't exist
     expect(() => getByText('Absensi Guru')).toThrow();
   });
   ```

7. **Geolocation Tracking Test** (will fail on unfixed code):
   ```typescript
   test('should capture GPS coordinates when recording attendance', async () => {
     // Mock geolocation
     const mockGeolocation = {
       getCurrentPosition: jest.fn().mockImplementation((success) =>
         success({
           coords: {
             latitude: -7.123456,
             longitude: 109.123456,
             accuracy: 10
           }
         })
       )
     };
     global.navigator.geolocation = mockGeolocation;

     const response = await attendanceApi.teacherStore({
       teacher_id: 1,
       tanggal: '2024-01-15',
       status: 'Hadir',
       latitude: -7.123456,
       longitude: 109.123456
     });
     
     // Will fail because backend doesn't accept latitude/longitude
     expect(response.latitude).toBeDefined();
   });
   ```

**Expected Counterexamples**:
- 404 errors for mismatched endpoints
- 405 errors for wrong HTTP methods
- Validation errors for incorrect payload structures
- Undefined values for incorrect data parsing
- Missing UI elements for navigation

### Fix Checking

**Goal**: Verify that for all inputs where bug condition holds, fixed code produces expected behavior.

**Pseudocode:**
```
FOR ALL apiCall WHERE isBugCondition(apiCall) DO
  result := executeApiCall_fixed(apiCall)
  ASSERT result.status IN [200, 201]
  ASSERT result.data IS NOT NULL
  ASSERT result.data matches expectedSchema
END FOR
```

**Test Cases**:

1. **Endpoint Fix Verification**:
   ```typescript
   test('fixed: student logs endpoint returns data', async () => {
     const response = await attendanceApi.studentLogIndex({ 
       class_id: 1, 
       subject_id: 1, 
       tanggal: '2024-01-15' 
     });
     expect(response.data).toBeDefined();
     expect(Array.isArray(response.data)).toBe(true);
   });
   ```

2. **Payload Fix Verification**:
   ```typescript
   test('fixed: QR scan with correct payload succeeds', async () => {
     const response = await attendanceApi.qrScan('12345', 'teacher');
     expect(response.success).toBe(true);
     expect(response.teacher).toBeDefined();
   });
   ```

3. **Data Parsing Fix Verification**:
   ```typescript
   test('fixed: correctly parses nested logs data', () => {
     const mockResponse = {
       logs: [
         { student_id: 1, status: 'Hadir' },
         { student_id: 2, status: 'Sakit' }
       ]
     };
     
     const statuses: Record<number, string> = {};
     mockResponse.logs.forEach((log: any) => {
       statuses[log.student_id] = log.status;
     });
     
     expect(statuses[1]).toBe('Hadir');
     expect(statuses[2]).toBe('Sakit');
   });
   ```

4. **Navigation Fix Verification**:
   ```typescript
   test('fixed: attendance menu visible for operator', () => {
     localStorage.setItem('user_data', JSON.stringify({ 
       role: 'operator', 
       name: 'Test User' 
     }));
     
     const { getByText } = render(<AppShell><div /></AppShell>);
     expect(getByText('Absensi Guru')).toBeInTheDocument();
     expect(getByText('Scanner QR')).toBeInTheDocument();
   });
   ```

### Preservation Checking

**Goal**: Verify that for all inputs where bug condition does NOT hold (working features), fixed code produces same result as original.

**Pseudocode:**
```
FOR ALL apiCall WHERE NOT isBugCondition(apiCall) DO
  ASSERT executeApiCall_original(apiCall) = executeApiCall_fixed(apiCall)
END FOR
```

**Testing Approach**: Property-based testing recommended because:
- Generates many test cases automatically across input domain
- Catches edge cases that manual tests might miss
- Provides strong guarantees that working features remain unchanged

**Test Plan**: Test all working endpoints to ensure they still function correctly after fixes.

**Test Cases**:

1. **Teacher Attendance Preservation**:
   ```typescript
   test('preserved: teacher attendance endpoints still work', async () => {
     // GET teacher attendance
     const list = await attendanceApi.teacherIndex({ tanggal: '2024-01-15' });
     expect(list.data).toBeDefined();
     
     // POST teacher attendance
     const created = await attendanceApi.teacherStore({
       teacher_id: 1,
       tanggal: '2024-01-15',
       status: 'Hadir',
       jam_masuk: '07:00'
     });
     expect(created.id).toBeDefined();
   });
   ```

2. **Student Report Preservation**:
   ```typescript
   test('preserved: student report endpoint still works', async () => {
     const report = await attendanceApi.studentReport({
       class_id: 1,
       subject_id: 1,
       bulan: '2024-01'
     });
     expect(report.students).toBeDefined();
     expect(report.matrix).toBeDefined();
   });
   ```

3. **Settings Show Preservation**:
   ```typescript
   test('preserved: settings show endpoint still works', async () => {
     const settings = await attendanceApi.settingsShow();
     expect(settings.school_id).toBeDefined();
     expect(typeof settings.absensi_guru_aktif).toBe('boolean');
   });
   ```

4. **Tenant Scoping Preservation**:
   ```typescript
   test('preserved: tenant scoping still enforced', async () => {
     // Login as operator from school 1
     localStorage.setItem('user_data', JSON.stringify({ 
       role: 'operator', 
       school_id: 1 
     }));
     
     const subjects = await attendanceApi.subjectList();
     
     // All subjects should belong to school 1
     subjects.forEach((subject: any) => {
       expect(subject.school_id).toBe(1);
     });
   });
   ```

5. **Authentication Preservation**:
   ```typescript
   test('preserved: unauthenticated requests still fail', async () => {
     // Remove auth token
     localStorage.removeItem('auth_token');
     
     await expect(attendanceApi.teacherIndex()).rejects.toThrow();
   });
   ```

6. **Validation Preservation**:
   ```typescript
   test('preserved: validation errors still returned', async () => {
     await expect(
       attendanceApi.teacherStore({
         // Missing required fields
         tanggal: '2024-01-15'
       })
     ).rejects.toThrow();
   });
   ```

### Unit Tests

- Test individual API method signatures in `src/lib/api.ts`
- Test data parsing logic in `StudentAttendancePage.tsx`
- Test QR scan payload construction in `QrScannerPage.tsx`
- Test navigation menu rendering in `AppShell.tsx`
- Test PIN validation logic (if backend endpoint added)

### Property-Based Tests

- Generate random valid attendance data and verify CRUD operations work
- Generate random school_ids and verify tenant scoping is enforced
- Generate random invalid payloads and verify validation errors are returned
- Generate random user roles and verify menu visibility is correct

### Integration Tests

- Test full attendance workflow: create class → create subject → record attendance → view report
- Test QR scanner flow: enter PIN → select mode → scan QR → verify attendance recorded
- Test navigation flow: login as operator → see attendance menu → navigate to pages
- Test multi-tenant isolation: create data as operator from school 1 → verify not visible to school 2

### E2E Tests (Playwright)

```typescript
test('E2E: operator can record student attendance', async ({ page }) => {
  // Login as operator
  await page.goto('/login');
  await page.fill('[name="email"]', 'operator@school1.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  // Navigate to student attendance
  await page.click('text=Absensi');
  await page.click('text=Absensi Siswa');
  
  // Select filters
  await page.selectOption('[name="class_id"]', '1');
  await page.selectOption('[name="subject_id"]', '1');
  
  // Mark attendance
  await page.click('text=Hadir'); // First student
  await page.click('button:has-text("Simpan Absensi")');
  
  // Verify success
  await expect(page.locator('text=berhasil disimpan')).toBeVisible();
});
```

