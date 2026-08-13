import React, { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authApi } from "@/lib/api"
import WaBlastListPage from "./WaBlastListPage"
import WaBlastTemplatePage from "./WaBlastTemplatePage"
import { WaBlastConfigPage } from "./pages/WaBlastConfigPage"
import { MessageSquare, LayoutTemplate, Settings, Send } from "lucide-react"

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
    <div className="space-y-6 pb-20">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-[10px] font-black uppercase tracking-widest">
            <Send className="w-3 h-3 text-purple-400" /> Gateway Komunikasi Otomatis
          </div>
          <h1 className="text-2xl md:text-3xl font-black italic tracking-tight text-white uppercase">WhatsApp Center</h1>
          <p className="text-xs text-purple-200/80 max-w-xl font-medium">
            Kirim pengumuman massal (WA Blast), atur template pesan kustom, serta konfigurasi integrasi perangkat Go-WA.
          </p>
        </div>
      </div>

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
