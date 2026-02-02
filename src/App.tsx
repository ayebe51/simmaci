import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom"
import LoginPage from "./features/auth/LoginPage"
import RegisterPage from "./features/auth/RegisterPage"
import AppShell from "./components/layout/AppShell"
import DashboardPage from "./features/dashboard/DashboardPage"
import SkDashboardPage from "./features/sk-management/SkDashboardPage"
import SkSubmissionPage from "./features/sk-management/SkSubmissionPage"
import MySkPage from "./features/sk-management/MySkPage"
import SkDetailPage from "./features/sk-management/SkDetailPage"
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
import ProtectedLayout from "./components/layout/ProtectedLayout"
import EventsPage from "./features/events/EventsPage"
import CreateEventPage from "./features/events/CreateEventPage"
import EventDetailPage from "./features/events/EventDetailPage"
import CompetitionDetailPage from "./features/events/CompetitionDetailPage"
import HeadmasterSubmissionPage from "./features/sk-management/HeadmasterSubmissionPage"
import YayasanApprovalPage from "./features/approval/YayasanApprovalPage"
import PublicVerificationPage from "./features/verification/PublicVerificationPage"
import ArchivePage from "./features/archive/ArchivePage"
import SchoolProfilePage from "./features/schools/SchoolProfilePage"
import ChangePasswordPage from "./features/auth/ChangePasswordPage"
import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "./components/ErrorBoundary"

// Create a client
const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify/:id" element={<PublicVerificationPage />} />
          
          {/* Protected Routes Wrapper */}
          <Route
            path="/dashboard/*"
            element={
              <ProtectedLayout>
                  <AppShell>
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
                      <Route path="generator" element={<SkGeneratorPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="change-password" element={<ChangePasswordPage />} />
                      <Route path="monitoring/headmasters" element={<HeadmasterExpiryPage />} />
                      <Route path="reports/sk" element={
                        <ErrorBoundary fallback={<div className="p-6 text-center text-red-500">Failed to load SK Report. data error.</div>}>
                          <SkReportPageSimple />
                        </ErrorBoundary>
                      } />
                      <Route path="reports" element={<ReportPage />} />
                      <Route path="events" element={<EventsPage />} />
                      <Route path="events/new" element={<CreateEventPage />} />
                      <Route path="events/:id" element={<EventDetailPage />} />
                      <Route path="competitions/:competitionId" element={<CompetitionDetailPage />} />
                      <Route path="sk/:id/print" element={<SkPrintPage />} />
                      <Route path="approval/yayasan" element={<YayasanApprovalPage />} />
                      <Route path="archive" element={<ArchivePage />} />
                    </Routes>
                  </AppShell>
              </ProtectedLayout>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
