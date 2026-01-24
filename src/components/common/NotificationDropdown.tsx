import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bell, FileCheck, CheckCheck, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { id } from "date-fns/locale"

export function NotificationDropdown() {
  const navigate = useNavigate()
  const [lastNotifId, setLastNotifId] = useState<string | null>(null)
  
  // Get user from localStorage
  const userStr = localStorage.getItem("user")
  const user = userStr ? JSON.parse(userStr) : null

  // 🐛 DEBUG: Log user info
  console.log("🔔 NotificationDropdown User:", {
    hasUser: !!user,
    userId: user?._id,
    userName: user?.name,
    userEmail: user?.email,
  })

  // Fetch notifications from Convex
  const notifications = useQuery(
    api.notifications.getRecentNotifications,
    user?._id ? { userId: user._id, limit: 10 } : "skip"
  )

  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    user?._id ? { userId: user._id } : "skip"
  )

  // 🐛 DEBUG: Log query results
  console.log("🔔 Notifications Query:", {
    notifications: notifications,
    notificationCount: notifications?.length,
    unreadCount: unreadCount,
    querySkipped: !user?._id,
  })

  // Mutations
  const markAsRead = useMutation(api.notifications.markAsRead)
  const markAllAsRead = useMutation(api.notifications.markAllAsRead)
  const deleteNotification = useMutation(api.notifications.deleteNotification)

  // Toast for new notifications
  useEffect(() => {
    if (!notifications || notifications.length === 0) return

    const latestNotif = notifications[0]
    const storedLastId = localStorage.getItem("lastNotifId")

    if (latestNotif._id !== storedLastId && latestNotif._id !== lastNotifId) {
      setLastNotifId(latestNotif._id)
      localStorage.setItem("lastNotifId", latestNotif._id)

      // Show toast for new notification
      toast.info(latestNotif.title, {
        description: latestNotif.message,
        action: {
          label: "Lihat",
          onClick: () => handleNotificationClick(latestNotif),
        },
      })
    }
  }, [notifications])

  const handleNotificationClick = async (notif: any) => {
    // Mark as read if unread
    if (!notif.isRead) {
      try {
        await markAsRead({ notificationId: notif._id })
      } catch (error) {
        console.error("Failed to mark as read:", error)
      }
    }

    // Navigate to relevant page
    if (notif.metadata?.skId) {
      navigate(`/dashboard/sk-management`)
    } else {
      navigate("/dashboard")
    }
  }

  const handleMarkAllRead = async () => {
    if (!user?._id) return
    
    try {
      await markAllAsRead({ userId: user._id })
      toast.success("Semua notifikasi ditandai sudah dibaca")
    } catch (error) {
      console.error("Failed to mark all as read:", error)
      toast.error("Gagal menandai semua sebagai dibaca")
    }
  }

  const handleDeleteNotif = async (notifId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    try {
      await deleteNotification({ notificationId: notifId })
      toast.success("Notifikasi dihapus")
    } catch (error) {
      console.error("Failed to delete notification:", error)
      toast.error("Gagal menghapus notifikasi")
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "sk_approved":
        return <FileCheck className="h-4 w-4 text-green-600" />
      case "sk_rejected":
        return <FileCheck className="h-4 w-4 text-red-600" />
      case "batch_complete":
        return <CheckCheck className="h-4 w-4 text-blue-600" />
      default:
        return <Bell className="h-4 w-4 text-gray-600" />
    }
  }

  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount !== undefined && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Pemberitahuan</DropdownMenuLabel>
          {unreadCount !== undefined && unreadCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-auto p-1 text-xs"
              onClick={handleMarkAllRead}
            >
              Tandai semua
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        {!notifications || notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              Tidak ada pemberitahuan
            </p>
          </div>
        ) : (
          notifications.map((notif) => (
            <DropdownMenuItem
              key={notif._id}
              className={`cursor-pointer flex-col items-start gap-2 p-3 ${
                !notif.isRead ? "bg-blue-50 hover:bg-blue-100" : ""
              }`}
              onClick={() => handleNotificationClick(notif)}
            >
              <div className="flex items-start gap-2 w-full">
                <div className="mt-1 rounded-full bg-white p-1.5 shadow-sm">
                  {getNotificationIcon(notif.type)}
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-none">
                      {notif.title}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-auto p-0.5 hover:bg-transparent"
                      onClick={(e) => handleDeleteNotif(notif._id, e)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notif.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notif.createdAt), {
                      addSuffix: true,
                      locale: id,
                    })}
                  </p>
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}

        {notifications && notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer justify-center text-center text-xs text-muted-foreground"
              onClick={() => navigate("/dashboard")}
            >
              Lihat dashboard
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
