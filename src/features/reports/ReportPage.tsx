import React, { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Users, Building2, AlertCircle, FileBarChart } from "lucide-react"

import TeacherReportTab from "./TeacherReportTab"
import SkReportPageSimple from "./SkReportPageSimple"
import SkReportGroupedPage from "./SkReportGroupedPage"
import SkReportMissingPage from "./SkReportMissingPage"

export default function ReportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab") || "teacher"
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-8 text-white shadow-xl print:hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-black uppercase tracking-widest">
            <FileBarChart className="w-3 h-3 text-blue-400" /> Analitik & Rekapitulasi LP Ma'arif NU
          </div>
          <h1 className="text-2xl md:text-3xl font-black italic tracking-tight text-white uppercase">Pusat Laporan & Analitik</h1>
          <p className="text-xs text-blue-200/80 max-w-xl font-medium">
            Rekapitulasi statistik data guru/PTK, analisis penerbitan SK, serta monitoring status pengajuan madrasah.
          </p>
        </div>
      </div>

      {/* Centered Segmented Glassmorphism Tab Navigation Bar */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6 print:block">
        <div className="flex justify-center w-full print:hidden">
          <div className="bg-slate-100/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 shadow-inner inline-flex items-center gap-1.5 max-w-full overflow-x-auto">
            <TabsList className="bg-transparent p-0 flex items-center gap-1.5 h-auto">
              <TabsTrigger
                value="teacher"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <Users className="w-4 h-4 text-emerald-500" />
                <span>Rekap Data Guru</span>
              </TabsTrigger>

              <TabsTrigger
                value="sk-detail"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <FileText className="w-4 h-4 text-blue-500" />
                <span>Laporan SK (Detail)</span>
              </TabsTrigger>

              <TabsTrigger
                value="sk-grouped"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <Building2 className="w-4 h-4 text-purple-500" />
                <span>Rekap SK per Sekolah</span>
              </TabsTrigger>

              <TabsTrigger
                value="sk-missing"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>Sekolah Belum Pengajuan</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="mt-6 print:mt-0">
          <TabsContent value="teacher" className="m-0 focus-visible:outline-none print:block">
            <TeacherReportTab />
          </TabsContent>

          <TabsContent value="sk-detail" className="m-0 focus-visible:outline-none print:block">
            <SkReportPageSimple />
          </TabsContent>

          <TabsContent value="sk-grouped" className="m-0 focus-visible:outline-none print:block">
            <SkReportGroupedPage />
          </TabsContent>

          <TabsContent value="sk-missing" className="m-0 focus-visible:outline-none print:block">
            <SkReportMissingPage />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
