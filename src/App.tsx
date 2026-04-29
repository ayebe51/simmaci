import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom"
import LoginPage from "./features/auth/LoginPage"
import AppShell from "./components/layout/AppShell"
import DashboardPage from "./features/dashboard/DashboardPage"
import SkDashboardPage from "./features/sk-management/SkDashboardPage"
import SkSubmissionPage from "./features/sk-management/SkSubmissionPage"
import MySkPage from "./features/sk-management/MySkPage"
import SkDetailPage from "./features/sk-management/SkDetailPage"
import SkRevisionPage from "./features/sk-management/SkRevisionPage"
import SchoolListPage from "./features/master-data/SchoolListPage"
import SchoolDetailPage from "./features/master-data/SchoolDetailPage"
import TeacherListPage from "./features/master-data/TeacherListPage"
import StudentListPage from "./features/master-data/StudentListPage"
import UserListPage from "./features/users/UserListPage"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import SkGeneratorPage from "./features/sk-management/SkGeneratorPage"
import SkPrintPage from "./features/sk-management/SkPrintPage"
import SettingsPage from "./features/settings/SettingsPage"
import HeadmasterExpiryPage from "./features/monitoring/HeadmasterExpiryPage"
import ReportPage from "./features/reports/ReportPage"
import SkReportPageSimple from "./features/reports/SkReportPageSimple"
import SkReportGroupedPage from "./features/reports/SkReportGroupedPage"
import KtaGeneratorPage from "./features/kta/KtaGeneratorPage"
import ProtectedLayout from "./components/layout/ProtectedLayout"
import EventsPage from "./features/events/EventsPage"
import CreateEventPage from "./features/events/CreateEventPage"
import EventDetailPage from "./features/events/EventDetailPage"
import CompetitionDetailPage from "./features/events/CompetitionDetailPage"
import SkRevisionListPage from "./features/sk-management/SkRevisionListPage"
import HeadmasterSubmissionPage from "./features/sk-management/HeadmasterSubmissionPage"
import YayasanApprovalPage from "./features/approval/YayasanApprovalPage"
import PublicVerificationPage from "./features/verification/PublicVerificationPage"
import VerifyTeacherPage from "./features/verification/VerifyTeacherPage"
import VerifyStudentPage from "./features/verification/VerifyStudentPage"
import VerifySkPage from "./features/verification/VerifySkPage"

import MutationPage from "./features/mutations/MutationPage"
import SchoolProfilePage from "./features/schools/SchoolProfilePage"
import ChangePasswordPage from "./features/auth/ChangePasswordPage"
import DataAuditPage from '@/features/master-data/DataAuditPage';
import StudentCardPage from "./features/kta/StudentCardPage"
import { PengajuanNuptkPage } from "./features/sdm/PengajuanNuptkPage"
import { PersetujuanNuptkPage } from "./features/sdm/PersetujuanNuptkPage"
import SkTemplateManagementPage from "./features/sk-management/SkTemplateManagementPage"
import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { GlobalErrorBoundary } from "./components/common/GlobalErrorBoundary"

import { PageTransition } from "./components/common/PageTransition"
import { usePwaUpdate } from "./hooks/usePwaUpdate"

// Attendance Module
import QrScannerPage from "./features/attendance/QrScannerPage"
import TeacherAttendancePage from "./features/attendance/TeacherAttendancePage"
import StudentAttendancePage from "./features/attendance/StudentAttendancePage"
import StudentAttendanceReportPage from "./features/attendance/StudentAttendanceReportPage"
import SubjectsPage from "./features/attendance/SubjectsPage"
import ClassesPage from "./features/attendance/ClassesPage"
import LessonSchedulePage from "./features/attendance/LessonSchedulePage"
import AttendanceSettingsPage from "./features/attendance/AttendanceSettingsPage"

// Create a client
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

export default function App() {
  console.log("App Rendering...");
  usePwaUpdate()
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/test-render" element={<div className="p-10 bg-red-500 text-white">TEST ROUTE WORKING</div>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify/:id" element={<PublicVerificationPage />} />
          <Route path="/verify/sk/:nomor" element={<VerifySkPage />} />
          <Route path="/verify/teacher/:nuptk" element={<VerifyTeacherPage />} />
          <Route path="/verify/student/:nisn" element={<VerifyStudentPage />} />
          
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
                        <Route path="attendance/scanner" element={<QrScannerPage />} />
                        <Route path="attendance/teachers" element={<TeacherAttendancePage />} />
                        <Route path="attendance/students" element={<StudentAttendancePage />} />
                        <Route path="attendance/report" element={<StudentAttendanceReportPage />} />
                        <Route path="attendance/subjects" element={<SubjectsPage />} />
                        <Route path="attendance/classes" element={<ClassesPage />} />
                        <Route path="attendance/schedule" element={<LessonSchedulePage />} />
                        <Route path="attendance/settings" element={<AttendanceSettingsPage />} />
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
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
