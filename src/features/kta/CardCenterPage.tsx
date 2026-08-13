import React, { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import KtaGeneratorPage from "./KtaGeneratorPage"
import StudentCardPage from "./StudentCardPage"
import { CreditCard, GraduationCap, IdCard } from "lucide-react"

export default function CardCenterPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab") || "kta"
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 p-8 text-white shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-black uppercase tracking-widest">
            <IdCard className="w-3 h-3 text-blue-400" /> Cetak Kartu Identitas Digital
          </div>
          <h1 className="text-2xl md:text-3xl font-black italic tracking-tight text-white uppercase">Pusat Cetak Kartu</h1>
          <p className="text-xs text-blue-200/80 max-w-xl font-medium">
            Generate dan cetak Kartu Tanda Anggota (KTA) Digital untuk Guru/Tendik serta Kartu Pelajar Siswa.
          </p>
        </div>
      </div>

      {/* Centered Segmented Tab Navigation Bar */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="flex justify-center w-full">
          <div className="bg-slate-100/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 shadow-inner inline-flex items-center gap-1.5 max-w-full overflow-x-auto">
            <TabsList className="bg-transparent p-0 flex items-center gap-1.5 h-auto">
              <TabsTrigger
                value="kta"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <CreditCard className="w-4 h-4 text-blue-500" />
                <span>Digital KTA Guru / Tendik</span>
              </TabsTrigger>

              <TabsTrigger
                value="student_card"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <GraduationCap className="w-4 h-4 text-indigo-500" />
                <span>Kartu Pelajar Siswa</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="kta" className="mt-0 focus-visible:outline-none">
          <KtaGeneratorPage />
        </TabsContent>

        <TabsContent value="student_card" className="mt-0 focus-visible:outline-none">
          <StudentCardPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
