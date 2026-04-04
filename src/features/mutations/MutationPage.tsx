import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { ArrowRightLeft, Search, History, Loader2, UserCircle2, Building2, Calendar, FileType2, ShieldCheck } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useQuery, useMutation } from "@tanstack/react-query"
import { mutationApi, teacherApi, schoolApi } from "@/lib/api"
import { cn } from "@/lib/utils"

export default function MutationPage() {
  const [isOpen, setIsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Selection State
  const [selectedTeacher, setSelectedTeacher] = useState<string>("")
  const [selectedSchool, setSelectedSchool] = useState<string>("")
  
  // Form State
  const [formData, setFormData] = useState({
    skNumeric: "",
    reason: "",
    effectiveDate: new Date().toISOString().split('T')[0]
  })

  // 🔥 REST API QUERIES
  const { data: mutationsRes, isLoading: isLoadingMutations, refetch: refetchMutations } = useQuery({
    queryKey: ['teacher-mutations'],
    queryFn: () => mutationApi.list()
  })

  const { data: schoolsRes } = useQuery({
    queryKey: ['schools-mutation'],
    queryFn: () => schoolApi.list({ per_page: 500 })
  })

  const { data: teachersRes } = useQuery({
    queryKey: ['teachers-mutation'],
    queryFn: () => teacherApi.list({ per_page: 1000 })
  })

  const mutations = mutationsRes || []
  const schools = schoolsRes?.data || []
  const teachers = teachersRes?.data || []

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!selectedTeacher || !selectedSchool || !formData.skNumeric) {
          toast.error("Parameter mutasi belum lengkap")
          return
      }
      
      setIsProcessing(true)
      try {
          await mutationApi.move({
              teacher_id: parseInt(selectedTeacher),
              to_school_id: parseInt(selectedSchool),
              sk_number: formData.skNumeric,
              reason: formData.reason,
              effective_date: formData.effectiveDate
          })
          
          toast.success("Protokol mutasi berhasil dijalankan")
          setIsOpen(false)
          setFormData({
              skNumeric: "",
              reason: "",
              effectiveDate: new Date().toISOString().split('T')[0]
          })
          setSelectedTeacher("")
          setSelectedSchool("")
          refetchMutations()
      } catch (err: any) {
          toast.error(err.response?.data?.message || "Gagal memproses mutasi")
      } finally {
          setIsProcessing(false)
      }
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic">Personnel Mutation</h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
               <ArrowRightLeft className="w-3 h-3 text-emerald-500" /> Manajemen Perpindahan Tugas & Dinamika Institusi
            </p>
        </div>
        
        <Button onClick={() => setIsOpen(true)} className="h-14 rounded-2xl px-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-100">
            <ArrowRightLeft className="w-5 h-5 mr-3" /> Execute Mutation
        </Button>
      </div>

      <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="p-10 border-b bg-slate-50/50">
              <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3 italic">
                <History className="h-5 w-5 text-blue-500"/> Audit Trail Mutasi
              </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
             <Table>
                 <TableHeader className="bg-slate-50/80 border-b border-slate-100">
                     <TableRow>
                         <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Aktor Pendidik</TableHead>
                         <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Rute Mutasi</TableHead>
                         <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Otorisasi SK</TableHead>
                         <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Berlaku (TMT)</TableHead>
                         <TableHead className="p-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">Alasan / Note</TableHead>
                     </TableRow>
                 </TableHeader>
                 <TableBody>
                    {isLoadingMutations ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-24 animate-pulse uppercase font-black text-slate-200 text-xs italic tracking-widest">Retrieving Personnel Dynamics...</TableCell></TableRow>
                    ) : mutations.length === 0 ? (
                         <TableRow>
                             <TableCell colSpan={5} className="text-center py-24 font-bold text-slate-300 text-xs italic tracking-widest uppercase">
                                 System has no active mutation records.
                             </TableCell>
                         </TableRow>
                     ) : (
                         mutations.map((m: any) => (
                             <TableRow key={m.id} className="hover:bg-slate-50/30 transition-colors group">
                                 <TableCell className="p-8">
                                     <div className="flex items-center gap-4">
                                         <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                             <UserCircle2 className="w-5 h-5" />
                                         </div>
                                         <div>
                                            <div className="font-black text-slate-800 text-xs tracking-tight uppercase">{m.teacher?.nama}</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">ID: {m.teacher?.nuptk || '-'}</div>
                                         </div>
                                     </div>
                                 </TableCell>
                                 <TableCell className="p-8">
                                     <div className="flex flex-col gap-1">
                                        <div className="text-[10px] font-bold text-rose-400 line-through uppercase">{m.from_unit}</div>
                                        <div className="text-xs font-black text-emerald-600 uppercase flex items-center gap-2">
                                            <Building2 className="w-3 h-3" /> {m.to_unit}
                                        </div>
                                     </div>
                                 </TableCell>
                                 <TableCell className="p-8 font-black text-slate-600 text-[10px] tracking-tighter italic">#{m.sk_number}</TableCell>
                                 <TableCell className="p-8">
                                     <div className="flex items-center gap-2 font-bold text-slate-500 text-[10px] uppercase">
                                         <Calendar className="w-3 h-3 text-blue-500" /> {new Date(m.effective_date).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'})}
                                     </div>
                                 </TableCell>
                                 <TableCell className="p-8">
                                     <div className="text-[10px] font-bold text-slate-400 max-w-[200px] leading-relaxed italic">"{m.reason || 'Kebutuhan Institusi'}"</div>
                                     <div className="text-[8px] font-black text-slate-300 uppercase mt-1">By: {m.performed_by || 'System'}</div>
                                 </TableCell>
                             </TableRow>
                         ))
                     )}
                 </TableBody>
             </Table>
          </div>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-2xl rounded-[2.5rem] p-10 border-0 shadow-2xl">
              <DialogHeader>
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">Protokol Mutasi Guru</DialogTitle>
                  <DialogDescription className="font-bold text-slate-400 text-[10px] uppercase tracking-widest">Konfigurasi Perpindahan Entitas Pendidik Antar Unit</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-10 py-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Target Pendidik</Label>
                          <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                              <SelectTrigger className="h-14 rounded-2xl border-slate-200 font-bold">
                                  <SelectValue placeholder="Pilih Pendidik..." />
                              </SelectTrigger>
                              <SelectContent className="rounded-2xl max-h-64">
                                  {teachers.map((t: any) => (
                                      <SelectItem key={t.id} value={t.id.toString()}>
                                          {t.nama} <span className="opacity-40 italic text-[10px]">[{t.school?.nama || 'Global'}]</span>
                                      </SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                       </div>
                       
                       <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Destinasi Unit Baru</Label>
                          <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                              <SelectTrigger className="h-14 rounded-2xl border-slate-200 font-bold">
                                  <SelectValue placeholder="Unit Tujuan..." />
                              </SelectTrigger>
                              <SelectContent className="rounded-2xl max-h-64">
                                  {schools.map((s: any) => (
                                      <SelectItem key={s.id} value={s.id.toString()}>
                                          {s.nama} <span className="opacity-40 italic text-[10px]">({s.kecamatan})</span>
                                      </SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                       </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Nomor Registrasi SK</Label>
                          <Input 
                              value={formData.skNumeric} 
                              onChange={e => setFormData(p => ({...p, skNumeric: e.target.value}))}
                              required 
                              className="h-14 rounded-2xl border-slate-200 font-bold placeholder:font-normal"
                              placeholder="SK/MUTASI/..."
                          />
                      </div>
                      <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Tanggal Berlaku (TMT)</Label>
                          <Input 
                              type="date"
                              value={formData.effectiveDate} 
                              onChange={e => setFormData(p => ({...p, effectiveDate: e.target.value}))}
                              required 
                              className="h-14 rounded-2xl border-slate-200 font-bold"
                          />
                      </div>
                  </div>

                  <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Keterangan / Alasan Mutasi</Label>
                      <Input 
                          value={formData.reason} 
                          onChange={e => setFormData(p => ({...p, reason: e.target.value}))}
                          className="h-14 rounded-2xl border-slate-200 font-bold"
                          placeholder="Ex: Delegasi Organisasi / Kebutuhan Struktur"
                      />
                  </div>

                  <DialogFooter className="gap-4">
                      <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400">Abort Operation</Button>
                      <Button type="submit" disabled={isProcessing} className="h-14 px-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100">
                          {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : 'Confirm & Move'}
                      </Button>
                  </DialogFooter>
              </form>
          </DialogContent>
      </Dialog>
    </div>
  )
}
