import React, { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import SubjectsPage from "./SubjectsPage"
import ClassesPage from "./ClassesPage"
import LessonSchedulePage from "./LessonSchedulePage"
import AttendanceSettingsPage from "./AttendanceSettingsPage"
import { BookOpen, School, ClipboardList, Settings, Sliders } from "lucide-react"

export default function AcademicConfigPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab") || "subjects"
  const [activeTab, setActiveTab] = useState(tabFromUrl)

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
    <div className="space-y-6 pb-20">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 p-8 text-white shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-[10px] font-black uppercase tracking-widest">
            <Sliders className="w-3 h-3 text-teal-400" /> Pengaturan Akademik & Kurikulum
          </div>
          <h1 className="text-2xl md:text-3xl font-black italic tracking-tight text-white uppercase">Konfigurasi Akademik</h1>
          <p className="text-xs text-teal-200/80 max-w-xl font-medium">
            Kelola mata pelajaran, rombel/kelas, pembagian jam pelajaran, serta aturan batasan jam absensi.
          </p>
        </div>
      </div>

      {/* Centered Segmented Tab Navigation Bar */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="flex justify-center w-full">
          <div className="bg-slate-100/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 shadow-inner inline-flex items-center gap-1.5 max-w-full overflow-x-auto">
            <TabsList className="bg-transparent p-0 flex items-center gap-1.5 h-auto">
              <TabsTrigger
                value="subjects"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <BookOpen className="w-4 h-4 text-teal-500" />
                <span>Mata Pelajaran</span>
              </TabsTrigger>

              <TabsTrigger
                value="classes"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <School className="w-4 h-4 text-emerald-500" />
                <span>Kelas / Rombel</span>
              </TabsTrigger>

              <TabsTrigger
                value="schedule"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <ClipboardList className="w-4 h-4 text-blue-500" />
                <span>Jadwal Jam</span>
              </TabsTrigger>

              <TabsTrigger
                value="settings"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <Settings className="w-4 h-4 text-purple-500" />
                <span>Pengaturan Absensi</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="subjects" className="mt-0 focus-visible:outline-none">
          <SubjectsPage />
        </TabsContent>

        <TabsContent value="classes" className="mt-0 focus-visible:outline-none">
          <ClassesPage />
        </TabsContent>

        <TabsContent value="schedule" className="mt-0 focus-visible:outline-none">
          <LessonSchedulePage />
        </TabsContent>

        <TabsContent value="settings" className="mt-0 focus-visible:outline-none">
          <AttendanceSettingsPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
