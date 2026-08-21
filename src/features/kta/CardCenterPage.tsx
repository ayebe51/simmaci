import React, { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import KtaGeneratorPage from "./KtaGeneratorPage"
import StudentCardPage from "./StudentCardPage"
import { CreditCard, GraduationCap, IdCard } from "lucide-react"

import SoftPageHeader from "@/components/ui/SoftPageHeader"

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
    <div className="space-y-6 pb-10">
      <SoftPageHeader
        title="Pusat Cetak Kartu"
        description="Generate dan cetak Kartu Tanda Anggota (KTA) Digital untuk Guru/Tendik serta Kartu Pelajar Siswa."
        icon={<IdCard className="w-6 h-6 text-emerald-600" />}
      />

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
