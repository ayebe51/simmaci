import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  FileText,
  LayoutDashboard,
  Menu,
  School,
  Settings,
  User,
  LogOut,
  Users,
  AlertTriangle,
  FileBarChart,
  Trophy,
  Crown,
  Gavel,
  Archive,
  ArrowRightLeft,
  ChevronDown,
  CreditCard,
  Stethoscope,
  FileEdit
} from "lucide-react"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { NotificationDropdown } from "@/components/common/NotificationDropdown"
import { Toaster } from "sonner"

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

  // Navigation Groups
  const navGroups = [
    {
      title: "Master Data",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Profil Lembaga", href: "/dashboard/master/schools", icon: School },
        { label: "Data Guru & Tendik", href: "/dashboard/master/teachers", icon: Users },
        { label: "Data Siswa", href: "/dashboard/master/students", icon: User },
      ]
    },
    {
      title: "Administrasi SK",
      items: [
        { label: "Generator SK", href: "/dashboard/generator", icon: FileText },
        { label: "Pengajuan SK", href: "/dashboard/sk", icon: FileText },
        { label: "Revisi Data SK", href: "/dashboard/sk-revision", icon: FileEdit },
        { label: "Arsip SK Unit", href: "/dashboard/sk-saya", icon: FileText },

        { label: "Laporan SK", href: "/dashboard/reports/sk", icon: FileBarChart },
        { label: "Digital KTA", href: "/dashboard/kta", icon: CreditCard },
        { label: "Kartu Pelajar", href: "/dashboard/student-card", icon: CreditCard },
      ]
    },
    {
      title: "Manajemen SDM",
      items: [
        { label: "Pengajuan Kepala", href: "/dashboard/sk/headmaster/new", icon: Crown },
        { label: "Mutasi Guru", href: "/dashboard/mutations", icon: ArrowRightLeft },
        { label: "Monitoring Kepala", href: "/dashboard/monitoring/headmasters", icon: AlertTriangle },
        { label: "Pengajuan NUPTK", href: "/dashboard/sdm/nuptk/pengajuan", icon: FileText },
        { label: "Persetujuan NUPTK", href: "/dashboard/sdm/nuptk/persetujuan", icon: Gavel },
        { label: "Laporan Guru", href: "/dashboard/reports", icon: FileBarChart },
      ]
    },
    {
      title: "Administrasi Sistem",
      items: [
        { label: "Approval Yayasan", href: "/dashboard/approval/yayasan", icon: Gavel },
        { label: "Manajemen User", href: "/dashboard/users", icon: Users },
        { label: "Health Data", href: "/dashboard/audit", icon: Stethoscope },
        { label: "Event / Lomba", href: "/dashboard/events", icon: Trophy },
        { label: "Pengaturan", href: "/dashboard/settings", icon: Settings },
      ]
    }
  ]

  return (
    <div className="flex h-screen w-full bg-[#f8fafc]/50 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out md:static",
          sidebarOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full md:w-0 md:translate-x-0 md:opacity-0 md:w-[0px] md:overflow-hidden"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-20 items-center border-b border-slate-100 px-6 bg-gradient-to-r from-emerald-600/5 to-transparent">
          <Link to="/dashboard" className="flex items-center gap-3 font-bold text-xl tracking-tight text-slate-800">
            <div className="p-1.5 bg-white rounded-xl shadow-sm border border-emerald-100">
                <img src="/logo-icon.png" alt="Logo" className="h-8 w-8 object-contain" />
            </div>
            <div className={cn("flex flex-col justify-center", !sidebarOpen && "hidden")}>
              <span className="leading-none text-emerald-800 font-extrabold pb-1">SIMMACI</span>
              <span className="text-[10px] leading-none text-emerald-600/70 font-medium tracking-wide">MA'ARIF NU CILACAP</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="grid gap-2 px-3">
            {navGroups.map((group, groupIndex) => {
              // Filter items inside the group based on RBAC
              const userStr = localStorage.getItem("user")
              const user = userStr ? JSON.parse(userStr) : null
              const userRole = user?.role || ""

              const visibleItems = group.items.filter(item => {
                 // 1. SUPER ADMIN ONLY
                 if (["Generator SK", "Manajemen User", "Health Data"].includes(item.label)) {
                     return userRole === "super_admin";
                 }

                 // 2. YAYASAN & SUPER ADMIN
                 if (["Approval Yayasan", "Monitoring Kepala", "Persetujuan NUPTK", "Laporan Guru", "Laporan SK"].includes(item.label)) {
                     return ["super_admin", "admin_yayasan", "admin"].includes(userRole);
                 }

                 // 3. OPERATOR (DEFAULT)
                 // Operator can see everything else (Master Data, New SK, My SK, etc)
                 return true;
              })

              if (visibleItems.length === 0) return null

              const isDefaultOpen = group.title === "Master Data" || group.title === "Administrasi SK"

              return (
                <Collapsible 
                  key={groupIndex} 
                  defaultOpen={isDefaultOpen} 
                  className="group/collapsible"
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 hover:bg-muted/50 hover:text-foreground">
                    {group.title}
                    <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=closed]/collapsible:-rotate-90" />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="space-y-1 pt-1 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
                    {visibleItems.map((item, index) => {
                      const isExactMatch = location.pathname === item.href
                      const isChildRoute = location.pathname.startsWith(item.href + '/') && item.href !== '/dashboard'
                      const isActive = isExactMatch || isChildRoute

                      return (
                        <Link
                          key={index}
                          to={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
                            isActive
                              ? "bg-emerald-50 text-emerald-700 font-semibold shadow-sm ring-1 ring-emerald-500/20"
                              : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      )
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </nav>
        </div>

        {/* User Footer */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
               <User className="h-4 w-4 text-gray-500"/>
            </div>
            <div className="flex flex-col overflow-hidden">
                {(() => {
                  const userStr = localStorage.getItem("user")
                  const user = userStr ? JSON.parse(userStr) : null
                  return (
                    <>
                      <span className="truncate text-sm font-medium">{user?.name || "User"}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.email || ""}</span>
                    </>
                  )
                })()}
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="mt-2 w-full justify-start text-muted-foreground hover:text-red-500"
            onClick={() => {
                localStorage.removeItem("token")
                localStorage.removeItem("user")
                window.location.href = "/login"
            }}
          >
             <LogOut className="mr-2 h-4 w-4"/> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex flex-1 flex-col overflow-hidden relative z-10 w-full max-w-full">
        {/* Header */}
        <header className="flex h-20 items-center gap-4 px-6 glass sticky top-0 z-30">
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hidden md:flex hover:bg-emerald-50 hover:text-emerald-700">
             <Menu className="h-5 w-5"/>
             <span className="sr-only">Toggle Sidebar</span>
          </Button>
           {/* Mobile Menu Toggle (reusing same logic roughly) */}
           <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden">
             <Menu className="h-5 w-5"/>
          </Button>
          
          <div className="ml-auto flex items-center gap-2">
             <NotificationDropdown />
             <span className="text-sm font-medium text-muted-foreground border-l pl-4 ml-2">
               Tahun Ajaran: {(() => {
                 const now = new Date()
                 const year = now.getFullYear()
                 const month = now.getMonth() + 1 // 0-indexed
                 // Academic year starts in July (month 7)
                 // If Jan-June: show (year-1)/(year)
                 // If Jul-Dec: show (year)/(year+1)
                 return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`
               })()}
             </span>
          </div>
        </header>

        {/* Main Content View with Scroll */}
        <main className="flex-1 overflow-y-auto p-6">
           {children}
        </main>
        <Toaster richColors position="top-right" />
      </div>
    </div>
  )
}
