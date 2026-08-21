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
  icon?: React.ReactNode
  actions?: ActionButton[]
  className?: string
}

export default function SoftPageHeader({ title, description, icon, actions, className }: SoftPageHeaderProps) {
  const visibleActionsCount = 2
  const hasOverflow = actions && actions.length > visibleActionsCount

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2 truncate">
          {icon && <span className="text-emerald-600">{icon}</span>}
          {title}
        </h1>
        {description && <p className="text-sm text-slate-500 mt-1 truncate">{description}</p>}
      </div>
      
      {actions && actions.length > 0 && (
        <>
          {/* Desktop View: Show all actions */}
          <div className="hidden sm:flex flex-wrap items-center gap-1.5 shrink-0">
            {actions.map((action, idx) => (
               <Button 
                  key={idx}
                  variant={action.variant as any}
                  onClick={action.onClick}
                  size="sm"
                  className="gap-1.5 shadow-sm text-xs h-8 px-3 rounded-xl"
               >
                  {action.icon}
                  {action.label}
               </Button>
            ))}
          </div>

          {/* Mobile View: Primary CTA + Dropdown Overflow */}
          <div className="flex sm:hidden items-center gap-1.5 shrink-0">
            {actions.slice(0, hasOverflow ? visibleActionsCount : actions.length).map((action, idx) => (
               <Button 
                  key={idx}
                  variant={action.variant as any}
                  onClick={action.onClick}
                  size="sm"
                  className="gap-1.5 shadow-sm text-xs h-8 px-2.5 rounded-xl flex-1 text-center justify-center"
               >
                  {action.icon}
                  <span className="truncate">{action.label}</span>
               </Button>
            ))}

            {hasOverflow && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-xl shrink-0">
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
        </>
      )}
    </div>
  )
}
