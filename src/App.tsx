import { Suspense } from "react"
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MAINTENANCE_MODE, API_URL } from "@/lib/api"
import { Toaster } from "@/components/ui/sonner"
import { lazyWithRetry } from "./utils/lazyWithRetry"
import { NetworkStatusBanner } from "./components/common/NetworkStatusBanner"
import { GlobalErrorBoundary } from "./components/common/GlobalErrorBoundary"
import { ChunkErrorBoundary } from "./components/common/ChunkErrorBoundary"
import { PageTransition } from "./components/common/PageTransition"
import { usePwaUpdate } from "./hooks/usePwaUpdate"
import SkeletonPage from "./components/common/SkeletonPage"
import AppShell from "./components/layout/AppShell"
import ProtectedLayout from "./components/layout/ProtectedLayout"

// ── Auth ──────────────────────────────────────────────────────────────────────
const LoginPage = lazyWithRetry(() => import("./features/auth/LoginPage"))
const ChangePasswordPage = lazyWithRetry(() => import("./features/auth/ChangePasswordPage"))

// ── Dashboard ─────────────────────────────────────────────────────────────────
const DashboardPage = lazyWithRetry(() => import("./features/dashboard/DashboardPage"))

// ── SK Management ─────────────────────────────────────────────────────────────
const SkDashboardPage = lazyWithRetry(() => import("./features/sk-management/SkDashboardPage"))
const SkSubmissionPage = lazyWithRetry(() => import("./features/sk-management/SkSubmissionPage"))
const MySkPage = lazyWithRetry(() => import("./features/sk-management/MySkPage"))
const SkDetailPage = lazyWithRetry(() => import("./features/sk-management/SkDetailPage"))
const SkRevisionPage = lazyWithRetry(() => import("./features/sk-management/SkRevisionPage"))
const SkRevisionListPage = lazyWithRetry(() => import("./features/sk-management/SkRevisionListPage"))
const HeadmasterSubmissionPage = lazyWithRetry(() => import("./features/sk-management/HeadmasterSubmissionPage"))
const SkGeneratorPage = lazyWithRetry(() => import("./features/sk-management/SkGeneratorPage"))
const SkPrintPage = lazyWithRetry(() => import("./features/sk-management/SkPrintPage"))
const SkTemplateManagementPage = lazyWithRetry(() => import("./features/sk-management/SkTemplateManagementPage"))

// ── Master Data ───────────────────────────────────────────────────────────────
const SchoolListPage = lazyWithRetry(() => import("./features/master-data/SchoolListPage"))
const SchoolDetailPage = lazyWithRetry(() => import("./features/master-data/SchoolDetailPage"))
const TeacherListPage = lazyWithRetry(() => import("./features/master-data/TeacherListPage"))
const StudentListPage = lazyWithRetry(() => import("./features/master-data/StudentListPage"))
const DataAuditPage = lazyWithRetry(() => import("@/features/master-data/DataAuditPage"))
const ActivityLogPage = lazyWithRetry(() => import("@/features/master-data/ActivityLogPage"))

// ── Student Statistics ────────────────────────────────────────────────────────
const StudentStatisticsPage = lazyWithRetry(() => import("./features/student-statistics/StudentStatisticsPage"))

// ── Users ─────────────────────────────────────────────────────────────────────
const UserListPage = lazyWithRetry(() => import("./features/users/UserListPage"))

// ── Schools ───────────────────────────────────────────────────────────────────
const SchoolProfilePage = lazyWithRetry(() => import("./features/schools/SchoolProfilePage"))

// ── Settings & Monitoring ─────────────────────────────────────────────────────
const SettingsPage = lazyWithRetry(() => import("./features/settings/SettingsPage"))
const HeadmasterExpiryPage = lazyWithRetry(() => import("./features/monitoring/HeadmasterExpiryPage"))

// ── Reports ───────────────────────────────────────────────────────────────────
const ReportPage = lazyWithRetry(() => import("./features/reports/ReportPage"))
const SkReportPageSimple = lazyWithRetry(() => import("./features/reports/SkReportPageSimple"))
const SkReportGroupedPage = lazyWithRetry(() => import("./features/reports/SkReportGroupedPage"))

