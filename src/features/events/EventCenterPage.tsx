import React, { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import EventsPage from "./EventsPage"
import MeetingListPage from "../meetings/pages/MeetingListPage"
import { Trophy, CalendarDays, CalendarCheck2 } from "lucide-react"

export default function EventCenterPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab") || "events"
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-950 via-amber-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] font-black uppercase tracking-widest">
            <CalendarCheck2 className="w-3 h-3 text-amber-400" /> Agenda & Acara Organisasi
          </div>
          <h1 className="text-2xl md:text-3xl font-black italic tracking-tight text-white uppercase">Manajemen Acara</h1>
          <p className="text-xs text-amber-200/80 max-w-xl font-medium">
            Kelola perlombaan, event kejuaraan, serta rapat kearsipan dan absensi presensi yayasan.
          </p>
        </div>
      </div>

      {/* Centered Segmented Tab Navigation Bar */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="flex justify-center w-full">
          <div className="bg-slate-100/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 shadow-inner inline-flex items-center gap-1.5 max-w-full overflow-x-auto">
            <TabsList className="bg-transparent p-0 flex items-center gap-1.5 h-auto">
              <TabsTrigger
                value="events"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Event & Lomba</span>
              </TabsTrigger>

              <TabsTrigger
                value="meetings"
                className="h-11 px-5 rounded-xl font-extrabold text-xs tracking-wider transition-all duration-200 flex items-center gap-2.5 text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/80 border border-transparent data-[state=active]:border-slate-200/60"
              >
                <CalendarDays className="w-4 h-4 text-blue-500" />
                <span>Rapat Yayasan</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="events" className="mt-0 focus-visible:outline-none">
          <EventsPage />
        </TabsContent>

        <TabsContent value="meetings" className="mt-0 focus-visible:outline-none">
          <MeetingListPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
