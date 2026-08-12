import { ChevronRight } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { getBreadcrumbs } from "@/config/navigation"
import { cn } from "@/lib/utils"

export function Breadcrumbs({ className }: { className?: string }) {
  const location = useLocation()
  const crumbs = getBreadcrumbs(location.pathname)

  if (crumbs.length <= 1) return null

  return (
    <nav className={cn("flex items-center text-sm text-slate-500 mb-6", className)} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1

          return (
            <li key={index} className="flex items-center">
              {crumb.href && !isLast ? (
                <Link
                  to={crumb.href}
                  className="hover:text-emerald-600 transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className={cn(isLast ? "text-slate-900 font-semibold" : "")}>
                  {crumb.label}
                </span>
              )}
              
              {!isLast && (
                <ChevronRight className="h-4 w-4 mx-2 text-slate-400" />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
