import { useNavigate } from "react-router-dom"
import { LucideIcon } from "lucide-react"
import { Button } from "./button"
import { cn } from "@/lib/utils"

interface ActionButton {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "mint" | "cream" | "purple" | "blue"
}

interface SoftPageHeaderProps {
  title: string
  description?: string
  actions?: ActionButton[]
  className?: string
}

export default function SoftPageHeader({ title, description, actions, className }: SoftPageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-center md:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action, idx) => (
             <Button 
                key={idx}
                variant={action.variant as any}
                onClick={action.onClick}
                size="sm"
                className="gap-2 shadow-sm"
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
