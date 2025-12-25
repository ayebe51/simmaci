import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, CheckCircle, FileText, AlertTriangle, XCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import StatusBadge from "@/components/shared/StatusBadge"
import type { StatusType } from "@/components/shared/StatusBadge"
import { useState } from "react"
import { Separator } from "@/components/ui/separator"

export default function SkDetailPage() {
  const navigate = useNavigate()
  // const { id } = useParams() // Use when API is ready
  
  // Simulated State (In real app, fetch by ID)
  const [currentStatus, setCurrentStatus] = useState<StatusType>("submitted") 
  const [isAdmin] = useState(true) // Simulate Admin Role

  const timelines = [
    { status: "draft", label: "Draft", date: "20 Mei 2024 09:00", active: true, completed: true },
    { status: "submitted", label: "Diajukan", date: "20 Mei 2024 10:30", active: true, completed: true },
    { status: "verified", label: "Verifikasi Admin", date: "21 Mei 2024 08:00", active: currentStatus === "verified" || currentStatus === "issued", completed: currentStatus === "issued" },
    { status: "issued", label: "SK Terbit", date: "-", active: currentStatus === "issued", completed: currentStatus === "issued" },
  ]

  const handleAction = (action: "approve" | "reject" | "revise") => {
      if (action === "approve") setCurrentStatus("issued")
      if (action === "reject") setCurrentStatus("rejected")
      if (action === "revise") setCurrentStatus("revision")
  }

  return (
    <div className="max-w-4xl space-y-6">
       <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/dashboard/sk")} className="pl-0">
                <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Button>
            <div className="flex gap-2">
                 {currentStatus === "issued" && (
                    <Button variant="outline" onClick={() => handleAction("revise")}>
                        <AlertTriangle className="mr-2 h-4 w-4 text-orange-500" /> Ajukan Revisi
                    </Button>
                 )}
                 <Button variant="outline">
                    <FileText className="mr-2 h-4 w-4" /> Download PDF
                 </Button>
            </div>
       </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl">SK Kepala Madrasah</CardTitle>
                            <CardDescription>Nomor: SK/2024/001</CardDescription>
                        </div>
                        <StatusBadge status={currentStatus} className="text-sm px-3 py-1" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">Nama Lengkap</p>
                            <p className="font-medium">Ahmad Dahlan</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Tanggal Pengajuan</p>
                            <p className="font-medium">20 Mei 2024</p>
                        </div>
                         <div>
                            <p className="text-muted-foreground">Unit Kerja</p>
                            <p className="font-medium">MI Ma'arif NU 01 Cilacap</p>
                        </div>
                         <div>
                            <p className="text-muted-foreground">Jenis Pengajuan</p>
                            <p className="font-medium">Perpanjangan</p>
                        </div>
                    </div>
                    
                    <Separator />

                    <div>
                        <h4 className="mb-2 font-semibold">Dokumen Lampiran</h4>
                        <div className="flex items-center justify-between rounded-md border p-3 hover:bg-slate-50 cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className="rounded bg-red-100 p-2">
                                    <FileText className="h-4 w-4 text-red-600" />
                                </div>
                                <div className="text-sm">
                                    <p className="font-medium">Surat_Permohonan.pdf</p>
                                    <p className="text-xs text-muted-foreground">2.4 MB</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm">Lihat</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Admin Actions Area (Only visible if Admin) */}
            {isAdmin && currentStatus === "submitted" && (
                 <Card className="border-blue-200 bg-blue-50/50">
                    <CardHeader>
                        <CardTitle className="text-lg">Tindakan Admin</CardTitle>
                        <CardDescription>Silakan verifikasi data sebelum menyetujui.</CardDescription>
                    </CardHeader>
                     <CardContent className="flex gap-3">
                        <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleAction("approve")}>
                            <CheckCircle className="mr-2 h-4 w-4" /> Setujui & Terbitkan
                        </Button>
                        <Button variant="destructive" onClick={() => handleAction("reject")}>
                            <XCircle className="mr-2 h-4 w-4" /> Tolak
                        </Button>
                     </CardContent>
                 </Card>
            )}
        </div>

        {/* Timeline */}
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="text-base">Riwayat Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative border-l border-slate-200 ml-3 space-y-8 pb-1">
                        {timelines.map((item, i) => (
                             <div key={i} className="relative pl-6">
                                <span className={`absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border ring-4 ring-white ${item.completed ? 'bg-primary border-primary' : 'bg-slate-300 border-slate-300'}`} />
                                <div className="flex flex-col">
                                    <span className={`text-sm font-medium ${item.completed ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>
                                    <span className="text-xs text-muted-foreground">{item.date}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
             </Card>
        </div>
      </div>
    </div>
  )
}
