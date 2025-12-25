import { cn } from "@/lib/utils"

export type StatusType = "draft" | "submitted" | "verified" | "issued" | "rejected" | "revision"

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700 hover:bg-slate-200" },
  submitted: { label: "Diajukan", className: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
  verified: { label: "Terverifikasi", className: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" },
  issued: { label: "Terbit", className: "bg-green-100 text-green-700 hover:bg-green-200" },
  rejected: { label: "Ditolak", className: "bg-red-100 text-red-700 hover:bg-red-200" },
  revision: { label: "Revisi", className: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