// ── KTA ───────────────────────────────────────────────────────────────────────
const KtaGeneratorPage = lazyWithRetry(() => import("./features/kta/KtaGeneratorPage"))
const StudentCardPage = lazyWithRetry(() => import("./features/kta/StudentCardPage"))

// ── Events ────────────────────────────────────────────────────────────────────
const EventsPage = lazyWithRetry(() => import("./features/events/EventsPage"))
const CreateEventPage = lazyWithRetry(() => import("./features/events/CreateEventPage"))
const EventDetailPage = lazyWithRetry(() => import("./features/events/EventDetailPage"))
const CompetitionDetailPage = lazyWithRetry(() => import("./features/events/CompetitionDetailPage"))
const AnugerahRegistrationPage = lazyWithRetry(() => import("./features/events/AnugerahRegistrationPage"))
const PublicEventRegistrationPage = lazyWithRetry(() => import("./features/events/public/PublicEventRegistrationPage"))
const JuryScoringPage = lazyWithRetry(() => import("./features/events/public/JuryScoringPage"))
const PublicScoreboardPage = lazyWithRetry(() => import("./features/events/public/PublicScoreboardPage"))

// ── Approval ──────────────────────────────────────────────────────────────────
const YayasanApprovalPage = lazyWithRetry(() => import("./features/approval/YayasanApprovalPage"))

// ── Verification (public) ─────────────────────────────────────────────────────
const PublicVerificationPage = lazyWithRetry(() => import("./features/verification/PublicVerificationPage"))
const VerifyTeacherPage = lazyWithRetry(() => import("./features/verification/VerifyTeacherPage"))
const VerifyStudentPage = lazyWithRetry(() => import("./features/verification/VerifyStudentPage"))
const VerifySkPage = lazyWithRetry(() => import("./features/verification/VerifySkPage"))

// ── SDM / NUPTK ───────────────────────────────────────────────────────────────
const PengajuanRekomendasiKepalaPage = lazyWithRetry(() => import("./features/sdm/PengajuanRekomendasiKepalaPage").then(m => ({ default: m.PengajuanRekomendasiKepalaPage })))
const HeadmasterRecommendationDetailPage = lazyWithRetry(() => import("./features/sdm/HeadmasterRecommendationDetailPage").then(m => ({ default: m.HeadmasterRecommendationDetailPage })))

// ── Attendance ────────────────────────────────────────────────────────────────
const TeacherAttendancePage = lazyWithRetry(() => import("./features/attendance/TeacherAttendancePage"))
const StudentAttendancePage = lazyWithRetry(() => import("./features/attendance/StudentAttendancePage"))
const StudentAttendanceReportPage = lazyWithRetry(() => import("./features/attendance/StudentAttendanceReportPage"))
const SubjectsPage = lazyWithRetry(() => import("./features/attendance/SubjectsPage"))
const ClassesPage = lazyWithRetry(() => import("./features/attendance/ClassesPage"))
const LessonSchedulePage = lazyWithRetry(() => import("./features/attendance/LessonSchedulePage"))
const AttendanceSettingsPage = lazyWithRetry(() => import("./features/attendance/AttendanceSettingsPage"))
const PublicScannerPage = lazyWithRetry(() => import("./features/attendance/PublicScannerPage"))

// ── Meetings ──────────────────────────────────────────────────────────────────
const MeetingListPage = lazyWithRetry(() => import("./features/meetings/pages/MeetingListPage"))
const MeetingCreatePage = lazyWithRetry(() => import("./features/meetings/pages/MeetingCreatePage"))
const MeetingEditPage = lazyWithRetry(() => import("./features/meetings/pages/MeetingEditPage"))
const MeetingDetailPage = lazyWithRetry(() => import("./features/meetings/MeetingDetailPage").then(m => ({ default: m.MeetingDetailPage })))
const MeetingCheckInPage = lazyWithRetry(() => import("./features/meetings/pages/MeetingCheckInPage"))
const MeetingWalkInPage = lazyWithRetry(() => import("./features/meetings/pages/MeetingWalkInPage"))

