import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bell, FileCheck, CheckCheck, Trash2, ShieldAlert, Zap, Loader2, Sparkles } from "lucide-react"
import { useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { notificationApi } from "@/lib/api"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { id } from "date-fns/locale"
import { cn } from "@/lib/utils"

export function NotificationDropdown() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const lastNotifIdRef = useRef<number | null>(null)
  
  // 🔥 REST API QUERIES
  const { data: notificationsRes, isLoading } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => notificationApi.list(),
    refetchInterval: 30000 // Poll every 30s
  })

  const { data: unreadRes } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationApi.unreadCount(),
    refetchInterval: 30000
  })

  const notifications = Array.isArray(notificationsRes) ? notificationsRes : (notificationsRes?.data || [])
  const unreadCount = unreadRes?.count ?? 0

  const handleNotificationClick = useCallback(async (notif: any) => {
    // Mark as read if unread
    if (!notif.read_at) {
      try {
        // Optimistic update: decrement badge immediately
        queryClient.setQueryData(['notifications-unread-count'], (old: any) => ({
          count: Math.max(0, (old?.count ?? 0) - 1)
        }))

        await notificationApi.markRead(notif.id)
        queryClient.invalidateQueries({ queryKey: ['notifications-list'] })
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
      } catch (error) {
        // Rollback: refetch dari server jika optimistic update gagal
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
        console.error("Failed to mark as read:", error)
      }
    }

    // Navigate to relevant page
    if (notif.data?.link) {
      navigate(notif.data.link)
    } else {
      navigate("/dashboard")
    }
  }, [navigate, queryClient])

  // Toast for new notifications
  useEffect(() => {
    if (!notifications || notifications.length === 0) return

    const latestNotif = notifications[0]
    const storedLastId = localStorage.getItem("lastNotifId")

    if (latestNotif.id.toString() !== storedLastId && latestNotif.id !== lastNotifIdRef.current) {
      lastNotifIdRef.current = latestNotif.id
      localStorage.setItem("lastNotifId", latestNotif.id.toString())

      if (!latestNotif.read_at) {
        toast.info(latestNotif.data.title, {
          description: latestNotif.data.message,
          action: {
            label: "Detail",
            onClick: () => handleNotificationClick(latestNotif),
          },
        })
      }
    }
  }, [notifications, handleNotificationClick])

  const handleMarkAllRead = async () => {
    try {
      // Optimistic update: clear badge immediately
      queryClient.setQueryData(['notifications-unread-count'], { count: 0 })

      await notificationApi.markAllRead()
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
      toast.success("Semua notifikasi ditandai sudah dibaca")
    } catch (error) {
      // Rollback: refetch dari server jika optimistic update gagal
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
      toast.error("Gagal menandai semua notifikasi sebagai dibaca")
    }
  }

  const getNotificationIcon = (type: string) => {
    const iconClass = "h-4 w-4"
    if (type === 'sk_approved') return <FileCheck className={cn(iconClass, "text-emerald-500")} />
    if (type === 'sk_rejected') return <ShieldAlert className={cn(iconClass, "text-rose-500")} />
    if (type === 'sk_submitted') return <Zap className={cn(iconClass, "text-blue-500")} />
    if (type.includes("sk_")) return <FileCheck className={cn(iconClass, "text-emerald-500")} />
    if (type.includes("mutation")) return <Zap className={cn(iconClass, "text-blue-500")} />
    return <Bell className={cn(iconClass, "text-slate-400")} />
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
          <Bell className="h-5 w-5 text-slate-600" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-rose-500 border-2 border-white text-white text-[8px] flex items-center justify-center font-black animate-in zoom-in duration-300">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] rounded-[2rem] p-0 overflow-hidden shadow-2xl border-0">
        <div className="bg-slate-50/50 p-6 border-b flex items-center justify-between">
            <div>
              <DropdownMenuLabel className="p-0 text-sm font-black uppercase italic tracking-tighter text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" /> System Broadcast
              </DropdownMenuLabel>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Real-time Activity Stream</p>
            </div>
            {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="h-9 px-4 rounded-xl border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all">
                    Read All
                </Button>
            )}
        </div>

        <div className="max-h-[450px] overflow-y-auto custom-scrollbar bg-white">
            {isLoading ? (
                <div className="p-20 text-center space-y-4">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto opacity-20" />
                    <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest italic">Syncing Feeds...</p>
                </div>
            ) : notifications.length === 0 ? (
                <div className="p-20 text-center space-y-6">
                    <div className="w-16 h-16 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto">
                        <ShieldAlert className="h-8 w-8 text-slate-200" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-black text-slate-300 uppercase italic tracking-tighter">Quiet Spectrum</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No active system events found.</p>
                    </div>
                </div>
            ) : (
                <div className="divide-y divide-slate-50">
                    {notifications.map((notif: any) => (
                        <DropdownMenuItem
                            key={notif.id}
                            className={cn(
                                "cursor-pointer p-6 flex items-start gap-4 transition-all focus:bg-slate-50",
                                !notif.read_at ? "bg-blue-50/30 border-l-4 border-blue-500" : "border-l-4 border-transparent"
                            )}
                            onClick={() => handleNotificationClick(notif)}
                        >
                            <div className="mt-1 w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center shrink-0">
                                {getNotificationIcon(notif.type)}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-start justify-between gap-4">
                                    <h4 className="text-xs font-black uppercase text-slate-800 leading-tight tracking-tight truncate">
                                        {notif.data.title}
                                    </h4>
                                    <span className="text-[8px] font-black text-slate-400 uppercase whitespace-nowrap">
                                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: id })}
                                    </span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic line-clamp-2">
                                    {notif.data.message}
                                </p>
                            </div>
                        </DropdownMenuItem>
                    ))}
                </div>
            )}
        </div>

        <div className="p-4 bg-slate-50/50 border-t">
            <Button variant="ghost" onClick={() => navigate("/dashboard")} className="w-full h-10 rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-blue-600 transition-colors">
                Open Command Center
            </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
