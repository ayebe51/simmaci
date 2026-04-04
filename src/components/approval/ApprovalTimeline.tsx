import { CheckCircle, XCircle, MessageCircle, FileText, Clock, ShieldCheck, User, Zap, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { id } from "date-fns/locale"
import { useQuery } from "@tanstack/react-query"
import { approvalApi } from "@/lib/api"
import { Badge } from "@/components/ui/badge"

interface ApprovalTimelineProps {
  documentId: string
}

export function ApprovalTimeline({ documentId }: ApprovalTimelineProps) {
  // 🔥 REST API QUERY
  const { data: history, isLoading } = useQuery({
    queryKey: ['approval-history', documentId],
    queryFn: () => approvalApi.getHistory(documentId),
    enabled: !!documentId
  })

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center py-12 gap-4 animate-pulse">
            <Clock className="w-8 h-8 text-blue-200" />
            <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest italic">Retrieving audit trail...</p>
        </div>
    )
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-16 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
        <Clock className="h-12 w-12 mx-auto mb-4 text-slate-200" />
        <div className="space-y-1">
            <h4 className="text-sm font-black text-slate-400 uppercase italic tracking-tighter">No History Detected</h4>
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Document has not entered the approval spectrum.</p>
        </div>
      </div>
    )
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case "approve":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />
      case "reject":
        return <XCircle className="h-4 w-4 text-rose-500" />
      case "comment":
        return <MessageCircle className="h-4 w-4 text-blue-500" />
      case "submit":
          return <ShieldCheck className="h-4 w-4 text-indigo-500" />
      default:
        return <FileText className="h-4 w-4 text-slate-400" />
    }
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      submit: "Submission",
      approve: "Approval Granted",
      reject: "Request Denied",
      comment: "System Annotation",
      update: "Revision Dispatched",
      review: "Node Review",
    }
    return labels[action]?.toUpperCase() || action.toUpperCase()
  }

  const getActionColor: any = {
    approve: "bg-emerald-50 border-emerald-100 shadow-emerald-50",
    reject: "bg-rose-50 border-rose-100 shadow-rose-50",
    comment: "bg-blue-50 border-blue-100 shadow-blue-50",
    submit: "bg-indigo-50 border-indigo-100 shadow-indigo-50",
    default: "bg-slate-50 border-slate-100 shadow-slate-50"
  }

  return (
    <div className="space-y-8 p-1">
      <div className="flex items-center justify-between">
          <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest italic flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" /> Governance Audit Trail
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Historical lifecycle of this document node</p>
          </div>
      </div>
      
      <div className="relative space-y-10 pl-6">
        {/* Vertical Aesthetic Line */}
        <div className="absolute left-[31px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-blue-100 via-slate-100 to-transparent" />
        
        {history.map((item: any, index: number) => (
          <div key={item.id} className="relative flex gap-6 group">
            {/* Icon Node */}
            <div className={cn(
              "relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm",
              getActionColor[item.action] || getActionColor.default
            )}>
              {getActionIcon(item.action)}
            </div>
            
            {/* Content Segment */}
            <div className="flex-1 space-y-3 pt-1">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                      <h4 className="text-[11px] font-black text-slate-900 tracking-tight italic">
                        {getActionLabel(item.action)}
                      </h4>
                      {item.to_status && (
                        <Badge variant="outline" className="h-5 px-2 rounded-md bg-white border-slate-200 text-[8px] font-black uppercase text-slate-500">
                            {item.to_status}
                        </Badge>
                      )}
                  </div>
                  <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="w-2.5 h-2.5 text-slate-400" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {item.performed_by_name || 'System Operator'}
                        <span className="ml-1 opacity-50">• {item.performed_by_role || 'Auth'}</span>
                      </p>
                  </div>
                </div>
                
                <span className="text-[9px] font-black text-slate-300 uppercase italic whitespace-nowrap pt-1">
                  {formatDistanceToNow(new Date(item.performed_at || item.created_at), {
                    addSuffix: true,
                    locale: id,
                  })}
                </span>
              </div>
              
              {/* Comment / Rationalization */}
              {(item.comment || item.metadata?.rejection_reason) && (
                <div className={cn(
                    "rounded-[1.5rem] p-5 text-[11px] font-bold leading-relaxed border transition-all",
                    item.action === 'reject' ? "bg-rose-50/50 border-rose-100 text-rose-700 italic" : "bg-slate-50/50 border-slate-100 text-slate-600"
                )}>
                  {item.comment || item.metadata?.rejection_reason}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
