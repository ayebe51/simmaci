import React, { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authApi } from "@/lib/api"
import SkGeneratorPage from "./SkGeneratorPage"
import YayasanApprovalPage from "../approval/YayasanApprovalPage"
import SkTemplateManagementPage from "./SkTemplateManagementPage"
import { FileText, Gavel, LayoutTemplate, ShieldCheck } from "lucide-react"

import SoftPageHeader from "@/components/ui/SoftPageHeader"

export default function SkGeneratorCenterPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab") || "generator"
  const [activeTab, setActiveTab] = useState(tabFromUrl)

  const user = authApi.getStoredUser()
  const canApprove = user?.role === "super_admin" || user?.role === "admin_yayasan" || user?.role === "admin"

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
        title="Generator & Approval SK"
        description="Proses verifikasi pengajuan SK, cetak SK kolektif secara otomatis, dan kelola template dokumen resmi Word/PDF."
        icon={<Gavel className="w-6 h-6 text-emerald-600" />}
      />

      {/* Centered Segmented Tab Navigation Bar */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="flex justify-center w-full">
          <div className="bg-slate-100/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 shadow-inner inline-flex items-center gap-1.5 max-w-full overflow-x-auto">
            <TabsList className="bg-transparent p-0 flex items-center gap-1.5 h-auto">
              <TabsTrigger
                value="generator"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <FileText className="w-4 h-4 text-blue-500" />
                <span>Generator SK Batch</span>
              </TabsTrigger>

              {canApprove && (
                <TabsTrigger
                  value="approval"
                  className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
                >
                  <Gavel className="w-4 h-4 text-purple-500" />
                  <span>Approval Yayasan</span>
                </TabsTrigger>
              )}

              <TabsTrigger
                value="templates"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <LayoutTemplate className="w-4 h-4 text-indigo-500" />
                <span>Template SK (Word/PDF)</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="generator" className="mt-0 focus-visible:outline-none">
          <SkGeneratorPage />
        </TabsContent>

        {canApprove && (
          <TabsContent value="approval" className="mt-0 focus-visible:outline-none">
            <YayasanApprovalPage />
          </TabsContent>
        )}

        <TabsContent value="templates" className="mt-0 focus-visible:outline-none">
          <SkTemplateManagementPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
