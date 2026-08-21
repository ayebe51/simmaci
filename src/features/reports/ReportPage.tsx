import React, { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Users, Building2, AlertCircle, FileBarChart } from "lucide-react"

import TeacherReportTab from "./TeacherReportTab"
import SkReportPageSimple from "./SkReportPageSimple"
import SkReportGroupedPage from "./SkReportGroupedPage"
import SkReportMissingPage from "./SkReportMissingPage"

import SoftPageHeader from "@/components/ui/SoftPageHeader"

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
    <div className="space-y-6 pb-10">
      <SoftPageHeader
        title="Pusat Laporan & Analitik"
        description="Rekapitulasi statistik data guru/PTK, analisis penerbitan SK, serta monitoring status pengajuan madrasah."
        icon={<FileBarChart className="w-6 h-6 text-emerald-600" />}
        className="print:hidden"
      />

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
