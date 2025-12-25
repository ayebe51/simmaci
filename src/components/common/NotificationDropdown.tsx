import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bell, FileCheck } from "lucide-react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [hasUnread, setHasUnread] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // 1. Get User Role & Unit
    const userStr = localStorage.getItem("user")
    if (!userStr) return
    const user = JSON.parse(userStr)

    // 2. Get SK Data
    const teachersStr = localStorage.getItem("app_teachers")
    if (!teachersStr) return
    const teachers = JSON.parse(teachersStr)

    // 3. Filter for Notifications
    // Logic: Find SKs issued recently or relevant to user
    const limit = 5
    let relevantSks = teachers.filter((t: any) => t.lastSkNumber)

    if (user.role === 'operator' || user.role === 'admin') {
        // Operators only see their unit's SKs
        relevantSks = relevantSks.filter((t: any) => t.unitKerja === user.unitKerja)
    }

    // Sort by recent addition (simulated by array order for now, ideally timestamp)
    // We'll take last 5 reversed
    const recent = relevantSks.slice(-limit).reverse()

    const formattedNotifs = recent.map((t: any) => ({
        id: t.id,
        title: "SK Baru Terbit",
        desc: `No. ${t.lastSkNumber} - ${t.nama}`,
        time: "Baru saja", // Mock time
        type: "sk"
    }))

    setNotifications(formattedNotifs)
    setHasUnread(formattedNotifs.length > 0)

  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-600 border border-white" />
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Pemberitahuan</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
             <div className="p-4 text-center text-sm text-muted-foreground">
                Tidak ada pemberitahuan baru
             </div>
        ) : (
            notifications.map((notif, i) => (
                <DropdownMenuItem key={i} className="cursor-pointer" onClick={() => navigate("/dashboard/sk-saya")}>
                    <div className="flex items-start gap-2">
                        <div className="mt-1 rounded-full bg-blue-100 p-1 text-blue-600">
                            <FileCheck className="h-4 w-4" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">{notif.title}</p>
                            <p className="text-xs text-muted-foreground">{notif.desc}</p>
                        </div>
                    </div>
                </DropdownMenuItem>
            ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer justify-center text-center text-xs text-muted-foreground" onClick={() => navigate("/dashboard/sk-saya")}>
             Lihat semua aktivitas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
