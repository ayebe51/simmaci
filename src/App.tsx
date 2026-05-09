import { lazy, Suspense } from "react"
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { GlobalErrorBoundary } from "./components/common/GlobalErrorBoundary"
import { PageTransition } from "./components/common/PageTransition"
import { usePwaUpdate } from "./hooks/usePwaUpdate"
import AppShell from "./components/layout/AppShell"
import ProtectedLayout from "./components/layout/ProtectedLayout"

// ── Auth ──────────────────────────────────────────────────────────────────────
const LoginPage = lazy(() => import("./features/auth/LoginPage"))
const ChangePasswordPage = lazy(() => import("./features/auth/ChangePasswordPage"))

// ── Dashboard ─────────────────────────────────────────────────────────────────
const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage"))

// ── SK Management ─────────────────────────────────────────────────────────────
const SkDashboardPage = lazy(() => import("./features/sk-management/SkDashboardPage"))
const SkSubmissionPage = lazy(() => import("./features/sk-management/SkSubmissionPage"))
const MySkPage = lazy(() => import("./features/sk-management/MySkPage"))
const SkDetailPage = lazy(() => import("./features/sk-management/SkDetailPage"))
const SkRevisionPage = lazy(() => import("./features/sk-management/SkRevisionPage"))
const SkRevisionListPage = lazy(() => import("./features/sk-management/SkRevisionListPage"))
const HeadmasterSubmissionPage = lazy(() => import("./features/sk-management/HeadmasterSubmissionPage"))
const SkGeneratorPage = lazy(() => import("./features/sk-management/SkGeneratorPage"))
const SkPrintPage = lazy(() => import("./features/sk-management/SkPrintPage"))
const SkTemplateManagementPage = lazy(() => import("./features/sk-management/SkTemplateManagementPage"))

// ── Master Data ───────────────────────────────────────────────────────────────
const SchoolListPage = lazy(() => import("./features/master-data/SchoolListPage"))
const SchoolDetailPage = lazy(() => import("./features/master-data/SchoolDetailPage"))
const TeacherListPage = lazy(() => import("./features/master-data/TeacherListPage"))
const StudentListPage = lazy(() => import("./features/master-data/StudentListPage"))
const DataAuditPage = lazy(() => import("@/features/master-data/DataAuditPage"))

// ── Users ─────────────────────────────────────────────────────────────────────
const UserListPage = lazy(() => import("./features/users/UserListPage"))

// ── Schools ───────────────────────────────────────────────────────────────────
const SchoolProfilePage = lazy(() => import("./features/schools/SchoolProfilePage"))
const AdminSchoolManagementPage = lazy(() => import("./features/schools/AdminSchoolManagementPage"))

// ── Settings & Monitoring ─────────────────────────────────────────────────────
const SettingsPage = lazy(() => import("./features/settings/SettingsPage"))
const HeadmasterExpiryPage = lazy(() => import("./features/monitoring/HeadmasterExpiryPage"))

// ── Reports ───────────────────────────────────────────────────────────────────
const ReportPage = lazy(() => import("./features/reports/ReportPage"))
const SkReportPageSimple = lazy(() => import("./features/reports/SkReportPageSimple"))
const SkReportGroupedPage = lazy(() => import("./features/reports/SkReportGroupedPage"))

// ── KTA ───────────────────────────────────────────────────────────────────────
const KtaGeneratorPage = lazy(() => import("./features/kta/KtaGeneratorPage"))
const StudentCardPage = lazy(() => import("./features/kta/StudentCardPage"))

// ── Events ────────────────────────────────────────────────────────────────────
const EventsPage = lazy(() => import("./features/events/EventsPage"))
const CreateEventPage = lazy(() => import("./features/events/CreateEventPage"))
const EventDetailPage = lazy(() => import("./features/events/EventDetailPage"))
const CompetitionDetailPage = lazy(() => import("./features/events/CompetitionDetailPage"))

// ── Approval ──────────────────────────────────────────────────────────────────
const YayasanApprovalPage = lazy(() => import("./features/approval/YayasanApprovalPage"))

