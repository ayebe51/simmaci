import { MoreHorizontal } from "lucide-react"
import { Button } from "./button"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ActionButton {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "mint" | "cream" | "purple" | "blue" | "orange"
}

interface SoftPageHeaderProps {
  title: string
  description?: string
  category?: string
  icon?: React.ReactNode
  actions?: ActionButton[]
  className?: string
}

export default function SoftPageHeader({ title, description, category, icon, actions, className }: SoftPageHeaderProps) {
  const visibleActionsCount = 2
  const hasOverflow = actions && actions.length > visibleActionsCount

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-r from-white/95 via-slate-50/60 to-emerald-50/30 p-5 sm:px-6 sm:py-5 backdrop-blur-md shadow-sm shadow-slate-100/60 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between transition-all duration-200",
        className
      )}
    >
      {/* Decorative ambient subtle glow */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-start sm:items-center gap-3.5 min-w-0 z-10">
        {icon && (
          <div className="w-11 h-11 rounded-xl bg-emerald-50/90 border border-emerald-200/60 text-emerald-600 flex items-center justify-center shrink-0 shadow-inner">
            {icon}
          </div>
        )}
        <div className="min-w-0 space-y-0.5">
          {category && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100/60 border border-emerald-200/50 text-[10px] font-black uppercase tracking-widest text-emerald-800 mb-1">
              {category}
            </div>
          )}
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 truncate">
            {title}
          </h1>
          {description && <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed truncate">{description}</p>}
        </div>
      </div>
      
      {actions && actions.length > 0 && (
        <div className="z-10 shrink-0">
          {/* Desktop View: Show all actions */}
          <div className="hidden sm:flex flex-wrap items-center gap-2 shrink-0">
            {actions.map((action, idx) => (
               <Button 
                  key={idx}
                  variant={action.variant as any}
                  onClick={action.onClick}
                  size="sm"
                  className="gap-1.5 shadow-sm text-xs h-9 px-4 rounded-xl font-semibold transition-all duration-150"
               >
                  {action.icon}
                  {action.label}
               </Button>
            ))}
          </div>

          {/* Mobile View: Primary CTA + Dropdown Overflow */}
          <div className="flex sm:hidden items-center gap-2 shrink-0 w-full">
            {actions.slice(0, hasOverflow ? visibleActionsCount : actions.length).map((action, idx) => (
               <Button 
                  key={idx}
                  variant={action.variant as any}
                  onClick={action.onClick}
                  size="sm"
                  className="gap-1.5 shadow-sm text-xs h-9 px-3 rounded-xl flex-1 text-center justify-center font-semibold"
               >
                  {action.icon}
                  <span className="truncate">{action.label}</span>
               </Button>
            ))}

            {hasOverflow && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0 rounded-xl shrink-0">
                    <MoreHorizontal className="h-4 w-4 text-slate-600" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl">
                  {actions.slice(visibleActionsCount).map((action, idx) => (
                    <DropdownMenuItem
                      key={idx}
                      onClick={action.onClick}
                      className="gap-2 text-xs font-medium cursor-pointer"
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
