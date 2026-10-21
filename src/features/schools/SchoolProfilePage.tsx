import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { schoolApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { Save, Building2, Loader2, Calculator, GraduationCap } from "lucide-react"
import HeadmasterProfileForm from "./components/HeadmasterProfileForm"
import { getGradeLevelsForSchool } from "@/features/master-data/components/readiness/readinessConstants"

import { Badge } from "@/components/ui/badge"
import { Lock, LockOpen } from "lucide-react"

export default function SchoolProfilePage() {
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    alamat: "",
    telepon: "",
    email: "",
    akreditasi: "",
    npsn: "",
    npsmnu: "",
    status_jamiyyah: "",
    nsm: "",
    jumlah_siswa_manual: ""
  })

  const [perClassCounts, setPerClassCounts] = useState<Record<string, string>>({})

  // 🔥 REST API QUERY
  const { data: school, isLoading } = useQuery({
    queryKey: ['school-profile-me'],
    queryFn: () => schoolApi.profile()
  })

  const gradeLevels = useMemo(() => {
    return getGradeLevelsForSchool(school?.jenjang, school?.nama)
  }, [school])

  useEffect(() => {
    if (school) {
      setFormData({
        alamat: school.alamat || "",
        telepon: school.telepon || "",
        email: school.email || "",
        akreditasi: school.akreditasi || "",
        npsn: school.npsn || "",
        npsmnu: school.npsm_nu || "",
        status_jamiyyah: school.status_jamiyyah || "",
        nsm: school.nsm || "",
        jumlah_siswa_manual: school.jumlah_siswa_manual !== null && school.jumlah_siswa_manual !== undefined ? String(school.jumlah_siswa_manual) : ""
      })

      if (gradeLevels && gradeLevels.length > 0) {
        const initialMap: Record<string, string> = {}
        const existing = school.jumlah_siswa_per_kelas || {}
        gradeLevels.forEach((lvl: string) => {
          const val = existing[lvl] ?? existing[lvl.replace('Kelas ', '')] ?? ''
          initialMap[lvl] = val !== '' && val !== null && val !== undefined ? String(val) : ''
        })
        setPerClassCounts(initialMap)
      }
    }
  }, [school, gradeLevels])

  const autoSumStudents = useMemo(() => {
    if (!gradeLevels) return 0
    let sum = 0
    Object.values(perClassCounts).forEach((val) => {
      const parsed = parseInt(val, 10)
      if (!isNaN(parsed) && parsed > 0) sum += parsed
    })
    return sum
  }, [perClassCounts, gradeLevels])

  const handlePerClassChange = (lvl: string, value: string) => {
    setPerClassCounts(prev => ({ ...prev, [lvl]: value }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const updateMutation = useMutation({
    mutationFn: (data: any) => {
      // Map frontend field name to DB column name
      const payload: any = {
        ...data,
        npsm_nu: data.npsmnu,
      }
      delete payload.npsmnu

      if (gradeLevels && gradeLevels.length > 0) {
        const cleanedPerClass: Record<string, number> = {}
        let sum = 0
        gradeLevels.forEach((lvl: string) => {
          const raw = perClassCounts[lvl]
          const num = parseInt(raw, 10)
          if (!isNaN(num) && num > 0) {
            cleanedPerClass[lvl] = num
            sum += num
          }
        })
        payload.jumlah_siswa_per_kelas = Object.keys(cleanedPerClass).length > 0 ? cleanedPerClass : null
        payload.jumlah_siswa_manual = Object.keys(cleanedPerClass).length > 0 ? sum : null
      } else {
        payload.jumlah_siswa_manual = data.jumlah_siswa_manual === "" ? null : parseInt(data.jumlah_siswa_manual, 10)
      }

      return schoolApi.update(school.id, payload)
    },
    onSuccess: (updated) => {
      toast.success("Profil sekolah berhasil diperbarui!")
      
      // Invalidate queries to trigger automatic refetch
      queryClient.invalidateQueries({ queryKey: ['school-profile-me'] })
      queryClient.invalidateQueries({ queryKey: ['school-profile'] })
      queryClient.invalidateQueries({ queryKey: ['school', school.id] })
      
      // Update form directly from response to ensure UI reflects saved data
      if (updated) {
        setFormData({
          alamat: updated.alamat || "",
          telepon: updated.telepon || "",
          email: updated.email || "",
          akreditasi: updated.akreditasi || "",
          npsn: updated.npsn || "",
          npsmnu: updated.npsm_nu || "",
          status_jamiyyah: updated.status_jamiyyah || "",
          nsm: updated.nsm || "",
          jumlah_siswa_manual: updated.jumlah_siswa_manual !== null && updated.jumlah_siswa_manual !== undefined ? String(updated.jumlah_siswa_manual) : ""
        })

        if (gradeLevels && gradeLevels.length > 0) {
          const initialMap: Record<string, string> = {}
          const existing = updated.jumlah_siswa_per_kelas || {}
          gradeLevels.forEach((lvl: string) => {
            const val = existing[lvl] ?? existing[lvl.replace('Kelas ', '')] ?? ''
            initialMap[lvl] = val !== '' && val !== null && val !== undefined ? String(val) : ''
          })
          setPerClassCounts(initialMap)
        }
      }
    },
    onError: (err: any) => toast.error("Gagal update: " + (err.response?.data?.message || err.message))
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(formData)
  }

  if (isLoading) return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Memuat Profil Sekolah...</span>
    </div>
  )

  if (!school) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="p-10 bg-white border-0 shadow-sm rounded-[2.5rem] text-center max-w-md">
           <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
               <Building2 className="h-8 w-8 text-red-500" />
           </div>
           <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Profil Tidak Ditemukan</h3>
           <p className="text-sm font-medium text-slate-400 mb-6">
             Akun Anda tidak terhubung dengan data madrasah manapun. Hubungi Admin Kabupaten.
           </p>
           <Button variant="outline" onClick={() => window.location.reload()} className="rounded-xl font-bold uppercase text-[10px] tracking-widest">
             Coba Lagi
           </Button>
        </div>
      </div>
    )
  }

  const isUnlocked = school.sk_submission_unlocked === true
  const isRaTk = (school.jenjang || "").toUpperCase().includes("RA") || (school.jenjang || "").toUpperCase().includes("TK")

  return (
    <div className="space-y-10 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Profil Madrasah</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
             Kelola Identitas Resmi & Informasi Operasional <span className="text-blue-600">{school.nama}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase">Izin Pengajuan SK:</span>
          {isRaTk ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Selalu Dibuka (RA/TK)</Badge>
          ) : isUnlocked ? (
            <Badge className="bg-emerald-500 text-white flex items-center gap-1"><LockOpen className="w-3 h-3" /> Dibuka Khusus</Badge>
          ) : (
            <Badge className="bg-amber-500 text-white flex items-center gap-1"><Lock className="w-3 h-3" /> Sesuai Jadwal Jam</Badge>
          )}
        </div>
      </div>

      {/* Profil Kepala Madrasah - Separate form (not nested) */}
      <HeadmasterProfileForm
        school={school}
        onSuccess={() => {}}
        onCancel={() => {}}
        isAdminMode={false}
      />

      <form onSubmit={handleSubmit} className="grid gap-10">
        <div className="grid gap-10 md:grid-cols-2">
            {/* Identitas Utama (Merged Card) */}
            <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden md:col-span-2">
              <CardHeader className="p-10 border-b bg-slate-50/50">
                <CardTitle className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Building2 className="h-5 w-5" /></div>
                  Identitas & Atribut Lembaga
                </CardTitle>
                <CardDescription className="text-xs font-medium text-slate-400">Data fundamental madrasah. Hubungi Admin jika ada kesalahan data permanen.</CardDescription>
              </CardHeader>
              <CardContent className="p-10 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2 lg:col-span-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nama Resmi Madrasah</Label>
                        <Input value={school.nama} disabled className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold text-slate-500" />
                    </div>
                    <div className="space-y-2 lg:col-span-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Update Terakhir</Label>
                        <Input value={school.updated_at ? new Date(school.updated_at).toLocaleDateString('id-ID') : '-'} disabled className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold text-slate-500" />
                    </div>
                    
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">NSM</Label>
                        <Input value={school.nsm} disabled className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold text-slate-500" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">NPSN</Label>
                        <Input name="npsn" value={formData.npsn} onChange={handleChange} className="h-12 rounded-xl border-slate-200 font-bold" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-blue-600">NPSMNU (Nomor Induk NU)</Label>
                        <Input name="npsmnu" value={formData.npsmnu} onChange={handleChange} placeholder="No Induk NU" className="h-12 rounded-xl border-blue-100 bg-blue-50/10 font-bold" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Akreditasi</Label>
                        <Input name="akreditasi" value={formData.akreditasi} onChange={handleChange} placeholder="A / B / C" className="h-12 rounded-xl border-slate-200 font-bold" />
                    </div>

                    <div className="space-y-2 lg:col-span-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Status Afiliasi (Jam'iyyah / Jamaah)</Label>
                        <Input name="status_jamiyyah" value={formData.status_jamiyyah} onChange={handleChange} placeholder="Contoh: Jam'iyyah" className="h-12 rounded-xl border-slate-200 font-bold" />
                    </div>

                    {gradeLevels && gradeLevels.length > 0 ? (
                      <div className="space-y-4 lg:col-span-4 p-5 rounded-2xl bg-emerald-50/40 border border-emerald-100">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4 text-emerald-700" />
                              <Label className="text-[11px] font-black uppercase text-emerald-900 tracking-wider">
                                Input Jumlah Siswa Per Tingkat Kelas
                              </Label>
                              <Badge variant="outline" className="text-[10px] bg-white border-emerald-200 text-emerald-700 font-semibold">
                                {school.jenjang || 'Madrasah Formal'}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Masukkan jumlah siswa untuk masing-masing tingkatan kelas. Total akan dihitung otomatis untuk peta sebaran dan rekap pendataan.
                            </p>
                          </div>
                          
                          {/* Auto-sum stat badge */}
                          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white border border-emerald-200 shadow-xs shrink-0">
                            <Calculator className="h-4 w-4 text-emerald-600" />
                            <div>
                              <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Total Terhitung</div>
                              <div className="text-base font-black text-emerald-700 leading-none">
                                {autoSumStudents.toLocaleString('id-ID')} <span className="text-xs font-semibold text-slate-500">Siswa</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Grade level inputs grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                          {gradeLevels.map((lvl) => (
                            <div key={lvl} className="space-y-1.5 p-3 rounded-xl bg-white border border-emerald-100 shadow-2xs hover:border-emerald-300 transition-colors">
                              <Label className="text-[10px] font-black uppercase text-slate-600 tracking-wide block">
                                {lvl}
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                value={perClassCounts[lvl] ?? ""}
                                onChange={(e) => handlePerClassChange(lvl, e.target.value)}
                                placeholder="0"
                                className="h-10 rounded-lg text-center font-bold text-slate-800 border-slate-200 focus-visible:ring-emerald-500 text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 lg:col-span-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-emerald-700">Estimasi Jumlah Siswa (Agregat)</Label>
                        <Input 
                          type="number"
                          min="0"
                          name="jumlah_siswa_manual" 
                          value={formData.jumlah_siswa_manual} 
                          onChange={handleChange} 
                          placeholder="Contoh: 150" 
                          className="h-12 rounded-xl border-emerald-200 bg-emerald-50/20 font-bold text-emerald-900" 
                        />
                        <p className="text-[10px] text-slate-400">
                          Jenjang RA/non-formal tidak memerlukan rincian per kelas. Cukup isi estimasi agregat bila diperlukan.
                        </p>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
        </div>

        {/* Alamat & Kontak (Full Width) */}
        <Card className="border-0 shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="p-10 border-b bg-slate-50/50">
            <CardTitle className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">Kontak & Alamat</CardTitle>
          </CardHeader>
          <CardContent className="p-10 space-y-8">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Alamat Lengkap (Jl, No, Desa, Kec)</Label>
              <Input 
                name="alamat" 
                value={formData.alamat} 
                onChange={handleChange} 
                placeholder="Jl. Masjid No 45..."
                className="h-14 rounded-2xl border-slate-200 font-bold"
              />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Email Madrasah</Label>
                    <Input type="email" name="email" value={formData.email} onChange={handleChange} className="h-12 rounded-xl border-slate-200 font-bold" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Telepon / WhatsApp</Label>
                    <Input name="telepon" value={formData.telepon} onChange={handleChange} className="h-12 rounded-xl border-slate-200 font-bold" />
                </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-6 border-t border-slate-100">
          <Button type="submit" size="lg" disabled={updateMutation.isPending} className="h-16 px-12 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase text-sm tracking-widest shadow-2xl shadow-slate-200">
            {updateMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            Simpan Perubahan Profil
          </Button>
        </div>
      </form>
    </div>
  )
}
