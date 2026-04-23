import { useNavigate } from "react-router-dom"
import { LucideIcon } from "lucide-react"
import { Button } from "./button"
import { cn } from "@/lib/utils"

interface ActionButton {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "mint" | "cream" | "purple" | "blue" | "orange"
}

interface SoftPageHeaderProps {
  title: string
  description?: string
  actions?: ActionButton[]
  className?: string
}

export default function SoftPageHeader({ title, description, actions, className }: SoftPageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-gray-900 truncate">{title}</h1>
        {description && <p className="text-xs text-gray-500 mt-0.5 truncate">{description}</p>}
      </div>
      
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {actions.map((action, idx) => (
             <Button 
                key={idx}
                variant={action.variant as any}
                onClick={action.onClick}
                size="sm"
                className="gap-1.5 shadow-sm text-xs h-8 px-3"
             >
                {action.icon}
                {action.label}
             </Button>
          ))}
        </div>
      )}
    </div>
  )
}
