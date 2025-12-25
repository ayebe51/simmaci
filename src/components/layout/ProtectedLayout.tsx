import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const location = useLocation()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      setIsAuthenticated(false)
      // Only toast if we were trying to access a specific page and got booted
      if(location.pathname !== "/login" && location.pathname !== "/") {
          toast.error("Sesi habis, silakan login kembali.")
      }
    } else {
      setIsAuthenticated(true)
    }
  }, [location])

  if (isAuthenticated === null) {
      return null // Or a loader
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
