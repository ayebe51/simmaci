import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useState, useMemo } from "react"
import { Send, CheckCircle, Smartphone } from "lucide-react"

interface Teacher {
    id: string
    nama: string
    nuptk: string
    phoneNumber?: string
}

interface BroadcastModalProps {
    isOpen: boolean
    onClose: () => void
    recipients: Teacher[]
}

export default function BroadcastModal({ isOpen, onClose, recipients }: BroadcastModalProps) {
    const [template, setTemplate] = useState("Assalamu'alaikum {nama}, mohon segera update data di SIM Ma'arif.")
    const [sentIds, setSentIds] = useState<Set<string>>(new Set())

    // Filter Recipients with Phone Numbers
    const validRecipients = useMemo(() => {
        return recipients.filter(r => r.phoneNumber && r.phoneNumber.length > 5)
    }, [recipients])

    const invalidCount = recipients.length - validRecipients.length

    // Helper to format phone (08 -> 628)
    const formatPhone = (phone: string) => {
        let p = phone.replace(/\D/g, '') // remove non-digits
        if (p.startsWith('0')) {
            p = '62' + p.substring(1)
        }
        return p
    }

    // Helper to generate link
    const getWaLink = (teacher: Teacher) => {
        if (!teacher.phoneNumber) return "#"
        const phone = formatPhone(teacher.phoneNumber)
        const text = template
            .replace(/{nama}/g, teacher.nama)
            .replace(/{nuptk}/g, teacher.nuptk || "-")
        
        return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    }

    const markAsSent = (id: string) => {
        const newSet = new Set(sentIds)
        newSet.add(id)
        setSentIds(newSet)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Smartphone className="h-5 w-5 text-green-500" />
                        Broadcast WhatsApp ({validRecipients.length} Penerima)
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full overflow-hidden">
                    {/* LEFT: Composer */}
                    <div className="flex flex-col gap-4">
                        <div>
                            <Label>Pesan Template</Label>
                            <Textarea 
                                value={template}
                                onChange={e => setTemplate(e.target.value)}
                                className="h-[200px] mt-2"
                                placeholder="Tulis pesan di sini..."
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                Gunakan <b>&#123;nama&#125;</b> untuk nama guru, <b>&#123;nuptk&#125;</b> untuk NUPTK.
                            </p>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-md border">
                            <Label className="text-xs font-semibold text-slate-500 uppercase">Preview (Contoh Pertama)</Label>
                            <div className="mt-2 text-sm whitespace-pre-wrap bg-white p-3 rounded border">
                                {validRecipients.length > 0 ? (
                                    template
                                        .replace(/{nama}/g, validRecipients[0].nama)
                                        .replace(/{nuptk}/g, validRecipients[0].nuptk || "-")
                                ) : "Belum ada penerima valid."}
                            </div>
                        </div>

                        {invalidCount > 0 && (
                            <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                                ⚠️ {invalidCount} guru tidak memiliki nomor HP dan dilewati.
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Queue */}
                    <div className="flex flex-col border rounded-md overflow-hidden h-full">
                        <div className="bg-muted p-2 text-sm font-medium text-center border-b">
                            Antrian Pengiriman ({sentIds.size}/{validRecipients.length} Terkirim)
                        </div>
                        <div className="flex-1 bg-slate-50 overflow-y-auto">
                            <div className="p-2 space-y-2">
                                {validRecipients.map((teacher, idx) => {
                                    const isSent = sentIds.has(teacher.id)
                                    return (
                                        <div key={teacher.id} className={`flex items-center justify-between p-3 rounded-lg border ${isSent ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm truncate max-w-[150px]">
                                                    {idx + 1}. {teacher.nama}
                                                </span>
                                                <span className="text-xs text-muted-foreground">{teacher.phoneNumber}</span>
                                            </div>
                                            
                                            {isSent ? (
                                                <Button size="sm" variant="ghost" className="text-green-600 cursor-default hover:bg-green-100">
                                                    <CheckCircle className="h-4 w-4 mr-1" /> Terkirim
                                                </Button>
                                            ) : (
                                                <a 
                                                    href={getWaLink(teacher)} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    onClick={() => markAsSent(teacher.id)}
                                                >
                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                                                        <Send className="h-3 w-3 mr-1" /> Kirim
                                                    </Button>
                                                </a>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Tutup</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
