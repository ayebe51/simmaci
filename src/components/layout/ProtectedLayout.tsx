import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token")
  const isAuthenticated = !!token

  useEffect(() => {
    if (!token) {
      if(location.pathname !== "/login" && location.pathname !== "/") {
          toast.error("Sesi habis, silakan login kembali.")
          window.location.href = "/login"
      }
    }
  }, [location, token])

  if (isAuthenticated === null) {
      return null // Or a loader
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
