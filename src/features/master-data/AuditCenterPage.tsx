import React, { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DataAuditPage from "./DataAuditPage"
import ActivityLogPage from "./ActivityLogPage"
import { Stethoscope, Activity, ShieldAlert } from "lucide-react"

export default function AuditCenterPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab") || "health"
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-950 via-slate-900 to-slate-950 p-8 text-white shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-[10px] font-black uppercase tracking-widest">
            <ShieldAlert className="w-3 h-3 text-rose-400" /> Monitoring Keamanan & Integritas Basis Data
          </div>
          <h1 className="text-2xl md:text-3xl font-black italic tracking-tight text-white uppercase">Audit & Log Sistem</h1>
          <p className="text-xs text-rose-200/80 max-w-xl font-medium">
            Diagnosa kesehatan basis data (Health Data), temukan anomali data ganda/kosong, serta pantau log aktivitas sistem.
          </p>
        </div>
      </div>

      {/* Centered Segmented Tab Navigation Bar */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="flex justify-center w-full">
          <div className="bg-slate-100/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 shadow-inner inline-flex items-center gap-1.5 max-w-full overflow-x-auto">
            <TabsList className="bg-transparent p-0 flex items-center gap-1.5 h-auto">
              <TabsTrigger
                value="health"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <Stethoscope className="w-4 h-4 text-rose-500" />
                <span>Health Data / Audit</span>
              </TabsTrigger>

              <TabsTrigger
                value="logs"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <Activity className="w-4 h-4 text-blue-500" />
                <span>Log Aktivitas Sistem</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="health" className="mt-0 focus-visible:outline-none">
          <DataAuditPage />
        </TabsContent>

        <TabsContent value="logs" className="mt-0 focus-visible:outline-none">
          <ActivityLogPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
