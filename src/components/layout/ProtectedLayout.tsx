import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const token = localStorage.getItem("auth_token")
  const isAuthenticated = !!token

  useEffect(() => {
    if (!isAuthenticated) {
      if(location.pathname !== "/login" && location.pathname !== "/") {
          toast.error("Sesi habis, silakan login kembali.")
      }
    }
  }, [location.pathname, isAuthenticated])

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
