# Implementation Tasks: Absensi Rapat Yayasan dengan QR Code

## Task 1: Database Migrations dan Eloquent Models

Buat foundation database untuk fitur meeting attendance dengan 4 tabel baru dan 3 Eloquent models.

**Requirements:** Req 1, 4, 5, 6, 7, 25, 26, 27, 28, 29

### Sub-tasks

- [x] Buat migration `create_meetings_table.php`
- [x] Buat migration `create_meeting_participants_table.php`
- [x] Buat migration `create_meeting_attendances_table.php`
- [x] Buat migration `create_meeting_schools_table.php`
- [x] Buat Eloquent model `Meeting`
- [x] Buat Eloquent model `MeetingParticipant`
- [x] Buat Eloquent model `MeetingAttendance`

---

## Task 2: Repository Layer

Implementasi repository pattern untuk meeting, participants, dan attendances.

**Requirements:** Design section 3
**Dependencies:** Task 1

### Sub-tasks

- [x] Buat interface `MeetingRepositoryInterface`
- [x] Buat implementasi `MeetingRepository`
- [x] Buat interface `MeetingParticipantRepositoryInterface`
- [x] Buat implementasi `MeetingParticipantRepository`
- [x] Buat interface `MeetingAttendanceRepositoryInterface`
- [x] Buat implementasi `MeetingAttendanceRepository`
- [x] Daftarkan binding di `AppServiceProvider`

---

## Task 3: Core Services — QR Generation dan Check-In Security

Implementasi QR code generation dan check-in validation dengan security layers.

**Requirements:** Req 4, 6, 25, 26, 27, 28, 29
**Dependencies:** Task 1, Task 2

### Sub-tasks

- [x] Install library `jenssegers/agent`
- [x] Buat custom exceptions
- [x] Buat `MeetingQrService`
- [x] Buat `MeetingCheckInService`
- [x] Buat `MeetingReportService`

---

## Task 4: Property-Based Tests untuk Core Services

Implementasi property-based tests untuk validasi correctness properties.

**Requirements:** Design section 9
**Dependencies:** Task 3

### Sub-tasks

- [x] Install library `eris/eris`
- [x] Buat `MeetingQrServiceTest`
- [x] Buat `MeetingCheckInServiceTest`

---

## Task 5: MeetingService dan Form Requests

Implementasi business logic service dan form validation.

**Requirements:** Req 1, 8, 9, 10, 11, 15, 16, 17, 30, 31
**Dependencies:** Task 2, Task 3

### Sub-tasks

- [x] Buat `StoreMeetingRequest`
- [x] Buat `UpdateMeetingRequest`
- [x] Buat `CheckInRequest`
- [x] Buat `WalkInCheckInRequest`
- [x] Buat `MeetingService`

---

## Task 6: SendMeetingReminderJob

Implementasi queued job untuk mengirim reminder WA.

**Requirements:** Req 9
**Dependencies:** Task 5

### Sub-tasks

- [x] Buat `SendMeetingReminderJob`

---

## Task 7: Controllers dan Routes Backend

Implementasi REST API endpoints untuk meeting management dan check-in.

**Requirements:** Req 1-31, Design section 3
**Dependencies:** Task 5, Task 6

### Sub-tasks

- [x] Buat `MeetingController`
- [x] Buat `MeetingCheckInController`
- [x] Buat `MeetingReportController`
- [x] Daftarkan routes di `routes/api.php`

---

## Task 8: Integration Tests Backend

Implementasi integration tests untuk backend endpoints.

**Requirements:** Design section 11
**Dependencies:** Task 7

### Sub-tasks

- [x] Buat `MeetingControllerTest`
- [x] Buat `MeetingCheckInControllerTest`
- [x] Buat `MeetingReportControllerTest`
- [x] Buat `SendMeetingReminderJobTest`

---

## Task 9: Frontend — Types, Services, dan Hooks

Implementasi TypeScript types, API services, dan React hooks.

**Requirements:** Design section 5
**Dependencies:** Task 7

### Sub-tasks

- [x] Buat `src/features/meetings/types/meeting.types.ts`
- [x] Buat `src/features/meetings/services/meetingService.ts`
- [x] Buat `src/features/meetings/hooks/useMeetings.ts`
- [x] Buat `src/features/meetings/hooks/useMeeting.ts`
- [x] Buat `src/features/meetings/hooks/useMeetingAttendance.ts`

---

## Task 10: Frontend — Pages dan Components

Implementasi UI pages dan components untuk meeting management.

**Requirements:** Design section 6, 7
**Dependencies:** Task 9

### Sub-tasks

- [x] Buat `MeetingListPage`
- [x] Buat `MeetingDetailPage`
- [x] Buat `MeetingFormPage`
- [x] Buat `MeetingCheckInPage`
- [x] Buat `MeetingReportPage`
- [x] Buat components: `MeetingForm`, `ParticipantTable`, `AttendanceStats`, `QrScanner`

---

## Task 11: Frontend — Public Check-In Flow

Implementasi public check-in page dengan QR scanning.

**Requirements:** Design section 8
**Dependencies:** Task 9

### Sub-tasks

- [x] Buat `PublicCheckInPage`
- [x] Buat `QrScannerComponent`
- [x] Buat `CheckInFormComponent`
- [x] Buat `CheckInSuccessComponent`

---

## Task 12: Frontend — Integration Tests

Implementasi integration tests untuk frontend.

**Requirements:** Design section 12
**Dependencies:** Task 10, Task 11

### Sub-tasks

- [x] Buat tests untuk meeting list page
- [x] Buat tests untuk meeting form page
- [x] Buat tests untuk check-in flow
- [x] Buat tests untuk report download

---

## Task 13: E2E Tests

