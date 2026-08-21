import React, { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authApi } from "@/lib/api"
import WaBlastListPage from "./WaBlastListPage"
import WaBlastTemplatePage from "./WaBlastTemplatePage"
import { WaBlastConfigPage } from "./pages/WaBlastConfigPage"
import { MessageSquare, LayoutTemplate, Settings, Send } from "lucide-react"

import SoftPageHeader from "@/components/ui/SoftPageHeader"

export default function WaCenterPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab") || "list"
  const [activeTab, setActiveTab] = useState(tabFromUrl)

  const user = authApi.getStoredUser()
  const isSuperAdmin = user?.role === "super_admin"

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
        title="WhatsApp Center"
        description="Kirim pengumuman massal (WA Blast), atur template pesan kustom, serta konfigurasi integrasi perangkat Go-WA."
        icon={<MessageSquare className="w-6 h-6 text-emerald-600" />}
      />

      {/* Centered Segmented Tab Navigation Bar */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="flex justify-center w-full">
          <div className="bg-slate-100/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 shadow-inner inline-flex items-center gap-1.5 max-w-full overflow-x-auto">
            <TabsList className="bg-transparent p-0 flex items-center gap-1.5 h-auto">
              <TabsTrigger
                value="list"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <MessageSquare className="w-4 h-4 text-purple-500" />
                <span>Daftar WA Blast</span>
              </TabsTrigger>

              <TabsTrigger
                value="templates"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <LayoutTemplate className="w-4 h-4 text-indigo-500" />
                <span>Template Pesan</span>
              </TabsTrigger>

              {isSuperAdmin && (
                <TabsTrigger
                  value="config"
                  className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
                >
                  <Settings className="w-4 h-4 text-blue-500" />
                  <span>Konfigurasi Go-WA</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        </div>

        <TabsContent value="list" className="mt-0 focus-visible:outline-none">
          <WaBlastListPage />
        </TabsContent>

        <TabsContent value="templates" className="mt-0 focus-visible:outline-none">
          <WaBlastTemplatePage />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="config" className="mt-0 focus-visible:outline-none">
            <WaBlastConfigPage />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
