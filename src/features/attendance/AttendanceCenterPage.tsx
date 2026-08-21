import React, { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authApi } from "@/lib/api"
import TeacherAttendancePage from "./TeacherAttendancePage"
import StudentAttendancePage from "./StudentAttendancePage"
import StudentAttendanceReportPage from "./StudentAttendanceReportPage"
import StaffAttendanceReportPage from "../staff/StaffAttendanceReportPage"
import { UserCheck, GraduationCap, FileBarChart, Users, CalendarCheck } from "lucide-react"

import SoftPageHeader from "@/components/ui/SoftPageHeader"

export default function AttendanceCenterPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab") || "teacher"
  const [activeTab, setActiveTab] = useState(tabFromUrl)

  const user = authApi.getStoredUser()
  const isSuperAdmin = user?.role === "super_admin"
  const isOperator = user?.role === "operator" || isSuperAdmin

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  const handleTabChange = (val: string) => {
    setActiveTab(val)
    setSearchParams({ tab: val }, { replace: true })
  }

  return (
    <div className="space-y-6 pb-10">
      <SoftPageHeader
        title="Pusat Absensi & Rekap"
        description="Monitor log absensi harian guru, presensi kelas siswa, serta rekapitulasi kehadiran berkala."
        icon={<UserCheck className="w-6 h-6 text-emerald-600" />}
      />

      {/* Centered Segmented Tab Navigation Bar */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="flex justify-center w-full">
          <div className="bg-slate-100/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 shadow-inner inline-flex items-center gap-1.5 max-w-full overflow-x-auto">
            <TabsList className="bg-transparent p-0 flex items-center gap-1.5 h-auto">
              {isOperator && (
                <>
                  <TabsTrigger
                    value="teacher"
                    className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
                  >
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    <span>Absensi Guru</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="student"
                    className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
                  >
                    <GraduationCap className="w-4 h-4 text-teal-500" />
                    <span>Absensi Siswa</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="report"
                    className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
                  >
                    <FileBarChart className="w-4 h-4 text-blue-500" />
                    <span>Laporan Sekolah</span>
                  </TabsTrigger>
                </>
              )}

              {isSuperAdmin && (
                <TabsTrigger
                  value="staff_report"
                  className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
                >
                  <Users className="w-4 h-4 text-purple-500" />
                  <span>Absensi Staff PCNU</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        </div>

        {isOperator && (
          <>
            <TabsContent value="teacher" className="mt-0 focus-visible:outline-none">
              <TeacherAttendancePage />
            </TabsContent>

            <TabsContent value="student" className="mt-0 focus-visible:outline-none">
              <StudentAttendancePage />
            </TabsContent>

            <TabsContent value="report" className="mt-0 focus-visible:outline-none">
              <StudentAttendanceReportPage />
            </TabsContent>
          </>
        )}

        {isSuperAdmin && (
          <TabsContent value="staff_report" className="mt-0 focus-visible:outline-none">
            <StaffAttendanceReportPage />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