// ── Verification (public) ─────────────────────────────────────────────────────
const PublicVerificationPage = lazy(() => import("./features/verification/PublicVerificationPage"))
const VerifyTeacherPage = lazy(() => import("./features/verification/VerifyTeacherPage"))
const VerifyStudentPage = lazy(() => import("./features/verification/VerifyStudentPage"))
const VerifySkPage = lazy(() => import("./features/verification/VerifySkPage"))

// ── SDM / NUPTK ───────────────────────────────────────────────────────────────
const PengajuanNuptkPage = lazy(() => import("./features/sdm/PengajuanNuptkPage").then(m => ({ default: m.PengajuanNuptkPage })))
const PersetujuanNuptkPage = lazy(() => import("./features/sdm/PersetujuanNuptkPage").then(m => ({ default: m.PersetujuanNuptkPage })))

// ── Mutations ─────────────────────────────────────────────────────────────────
const MutationPage = lazy(() => import("./features/mutations/MutationPage"))

// ── Attendance ────────────────────────────────────────────────────────────────
const QrScannerPage = lazy(() => import("./features/attendance/QrScannerPage"))
const TeacherAttendancePage = lazy(() => import("./features/attendance/TeacherAttendancePage"))
const StudentAttendancePage = lazy(() => import("./features/attendance/StudentAttendancePage"))
const StudentAttendanceReportPage = lazy(() => import("./features/attendance/StudentAttendanceReportPage"))
const SubjectsPage = lazy(() => import("./features/attendance/SubjectsPage"))
const ClassesPage = lazy(() => import("./features/attendance/ClassesPage"))
const LessonSchedulePage = lazy(() => import("./features/attendance/LessonSchedulePage"))
const AttendanceSettingsPage = lazy(() => import("./features/attendance/AttendanceSettingsPage"))
const PublicScannerPage = lazy(() => import("./features/attendance/PublicScannerPage"))

// ── Meetings ──────────────────────────────────────────────────────────────────
const MeetingListPage = lazy(() => import("./features/meetings/pages/MeetingListPage"))
const MeetingCreatePage = lazy(() => import("./features/meetings/pages/MeetingCreatePage"))
const MeetingDetailPage = lazy(() => import("./features/meetings/MeetingDetailPage").then(m => ({ default: m.MeetingDetailPage })))
const MeetingCheckInPage = lazy(() => import("./features/meetings/pages/MeetingCheckInPage"))

// ── WA Blast ──────────────────────────────────────────────────────────────────
const WaBlastListPage = lazy(() => import("./features/wa-blast/WaBlastListPage"))
const WaBlastCreatePage = lazy(() => import("./features/wa-blast/WaBlastCreatePage"))
const WaBlastDetailPage = lazy(() => import("./features/wa-blast/WaBlastDetailPage"))
const WaBlastTemplatePage = lazy(() => import("./features/wa-blast/WaBlastTemplatePage"))
const WaBlastConfigPage = lazy(() => import("./features/wa-blast/pages/WaBlastConfigPage").then(m => ({ default: m.WaBlastConfigPage })))

// ── QueryClient ───────────────────────────────────────────────────────────────
const queryClient = new QueryClient()

// Keepalive ping — prevents Traefik from dropping idle connections to backend
// Pings /health every 4 minutes so the connection never goes fully idle
if (typeof window !== 'undefined') {
  const PING_INTERVAL = 4 * 60 * 1000 // 4 minutes
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace('/api', '')
  setInterval(() => {
    fetch(`${API_BASE}/health`, { method: 'GET', cache: 'no-store' }).catch(() => {})
  }, PING_INTERVAL)
}

// Shared loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )
}

