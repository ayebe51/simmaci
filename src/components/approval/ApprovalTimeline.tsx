import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { CheckCircle, XCircle, MessageCircle, FileText, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { id } from "date-fns/locale"

interface ApprovalTimelineProps {
  documentId: string
}

export function ApprovalTimeline({ documentId }: ApprovalTimelineProps) {
  const history = useQuery(api.approvalHistory.getApprovalHistory, {
    documentId: documentId,
  })

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Belum ada riwayat approval</p>
      </div>
    )
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case "approve":
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case "reject":
        return <XCircle className="h-5 w-5 text-red-600" />
      case "comment":
        return <MessageCircle className="h-5 w-5 text-blue-600" />
      default:
        return <FileText className="h-5 w-5 text-gray-600" />
    }
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      submit: "Diajukan",
      approve: "Disetujui",
      reject: "Ditolak",
      comment: "Komentar",
      update: "Diupdate",
      review: "Direview",
    }
    return labels[action] || action
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case "approve":
        return "bg-green-100 border-green-300"
      case "reject":
        return "bg-red-100 border-red-300"
      case "comment":
        return "bg-blue-100 border-blue-300"
      default:
        return "bg-gray-100 border-gray-300"
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm mb-4">Riwayat Approval</h3>
      
      <div className="relative space-y-6">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />
        
        {history.map((item, index) => (
          <div key={item._id} className="relative flex gap-4">
            {/* Icon circle */}
            <div className={cn(
              "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2",
              getActionColor(item.action)
            )}>
              {getActionIcon(item.action)}
            </div>
            
            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">
                    {getActionLabel(item.action)}
                    {item.toStatus && item.fromStatus && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({item.fromStatus} → {item.toStatus})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.performedByName}
                    {item.performedByRole && (
                      <span className="ml-1">({item.performedByRole})</span>
                    )}
                  </p>
                </div>
                
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(item.performedAt), {
                    addSuffix: true,
                    locale: id,
                  })}
                </p>
              </div>
              
              {/* Comment/Reason */}
              {item.comment && (
                <div className="mt-2 rounded-md bg-gray-50 p-3 text-sm border border-gray-200">
                  <p className="text-gray-700">{item.comment}</p>
                </div>
              )}
              
              {/* Rejection reason from metadata */}
              {item.metadata?.rejectionReason && !item.comment && (
                <div className="mt-2 rounded-md bg-red-50 p-3 text-sm border border-red-200">
                  <p className="text-red-700">
                    <span className="font-medium">Alasan penolakan:</span> {item.metadata.rejectionReason}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