Implementasi end-to-end tests dengan Playwright.

**Requirements:** Design section 13
**Dependencies:** Task 12

### Sub-tasks

- [x] Buat E2E test untuk create meeting flow
- [x] Buat E2E test untuk check-in flow
- [x] Buat E2E test untuk report generation

---

## Task 14: Documentation dan Deployment

Dokumentasi API dan deployment checklist.

**Requirements:** Design section 14
**Dependencies:** Task 13

### Sub-tasks

- [x] Buat API documentation
- [x] Buat deployment checklist
- [x] Buat user guide untuk admin

---

## Task 15: Database Migrations untuk Notulensi dan Foto

Buat migration untuk tabel `meeting_minutes` dan `meeting_photos`.

**Requirements:** Req 33, 34, 35

### Sub-tasks

- [x] Buat migration `create_meeting_minutes_table.php`
- [x] Buat migration `create_meeting_photos_table.php`
- [x] Buat Eloquent model `MeetingMinutes`
- [x] Buat Eloquent model `MeetingPhoto`

---

## Task 16: Services untuk Notulensi dan Foto

Implementasi service layer untuk notulensi dan foto kegiatan.

**Requirements:** Req 33, 34, 35
**Dependencies:** Task 15

### Sub-tasks

- [x] Buat `MeetingMinutesService`
- [x] Buat `MeetingPhotoService`
- [x] Install library `intervention/image` untuk thumbnail generation
- [x] Install library `html-purifier` untuk sanitasi HTML notulensi

---

## Task 17: Form Requests untuk Notulensi dan Foto

Implementasi form validation untuk notulensi dan foto.

**Requirements:** Req 33, 34
**Dependencies:** Task 15

### Sub-tasks

- [x] Buat `StoreMinutesRequest`
- [x] Buat `UpdateMinutesRequest`
- [x] Buat `UploadPhotosRequest`

---

## Task 18: Controllers untuk Notulensi dan Foto

Implementasi REST API endpoints untuk notulensi dan foto.

**Requirements:** Req 33, 34, 35
**Dependencies:** Task 16, Task 17

### Sub-tasks

- [x] Buat `MeetingMinutesController`
- [x] Buat `MeetingPhotoController`
- [x] Daftarkan routes di `routes/api.php`

---

## Task 19: Frontend Types, Services, dan Hooks untuk Notulensi dan Foto

Implementasi TypeScript types, API services, dan React hooks.

**Requirements:** Design section 5
**Dependencies:** Task 18

### Sub-tasks

- [x] Update `src/features/meetings/types/meeting.types.ts` dengan types untuk notulensi dan foto
- [x] Buat `src/features/meetings/services/meetingMinutesService.ts`
- [x] Buat `src/features/meetings/services/meetingPhotoService.ts`
- [x] Buat `src/features/meetings/hooks/useMeetingMinutes.ts`
- [x] Buat `src/features/meetings/hooks/useMeetingPhotos.ts`

---

## Task 20: Frontend Components untuk Notulensi

Implementasi UI components untuk notulensi rapat.

**Requirements:** Req 33, 35
**Dependencies:** Task 19

### Sub-tasks

- [x] Install library `@tiptap/react` untuk rich text editor
- [x] Buat `MeetingMinutesEditor.tsx`
- [x] Buat `MeetingMinutesView.tsx`
- [x] Buat tab Notulensi di `MeetingDetailPage.tsx`

---

## Task 21: Frontend Components untuk Foto Kegiatan

Implementasi UI components untuk foto kegiatan.

**Requirements:** Req 34, 35
**Dependencies:** Task 19

### Sub-tasks

- [x] Install library `yet-another-react-lightbox` untuk lightbox
- [x] Buat `MeetingPhotoGallery.tsx`
- [x] Buat `MeetingPhotoUploader.tsx`
- [x] Buat tab Foto Kegiatan di `MeetingDetailPage.tsx`

---

## Task 22: Update Laporan PDF untuk Notulensi dan Foto

Update `MeetingReportService` untuk include notulensi dan foto di laporan PDF.

**Requirements:** Req 35
**Dependencies:** Task 16, Task 18

### Sub-tasks

- [x] Update `MeetingReportService::generatePdf()` untuk tambah halaman notulensi
- [x] Update `MeetingReportService::generatePdf()` untuk tambah halaman foto
- [x] Buat method `addMinutesPage()` untuk render notulensi di PDF
- [x] Buat method `addPhotosPage()` untuk render foto di PDF

---

## Task 23: Integration Tests untuk Notulensi dan Foto

Implementasi integration tests untuk backend endpoints notulensi dan foto.

**Requirements:** Design section 11
**Dependencies:** Task 18

### Sub-tasks

- [x] Buat `MeetingMinutesControllerTest`
- [x] Buat `MeetingPhotoControllerTest`
- [x] Test upload foto dengan validasi format dan ukuran
- [x] Test download semua foto sebagai ZIP

---

## Task 24: Frontend Integration Tests untuk Notulensi dan Foto

Implementasi integration tests untuk frontend.

**Requirements:** Design section 12
**Dependencies:** Task 20, Task 21

### Sub-tasks

- [x] Buat tests untuk notulensi editor
- [x] Buat tests untuk foto gallery
- [x] Buat tests untuk upload foto
- [x] Buat tests untuk delete foto

---

## Task 25: E2E Tests untuk Notulensi dan Foto

Implementasi end-to-end tests dengan Playwright.

**Requirements:** Design section 13
**Dependencies:** Task 24

### Sub-tasks

- [x] Buat E2E test untuk create dan edit notulensi
- [x] Buat E2E test untuk upload dan delete foto
- [x] Buat E2E test untuk download laporan PDF dengan notulensi dan foto