export default function App() {
  console.log("App Rendering...");
  usePwaUpdate()
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/test-render" element={<div className="p-10 bg-red-500 text-white">TEST ROUTE WORKING</div>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify/:id" element={<PublicVerificationPage />} />
            <Route path="/verify/sk/:nomor" element={<VerifySkPage />} />
            <Route path="/verify/teacher/:nuptk" element={<VerifyTeacherPage />} />
            <Route path="/verify/student/:nisn" element={<VerifyStudentPage />} />

            {/* Public Attendance Scanner — accessible without login */}
            <Route path="/scan" element={<PublicScannerPage />} />

            {/* Public Meeting Check-In — accessible without login (signed URL protected) */}
            <Route path="/meetings/:id/check-in" element={<MeetingCheckInPage />} />

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
                          <Route path="master/teachers" element={<TeacherListPage />} />
                          <Route path="users" element={<UserListPage />} />
                          <Route path="school/profile" element={<SchoolProfilePage />} />
                          <Route path="admin/schools" element={<AdminSchoolManagementPage />} />
                          <Route path="sk" element={<SkDashboardPage />} />
                          <Route path="sk/new" element={<SkSubmissionPage />} />
                          <Route path="sk/headmaster/new" element={<HeadmasterSubmissionPage />} />
                          <Route path="sk-saya" element={<MySkPage />} />
                          <Route path="sk/:id" element={<SkDetailPage />} />
                          <Route path="sk/:id/revision" element={<SkRevisionPage />} />
                          <Route path="sk-revisions" element={<SkRevisionListPage />} />
                          <Route path="generator" element={<SkGeneratorPage />} />
                          <Route path="audit" element={<DataAuditPage />} />
                          <Route path="settings" element={<SettingsPage />} />
                          <Route path="sk-templates" element={<SkTemplateManagementPage />} />
                          <Route path="change-password" element={<ChangePasswordPage />} />
                          <Route path="monitoring/headmasters" element={<HeadmasterExpiryPage />} />
                          <Route path="reports/sk" element={
                            <ErrorBoundary fallback={<div className="p-6 text-center text-red-500">Failed to load SK Report. data error.</div>}>
                              <SkReportPageSimple />
                            </ErrorBoundary>
                          } />
                          <Route path="reports/sk-grouped" element={
                            <ErrorBoundary fallback={<div className="p-6 text-center text-red-500">Failed to load SK Report. data error.</div>}>
                              <SkReportGroupedPage />
                            </ErrorBoundary>
                          } />
                          <Route path="reports" element={<ReportPage />} />
                          <Route path="kta" element={<KtaGeneratorPage />} />
                          <Route path="student-card" element={<StudentCardPage />} />
                          <Route path="events" element={<EventsPage />} />
                          <Route path="events/new" element={<CreateEventPage />} />
                          <Route path="events/:id" element={<EventDetailPage />} />
                          <Route path="competitions/:competitionId" element={<CompetitionDetailPage />} />
                          <Route path="sk/:id/print" element={<SkPrintPage />} />
                          <Route path="approval/yayasan" element={<YayasanApprovalPage />} />
                          <Route path="sdm/nuptk/pengajuan" element={<PengajuanNuptkPage />} />
                          <Route path="sdm/nuptk/persetujuan" element={<PersetujuanNuptkPage />} />

                          <Route path="mutations" element={<MutationPage />} />

                          {/* Attendance Module */}
                          <Route path="attendance/teacher" element={<TeacherAttendancePage />} />
                          <Route path="attendance/student" element={<StudentAttendancePage />} />
                          <Route path="attendance/report" element={<StudentAttendanceReportPage />} />
                          <Route path="attendance/subjects" element={<SubjectsPage />} />
                          <Route path="attendance/classes" element={<ClassesPage />} />
                          <Route path="attendance/schedule" element={<LessonSchedulePage />} />
                          <Route path="attendance/settings" element={<AttendanceSettingsPage />} />

                          {/* WA Blast Module */}
                          <Route path="wa-blast" element={<WaBlastListPage />} />
                          <Route path="wa-blast/create" element={<WaBlastCreatePage />} />
                          <Route path="wa-blast/:id" element={<WaBlastDetailPage />} />
                          <Route path="wa-blast/templates" element={<WaBlastTemplatePage />} />
                          <Route path="wa-blast/config" element={<WaBlastConfigPage />} />

                          {/* Meeting Module */}
                          <Route path="meetings" element={<MeetingListPage />} />
                          <Route path="meetings/create" element={<MeetingCreatePage />} />
                          <Route path="meetings/:id" element={<MeetingDetailPage />} />
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
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