// ── Staff ──────────────────────────────────────────────────────────────────
const StaffPage = lazyWithRetry(() => import("./features/staff/StaffPage"))
const StaffAttendanceReportPage = lazyWithRetry(() => import("./features/staff/StaffAttendanceReportPage"))
const StaffAttendanceSettingsPage = lazyWithRetry(() => import("./features/staff/StaffAttendanceSettingsPage"))

// ── WA Blast ──────────────────────────────────────────────────────────────────
const WaBlastListPage = lazyWithRetry(() => import("./features/wa-blast/WaBlastListPage"))
const WaBlastCreatePage = lazyWithRetry(() => import("./features/wa-blast/WaBlastCreatePage"))
const WaBlastDetailPage = lazyWithRetry(() => import("./features/wa-blast/WaBlastDetailPage"))
const WaBlastTemplatePage = lazyWithRetry(() => import("./features/wa-blast/WaBlastTemplatePage"))
const WaBlastConfigPage = lazyWithRetry(() => import("./features/wa-blast/pages/WaBlastConfigPage").then(m => ({ default: m.WaBlastConfigPage })))

// ── Centralized Center Pages (Tab Wrappers) ──────────────────────────────────
const SkCenterPage = lazyWithRetry(() => import("./features/sk-management/SkCenterPage"))
const SkGeneratorCenterPage = lazyWithRetry(() => import("./features/sk-management/SkGeneratorCenterPage"))
const AttendanceCenterPage = lazyWithRetry(() => import("./features/attendance/AttendanceCenterPage"))
const AcademicConfigPage = lazyWithRetry(() => import("./features/attendance/AcademicConfigPage"))
const EventCenterPage = lazyWithRetry(() => import("./features/events/EventCenterPage"))
const WaCenterPage = lazyWithRetry(() => import("./features/wa-blast/WaCenterPage"))
const CardCenterPage = lazyWithRetry(() => import("./features/kta/CardCenterPage"))
const AuditCenterPage = lazyWithRetry(() => import("./features/master-data/AuditCenterPage"))
const StudentCenterPage = lazyWithRetry(() => import("./features/master-data/StudentCenterPage"))

// ── PPDB Online ───────────────────────────────────────────────────────────────
const PpdbLandingPage = lazyWithRetry(() => import("./features/ppdb/public/PpdbLandingPage"))
const PpdbRegistrationPage = lazyWithRetry(() => import("./features/ppdb/public/PpdbRegistrationPage"))
const PpdbStatusCheckPage = lazyWithRetry(() => import("./features/ppdb/public/PpdbStatusCheckPage"))
const PpdbCenterPage = lazyWithRetry(() => import("./features/ppdb/admin/PpdbCenterPage"))

// ── QueryClient ───────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,       // 2 minutes — serve from cache without excessive background refetches
      gcTime: 15 * 60 * 1000,         // 15 minutes — keep inactive data for smooth back/forward navigation
      refetchOnWindowFocus: false,    // Don't refetch on window focus (saves mobile data/bandwidth)
      refetchOnReconnect: true,       // Auto-refetch when network is restored
      retry: 3,                       // Retry 3 times on flaky/slow connections
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff (1s, 2s, 4s, 8s...)
      networkMode: 'offlineFirst',    // Try fetching and fallback gracefully to cache even if connection is unstable
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
})

// Keepalive warmup ping — keeps PHP-FPM workers and DB persistent connection warm
if (typeof window !== 'undefined') {
  const PING_INTERVAL = 4 * 60 * 1000 // 4 minutes
  setInterval(() => {
    fetch(`${API_URL}/warmup`, { method: 'GET', cache: 'no-store' }).catch(() => {})
  }, PING_INTERVAL)
}

