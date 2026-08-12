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
  FileEdit,
  Activity,
  ScanLine,
  GraduationCap,
  BookOpen,
  ClipboardList,
  UserCheck,
  Bell,
  LayoutTemplate,
  MessageSquare,
  CalendarDays,
  CalendarPlus,
  BarChart3,
} from "lucide-react"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { useState } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { GlobalErrorBoundary } from "@/components/common/GlobalErrorBoundary"
import { NotificationDropdown } from "@/components/common/NotificationDropdown"
import { Breadcrumbs } from "@/components/common/Breadcrumbs"
import { Toaster } from "sonner"
import { navigationConfig } from "@/config/navigation"

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  // Default tutup di layar kecil (< lg / 1024px), buka di layar besar
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024)
  const location = useLocation()

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

  // Safe user loading from storage
  const [user] = useState<any>(() => {
    const u = localStorage.getItem("user_data")
    if (!u) return null
    try {
      return JSON.parse(u)
    } catch {
      return null
    }
  })

  const userRole = user?.role || null;
  const isSuperAdmin = ["super_admin", "admin_yayasan", "admin"].includes(userRole);
  const isOperator = userRole === "operator";

  // The `navigationConfig` is imported from @/config/navigation.ts

  return (
    <div className="flex h-screen w-full bg-slate-50 relative overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* Subtle Background Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-400/10 rounded-full blur-[100px] pointer-events-none print:hidden" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-400/5 rounded-full blur-[100px] pointer-events-none print:hidden" />

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm transition-opacity md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-slate-200 shadow-sm transition-all duration-300 ease-in-out md:static print:hidden",
          sidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full md:w-0 md:translate-x-0 md:opacity-0 md:overflow-hidden"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-20 items-center border-b border-slate-100 px-6 bg-gradient-to-r from-emerald-600/5 to-transparent">
          <Link to="/dashboard" className="flex items-center gap-3 font-bold text-xl tracking-tight text-slate-800">
            <div className="overflow-hidden rounded-xl shadow-sm border border-emerald-100/50">
                <img src="/logo-icon-192.png" alt="Logo" className="h-10 w-10 object-contain" />
            </div>
            <div className={cn("flex flex-col justify-center", !sidebarOpen && "hidden")}>
              <span className="leading-none text-emerald-800 font-extrabold pb-1">SIMMACI</span>
              <span className="text-[10px] leading-none text-emerald-600/70 font-medium tracking-wide font-sans">MA'ARIF NU CILACAP</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="grid gap-2 px-3">
            {navigationConfig.map((group, groupIndex) => {
              const visibleItems = group.items.filter(item => {
                  if (item.roles && item.roles.length > 0) {
                      return item.roles.includes(userRole);
                  }
                  return true; // No roles defined means everyone can see
              });

              if (visibleItems.length === 0) return null

              const allHrefs = navigationConfig.flatMap(g => g.items.map(i => i.href))
              const exactMatchExists = allHrefs.some(h => h === location.pathname)

              const isGroupActive = visibleItems.some(item => {
                  return item.exact 
                      ? location.pathname === item.href
                      : location.pathname === item.href || (!exactMatchExists && location.pathname.startsWith(item.href + '/') && item.href !== '/dashboard');
              });

              const isDefaultOpen = group.id === "master" || group.id === "sk" || isGroupActive;

              return (
                <Collapsible 
                  key={groupIndex} 
                  defaultOpen={isDefaultOpen} 
                  className="group/collapsible"
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-800/60 hover:bg-emerald-50/50 hover:text-emerald-800 transition-colors">
                    {group.title}
                    <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=closed]/collapsible:-rotate-90" />
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="space-y-0.5 pt-1 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
                    {visibleItems.map((item, index) => {
                      // isActive: exact match ATAU starts-with + bukan root dashboard.
                      // Kecuali: jika ada nav item LAIN yang exact-match pathname (misalnya
                      // /dashboard/sk/headmaster/new match persis ke item "Pengajuan SK Kepala"),
                      // maka item saat ini TIDAK boleh dianggap aktif via startsWith.
                      const isActive = item.exact 
                          ? location.pathname === item.href
                          : location.pathname === item.href || (!exactMatchExists && location.pathname.startsWith(item.href + '/') && item.href !== '/dashboard')

                      if (item.external) {
                        return (
                          <a
                            key={index}
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 md:py-2 text-sm font-medium transition-all duration-300 text-slate-500 hover:bg-emerald-50/50 hover:text-emerald-800"
                          >
                            <item.icon className="h-4.5 w-4.5 shrink-0 text-emerald-600/70" />
                            <span className="leading-tight">{item.label}</span>
                            <span className="ml-auto text-[9px] font-bold text-emerald-600/50 uppercase tracking-wider">↗</span>
                          </a>
                        )
                      }

                      return (
                        <Link
                          key={index}
                          to={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 md:py-2 text-sm font-medium transition-all duration-300 border-glow",
                            isActive
                              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-md border-transparent ring-2 ring-emerald-500/20"
                              : "text-slate-500 hover:bg-emerald-50/50 hover:text-emerald-800"
                          )}
                        >
                          <item.icon className={cn("h-4.5 w-4.5 shrink-0", isActive ? "text-white" : "text-emerald-600/70")} />
                          <span className="leading-tight">{item.label}</span>
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
        <div className="border-t p-4 bg-emerald-50/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-emerald-100">
               <User className="h-5 w-5 text-emerald-600"/>
            </div>
            <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-bold text-slate-800">{user?.name || "User"}</span>
                <span className="truncate text-[10px] uppercase tracking-wider text-emerald-600/70 font-bold">{user?.role?.replace('_', ' ') || ""}</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="mt-3 w-full justify-start text-muted-foreground hover:bg-red-50 hover:text-red-500 rounded-lg group transition-colors"
            onClick={() => {
                localStorage.removeItem("auth_token")
                localStorage.removeItem("user_data")
                window.location.href = "/login"
            }}
          >
             <LogOut className="mr-2 h-4 w-4 group-hover:translate-x-1 transition-transform"/> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex flex-1 flex-col overflow-hidden relative z-10 w-full max-w-full print:block print:overflow-visible print:h-auto">
        {/* Header */}
        <header className="flex h-20 items-center gap-4 px-6 bg-white/40 backdrop-blur-xl border-b border-white/50 sticky top-0 z-30 shadow-[0_4px_30px_rgba(0,0,0,0.02)] print:hidden">
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hidden md:flex hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
             <Menu className="h-5 w-5"/>
             <span className="sr-only">Toggle Sidebar</span>
          </Button>
           {/* Mobile Menu Toggle */}
           <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden">
             <Menu className="h-5 w-5"/>
          </Button>
          
          <div className="ml-auto flex items-center gap-2">
             <GlobalErrorBoundary fallback={<Button variant="ghost" size="icon" disabled><Bell className="h-5 w-5 text-slate-300" /></Button>}>
                <NotificationDropdown />
             </GlobalErrorBoundary>
             <div className="h-8 w-[1px] bg-slate-200 mx-2" />
             <span className="text-[11px] font-bold text-emerald-800/60 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
               {(() => {
                 const year = new Date().getFullYear()
                 return `${year}/${year + 1}`
               })()}
             </span>
          </div>
        </header>

        {/* Main Content View with Scroll */}
        <main className="flex-1 overflow-y-auto p-6 animate-slow-fade print:p-0 print:overflow-visible print:block print:h-auto">
           <Breadcrumbs className="print:hidden" />
           {children}
        </main>
        <Toaster richColors position="top-right" />
      </div>
    </div>
  )
}
