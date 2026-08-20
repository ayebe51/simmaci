import React, { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import SkSubmissionPage from "./SkSubmissionPage"
import SkRevisionListPage from "./SkRevisionListPage"
import MySkPage from "./MySkPage"
import { FileText, FileEdit, Archive, Sparkles, Crown, Award, FilePlus } from "lucide-react"

export default function SkCenterPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab") || "submission"
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-black uppercase tracking-widest">
              <Sparkles className="w-3 h-3 text-blue-400" /> Layanan Administrasi SK
            </div>
            <h1 className="text-2xl md:text-3xl font-black italic tracking-tight text-white uppercase">Pusat Layanan SK</h1>
            <p className="text-xs text-blue-200/80 max-w-xl font-medium">
              Kelola pengajuan SK baru (Guru/Tendik & Kepala), revisi permohonan data, serta akses arsip SK resmi satuan pendidikan Anda.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl px-5 h-11 transition-all font-bold text-xs">
                  <FilePlus className="mr-2 h-4 w-4 text-blue-300" />
                  Ajukan SK / Rekomendasi
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-xl">
                <DropdownMenuItem onClick={() => handleTabChange("submission")} className="cursor-pointer font-medium py-2.5 text-xs">
                  <FileText className="mr-2 h-4 w-4 text-blue-600" /> SK Guru / Tendik
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard/sdm/sk-kepala/new")} className="cursor-pointer font-medium py-2.5 text-xs">
                  <Crown className="mr-2 h-4 w-4 text-amber-600" /> SK Kepala Satpend
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard/sdm/rekomendasi-kepala/pengajuan")} className="cursor-pointer font-medium py-2.5 text-xs">
                  <Award className="mr-2 h-4 w-4 text-emerald-600" /> Rekomendasi Kepala
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Centered Segmented Aesthetic Navigation Bar */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="flex justify-center w-full">
          <div className="bg-slate-100/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 shadow-inner inline-flex items-center gap-1.5 max-w-full overflow-x-auto">
            <TabsList className="bg-transparent p-0 flex items-center gap-1.5 h-auto">
              <TabsTrigger
                value="submission"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <FileText className="w-4 h-4 text-blue-500" />
                <span>Pengajuan SK</span>
              </TabsTrigger>

              <TabsTrigger
                value="revisi"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <FileEdit className="w-4 h-4 text-amber-500" />
                <span>Revisi Data SK</span>
              </TabsTrigger>

              <TabsTrigger
                value="arsip"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <Archive className="w-4 h-4 text-emerald-500" />
                <span>Arsip SK Saya</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="submission" className="mt-0 focus-visible:outline-none">
          <SkSubmissionPage />
        </TabsContent>

        <TabsContent value="revisi" className="mt-0 focus-visible:outline-none">
          <SkRevisionListPage />
        </TabsContent>

        <TabsContent value="arsip" className="mt-0 focus-visible:outline-none">
          <MySkPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