export default function App() {
  usePwaUpdate()
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NetworkStatusBanner />
        {MAINTENANCE_MODE && (
          <div className="bg-red-600 text-white p-3 text-center font-bold sticky top-0 z-[9999] shadow-md flex items-center justify-center gap-2 animate-pulse">
            <span>🚧</span>
            <span>
              MODE PEMELIHARAAN (MAINTENANCE) SEDANG AKTIF. ANDA HANYA DAPAT MELIHAT DATA. SEMUA AKSI PENAMBAHAN, UBAH, DAN HAPUS DATA DIMATIKAN SEMENTARA.
            </span>
            <span>🚧</span>
          </div>
        )}
        <ChunkErrorBoundary>
        <Suspense fallback={<SkeletonPage />}>
          <Routes>

            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify/:id" element={<PublicVerificationPage />} />
            <Route path="/verify/sk/:nomor" element={<VerifySkPage />} />
            <Route path="/verify/teacher/:nim" element={<VerifyTeacherPage />} />
            <Route path="/verify/student/:nisn" element={<VerifyStudentPage />} />

            {/* Public Attendance Scanner — accessible without login */}
            <Route path="/scan" element={<PublicScannerPage />} />

            {/* Public Meeting Check-In — accessible without login (signed URL protected) */}
            <Route path="/meetings/:id/check-in" element={<MeetingCheckInPage />} />

            {/* Public Meeting Walk-In — self-service check-in via QR Umum */}
            <Route path="/meetings/:id/walk-in" element={<MeetingWalkInPage />} />

            {/* Public Event Registration — no login required */}
            <Route path="/daftar/:eventId" element={<PublicEventRegistrationPage />} />

            {/* Jury Scoring Panel — PIN protected, no login required */}
            <Route path="/juri" element={<JuryScoringPage />} />

            {/* Public Scoreboard — no login required */}
            <Route path="/papan-skor/:eventId/:competitionId" element={<PublicScoreboardPage />} />

            {/* Public PPDB Portal — no login required */}
            <Route path="/ppdb" element={<PpdbLandingPage />} />
            <Route path="/ppdb/daftar" element={<PpdbRegistrationPage />} />
            <Route path="/ppdb/daftar/:schoolIdentifier" element={<PpdbRegistrationPage />} />
            <Route path="/ppdb/status" element={<PpdbStatusCheckPage />} />

            {/* Protected Routes Wrapper */}
            <Route
              path="/dashboard/*"
              element={
                <ProtectedLayout>
                  <AppShell>
                    <GlobalErrorBoundary>
                      <PageTransition>
                        <Routes>
                          <Route path="/" element={<DashboardPage />} />
                          <Route path="master/schools" element={<SchoolListPage />} />
                          <Route path="master/schools/:id" element={<SchoolDetailPage />} />
                          <Route path="master/students" element={<StudentListPage />} />
                          <Route path="student-statistics" element={<StudentStatisticsPage />} />
                          <Route path="master/teachers" element={<TeacherListPage />} />
                          <Route path="users" element={<UserListPage />} />
                          <Route path="school/profile" element={<SchoolProfilePage />} />
                          <Route path="sk" element={<SkDashboardPage />} />
                          <Route path="sk/new" element={<SkSubmissionPage />} />
                          <Route path="sk/headmaster/new" element={<Navigate to="/dashboard/sdm/sk-kepala/new" replace />} />
                          <Route path="sdm/sk-kepala/new" element={<HeadmasterSubmissionPage />} />
                          <Route path="sk-saya" element={<MySkPage />} />
                          <Route path="sk-arsip" element={<MySkPage />} />
                          <Route path="sk-center/submission" element={<SkSubmissionPage />} />
                          <Route path="sk-center/revisi" element={<SkRevisionListPage />} />
                          <Route path="sk/:id" element={<SkDetailPage />} />
                          <Route path="sk/:id/revision" element={<SkRevisionPage />} />
                          <Route path="sk-revisions" element={<SkRevisionListPage />} />
                          <Route path="generator" element={<SkGeneratorPage />} />
                          <Route path="audit" element={<DataAuditPage />} />
                          <Route path="activity-logs" element={<ActivityLogPage />} />
                          <Route path="settings" element={<SettingsPage />} />
                          <Route path="sk-templates" element={<SkTemplateManagementPage />} />
                          <Route path="change-password" element={<ChangePasswordPage />} />
                          <Route path="monitoring/headmasters" element={<HeadmasterExpiryPage />} />
                          <Route path="reports" element={<ReportPage />} />
                          <Route path="kta" element={<KtaGeneratorPage />} />
                          <Route path="student-card" element={<StudentCardPage />} />
                          <Route path="events" element={<EventsPage />} />
                          <Route path="events/new" element={<CreateEventPage />} />
                          <Route path="events/:id" element={<EventDetailPage />} />
                          <Route path="events/:eventId/anugerah/daftar" element={<AnugerahRegistrationPage />} />
                          <Route path="competitions/:competitionId" element={<CompetitionDetailPage />} />
                          <Route path="sk/:id/print" element={<SkPrintPage />} />
                          <Route path="approval/yayasan" element={<YayasanApprovalPage />} />
                          <Route path="sdm/rekomendasi-kepala/pengajuan" element={<PengajuanRekomendasiKepalaPage />} />
                          <Route path="sdm/rekomendasi-kepala/:id" element={<HeadmasterRecommendationDetailPage />} />


                          {/* Attendance Module */}
                          <Route path="attendance/teacher" element={<TeacherAttendancePage />} />
                          <Route path="attendance/student" element={<StudentAttendancePage />} />
                          <Route path="attendance/report" element={<StudentAttendanceReportPage />} />
                          <Route path="attendance/subjects" element={<SubjectsPage />} />
                          <Route path="attendance/classes" element={<ClassesPage />} />
                          <Route path="attendance/schedule" element={<LessonSchedulePage />} />
                          <Route path="attendance/settings" element={<AttendanceSettingsPage />} />
                          
                          {/* Staff Management */}
                          <Route path="staff" element={<StaffPage />} />
                          <Route path="staff/attendance-report" element={<StaffAttendanceReportPage />} />
                          <Route path="staff/attendance-settings" element={<StaffAttendanceSettingsPage />} />

                          {/* WA Blast Module */}
                          <Route path="wa-blast" element={<WaBlastListPage />} />
                          <Route path="wa-blast/create" element={<WaBlastCreatePage />} />
                          <Route path="wa-blast/templates" element={<WaBlastTemplatePage />} />
                          <Route path="wa-blast/config" element={<WaBlastConfigPage />} />
                          <Route path="wa-blast/:id" element={<WaBlastDetailPage />} />

                          {/* Meeting Module */}
                          <Route path="meetings" element={<MeetingListPage />} />
                          <Route path="meetings/create" element={<MeetingCreatePage />} />
                          <Route path="meetings/:id/edit" element={<MeetingEditPage />} />
                          <Route path="meetings/:id" element={<MeetingDetailPage />} />

                          {/* ── Centralized Tab Center Routes ── */}
                          <Route path="sk-center" element={<SkCenterPage />} />
                          <Route path="sk-generator-center" element={<SkGeneratorCenterPage />} />
                          <Route path="attendance-center" element={<AttendanceCenterPage />} />
                          <Route path="academic-config" element={<AcademicConfigPage />} />
                          <Route path="events-center" element={<EventCenterPage />} />
                          <Route path="wa-center" element={<WaCenterPage />} />
                          <Route path="cards-center" element={<CardCenterPage />} />
                          <Route path="audit-center" element={<AuditCenterPage />} />
                          <Route path="students-center" element={<StudentCenterPage />} />
                          <Route path="ppdb-center" element={<PpdbCenterPage />} />
                          <Route path="ppdb" element={<PpdbCenterPage />} />
                        </Routes>
                      </PageTransition>
                    </GlobalErrorBoundary>
                  </AppShell>
                </ProtectedLayout>
              }
            />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<div className="p-10 text-center">404 - Page Not Found (Catch-all)</div>} />
          </Routes>
        </Suspense>
        </ChunkErrorBoundary>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
