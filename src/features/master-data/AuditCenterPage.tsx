import React, { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DataAuditPage from "./DataAuditPage"
import ActivityLogPage from "./ActivityLogPage"
import { Stethoscope, Activity, ShieldAlert } from "lucide-react"

import SoftPageHeader from "@/components/ui/SoftPageHeader"

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
    <div className="space-y-6 pb-10">
      <SoftPageHeader
        title="Audit & Log Sistem"
        description="Diagnosa kesehatan basis data (Health Data), temukan anomali data ganda/kosong, serta pantau log aktivitas sistem."
        icon={<ShieldAlert className="w-6 h-6 text-emerald-600" />}
      />

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
