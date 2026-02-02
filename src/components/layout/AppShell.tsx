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
  Archive
} from "lucide-react"
import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { NotificationDropdown } from "@/components/common/NotificationDropdown"

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Data Madrasah", href: "/dashboard/master/schools", icon: School },
    { label: "Data Guru & Tendik", href: "/dashboard/master/teachers", icon: Users },
    { label: "Data Siswa", href: "/dashboard/master/students", icon: User },
    { label: "Generator SK", href: "/dashboard/generator", icon: FileText },
    { label: "Pengajuan SK", href: "/dashboard/sk", icon: FileText },
    { label: "Arsip SK Unit", href: "/dashboard/sk-saya", icon: FileText },
    { label: "Pengajuan Kepala", href: "/dashboard/sk/headmaster/new", icon: Crown },
    { label: "Approval Yayasan", href: "/dashboard/approval/yayasan", icon: Gavel },
    { label: "Event / Lomba", href: "/dashboard/events", icon: Trophy },
    { label: "Manajemen User", href: "/dashboard/users", icon: Users },
    { label: "Monitoring Kepala", href: "/dashboard/monitoring/headmasters", icon: AlertTriangle },
    { label: "Laporan SK", href: "/dashboard/reports/sk", icon: FileBarChart },
    { label: "Archive", href: "/dashboard/archive", icon: Archive },

    { label: "Pengaturan", href: "/dashboard/settings", icon: Settings },
  ]

  return (
    <div className="flex h-screen w-full bg-gray-50/50">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 flex flex-col border-r bg-background transition-all duration-300 ease-in-out md:static",
          sidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full md:w-0 md:translate-x-0 md:opacity-0 md:w-[0px] md:overflow-hidden"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center border-b px-6">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg">
            <img src="/logo-icon.png" alt="Logo" className="h-8 w-8 object-contain" />
            <span className={cn("truncate", !sidebarOpen && "hidden")}>
              SIMMACI
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="grid gap-1 px-2">
            {navItems.map((item, index) => {
              // Exact match has priority, then check if it's a child route
              const isExactMatch = location.pathname === item.href
              const isChildRoute = location.pathname.startsWith(item.href + '/') && item.href !== '/dashboard'
              const isActive = isExactMatch || isChildRoute
              
              const userStr = localStorage.getItem("user")
              const user = userStr ? JSON.parse(userStr) : null
              const userRole = user?.role || ""

              // 🔐 RBAC MENU VISIBILITY CONTROL
              
              // 1. Generator SK - super_admin ONLY
              if (item.label === "Generator SK" && userRole !== "super_admin") {
                return null
              }

              // 2. Manajemen User - super_admin ONLY
              if (item.label === "Manajemen User" && userRole !== "super_admin") {
                return null
              }

              // 3. Approval Yayasan - super_admin & admin_yayasan ONLY
              if (item.label === "Approval Yayasan" && !["super_admin", "admin_yayasan"].includes(userRole)) {
                return null
              }

              // Note: Master data menus (Schools/Teachers/Students) are accessible to operators
              // but data is automatically filtered to their assigned school

              return (
                <Link
                  key={index}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
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
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center gap-4 border-b bg-background px-6 shadow-sm">
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hidden md:flex">
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
      </div>
    </div>
  )
}
