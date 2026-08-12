import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Users, BarChart3, Building2 } from "lucide-react"

import TeacherReportTab from "./TeacherReportTab"
import SkReportPageSimple from "./SkReportPageSimple"
import SkReportGroupedPage from "./SkReportGroupedPage"

export default function ReportPage() {
  const [activeTab, setActiveTab] = useState("teacher")

  return (
    <div className="space-y-6 pb-20 max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col gap-1.5 print:hidden">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic">Pusat Laporan</h1>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
          <BarChart3 className="w-3 h-3 text-blue-500" /> Analitik & Rekapitulasi Data LP Ma'arif NU
        </p>
      </div>

      <Tabs defaultValue="teacher" value={activeTab} onValueChange={setActiveTab} className="w-full print:block">
        <TabsList className="grid grid-cols-3 max-w-2xl bg-white p-1 rounded-2xl border border-slate-200 shadow-sm print:hidden h-auto">
          <TabsTrigger value="teacher" className="rounded-xl py-2.5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            <Users className="w-4 h-4 mr-2" />
            <span className="font-bold">Laporan Guru</span>
          </TabsTrigger>
          <TabsTrigger value="sk-detail" className="rounded-xl py-2.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
            <FileText className="w-4 h-4 mr-2" />
            <span className="font-bold">Laporan SK (Detail)</span>
          </TabsTrigger>
          <TabsTrigger value="sk-grouped" className="rounded-xl py-2.5 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-sm">
            <Building2 className="w-4 h-4 mr-2" />
            <span className="font-bold">Laporan SK (Sekolah)</span>
          </TabsTrigger>
        </TabsList>
        
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
        </div>
      </Tabs>
    </div>
  )
}
