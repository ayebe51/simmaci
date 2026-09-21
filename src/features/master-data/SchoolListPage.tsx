import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, Plus, Trash2, Edit, FileSpreadsheet, Download, Eye, KeyRound, Loader2, MapPin, AlertTriangle, LockOpen, Lock, LockKeyhole, LockKeyholeOpen, UserCog, School as SchoolIcon, Filter, Layers, CheckCircle2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useEffect, useMemo } from "react"
import { useDebounce } from "@/hooks/useDebounce"
import { useNavigate, Link } from "react-router-dom"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { schoolApi } from "@/lib/api"
import { toast } from "sonner"
import ExcelImportModal from "./components/ExcelImportModal"
import * as XLSX from "xlsx"
import HeadmasterProfileForm from "../schools/components/HeadmasterProfileForm"
import { cn } from "@/lib/utils"

export function detectSchoolJenjang(school: { jenjang?: string | null; nama?: string | null }): string {
  if (school.jenjang && school.jenjang.trim() !== '') {
    const j = school.jenjang.trim().toUpperCase()
    if (j.includes('RA') || j.includes('TK') || j.includes('PAUD') || j.includes('BA')) return 'RA'
    if (j.includes('MI') || j.includes('SD')) return 'MI'
    if (j.includes('MTS') || j.includes('SMP')) return 'MTs'
    if (j.includes('SMK')) return 'SMK'
    if (j.includes('MA') || j.includes('SMA')) return 'MA'
    return j
  }

  const name = (school.nama || '').trim().toUpperCase()
  if (/\b(RA|TK|PAUD|BA)\b|RAUDHATUL|BUSTANUL/i.test(name)) return 'RA'
  if (/\b(MI|SD)\b|IBTIDAIYAH/i.test(name)) return 'MI'
  if (/\b(MTS|SMP)\b|TSANAWIYAH/i.test(name)) return 'MTs'
  if (/\bSMK\b|KEJURUAN/i.test(name)) return 'SMK'
  if (/\b(MA|SMA)\b|ALIYAH/i.test(name)) return 'MA'

  return 'Lainnya'
}

export const JENJANG_OPTIONS = [
  { value: 'all', label: 'Semua Jenjang', fullName: 'Kolektif Multi-Sheet', color: 'emerald' },
  { value: 'RA', label: 'RA / PAUD', fullName: 'Raudhatul Athfal / PAUD', color: 'purple' },
  { value: 'MI', label: 'MI', fullName: 'Madrasah Ibtidaiyah', color: 'emerald' },
  { value: 'MTs', label: 'MTs', fullName: 'Madrasah Tsanawiyah', color: 'blue' },
  { value: 'MA', label: 'MA', fullName: 'Madrasah Aliyah', color: 'amber' },
  { value: 'SMK', label: 'SMK', fullName: 'Sekolah Menengah Kejuruan', color: 'rose' },
]

interface School {
  id: number
  nsm: string
  nama: string
  alamat?: string
  kecamatan?: string
  kepala_madrasah?: string
  status_jamiyyah?: string
  akreditasi?: string
  npsn?: string
  npsm_nu?: string
  email?: string
  telepon?: string
  provinsi?: string
  kabupaten?: string
  kelurahan?: string
  kepala_whatsapp?: string
  kepala_jabatan_mulai?: string
  kepala_jabatan_selesai?: string
  sk_submission_unlocked?: boolean
  jenjang?: string
}

export default function SchoolListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [user] = useState<any>(() => {
    const u = localStorage.getItem("user_data")
    try {
      return u ? JSON.parse(u) : null
    } catch (e) {
      return null
    }
  })

  const isSuperAdmin = user?.role === "super_admin"
  const canToggleSk = isSuperAdmin || user?.role === "admin_yayasan" || user?.role === "admin"

  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [filterKecamatan, setFilterKecamatan] = useState("all")
  const [filterJenjang, setFilterJenjang] = useState("all")
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false)
  const [modalFilterJenjang, setModalFilterJenjang] = useState("all")
  const [modalFilterKecamatan, setModalFilterKecamatan] = useState("all")
  const [selectedHeadmasterSchool, setSelectedHeadmasterSchool] = useState<School | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, filterKecamatan, filterJenjang])

  // 🔥 REST API QUERY
  const { data: schoolsData, isLoading } = useQuery({
    queryKey: ['schools', currentPage, debouncedSearchTerm, filterKecamatan, filterJenjang],
    queryFn: () => schoolApi.paginate({
      page: currentPage,
      per_page: itemsPerPage,
      search: debouncedSearchTerm || undefined,
      kecamatan: filterKecamatan === "all" ? undefined : filterKecamatan,
      jenjang: filterJenjang === "all" ? undefined : filterJenjang
    })
  })

  // Summary query for counts per jenjang
  const { data: allSchoolsSummary } = useQuery({
    queryKey: ['schools-all-summary'],
    queryFn: () => schoolApi.paginate({ page: 1, per_page: 9999 }),
    staleTime: 5 * 60 * 1000,
  })

  const countsByJenjang = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      RA: 0,
      MI: 0,
      MTs: 0,
      MA: 0,
      SMK: 0,
    }
    const list = allSchoolsSummary?.data || []
    counts.all = list.length
    list.forEach((s: any) => {
      const j = detectSchoolJenjang(s)
      if (counts[j] !== undefined) {
        counts[j]++
      }
    })
    return counts
  }, [allSchoolsSummary?.data])

  const getJenjangBadge = (school: { jenjang?: string | null; nama?: string | null }) => {
    const j = detectSchoolJenjang(school)
    switch (j) {
      case 'RA':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-semibold px-2 py-0.5 text-xs">RA</Badge>
      case 'MI':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-semibold px-2 py-0.5 text-xs">MI</Badge>
      case 'MTs':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-semibold px-2 py-0.5 text-xs">MTs</Badge>
      case 'MA':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-semibold px-2 py-0.5 text-xs">MA</Badge>
      case 'SMK':
        return <Badge className="bg-rose-100 text-rose-700 border-rose-200 font-semibold px-2 py-0.5 text-xs">SMK</Badge>
      default:
        return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-semibold px-2 py-0.5 text-xs">{j}</Badge>
    }
  }

  const schools = schoolsData?.data || []
  const totalPages = schoolsData?.last_page || 1

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (id: number) => schoolApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] })
      toast.success("Sekolah berhasil dihapus")
    }
  })

  const toggleSkMutation = useMutation({
    mutationFn: ({ schoolId, unlocked }: { schoolId: number; unlocked: boolean | null }) =>
      schoolApi.toggleSkSubmission(schoolId, unlocked),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schools'] })
      const label = variables.unlocked === true ? 'dibuka' : variables.unlocked === false ? 'ditutup paksa' : 'direset ke default'
      toast.success(`Pengajuan SK berhasil ${label}`)
    },
    onError: () => toast.error('Gagal mengubah status pengajuan SK'),
  })

  const resetAllSkMutation = useMutation({
    mutationFn: () => schoolApi.resetAllSkSubmission(),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['schools'] })
      toast.success(data?.message || 'Semua izin pengajuan SK berhasil direset')
    },
    onError: () => toast.error('Gagal mereset izin pengajuan SK'),
  })

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [formData, setFormData] = useState<Partial<School>>({})
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false)
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [generateResult, setGenerateResult] = useState<any[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [generateTarget, setGenerateTarget] = useState<School | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<School | null>(null)
  const [isConfirmTutupSkOpen, setIsConfirmTutupSkOpen] = useState(false)

  const openAdd = () => {
    setIsEditMode(false)
    setFormData({ status_jamiyyah: 'Jamiyyah' })
    setIsAddOpen(true)
  }

  const openEdit = (school: School) => {
    setIsEditMode(true)
    setFormData(school)
    setIsAddOpen(true)
  }

  const handleSave = async () => {
    if (!formData.nama || !formData.nsm) { toast.error("NSM dan Nama wajib diisi!"); return }
    try {
      if (isEditMode && formData.id) {
        await schoolApi.update(formData.id, formData)
        toast.success("Berhasil memperbarui sekolah")
      } else {
        await schoolApi.create(formData)
        toast.success("Berhasil menambah sekolah")
      }
      queryClient.invalidateQueries({ queryKey: ['schools'] })
      setIsAddOpen(false)
    } catch (e: any) {
      const msg = e.response?.data?.message
        || e.response?.data?.errors && Object.values(e.response.data.errors).flat().join(', ')
        || e.message
      toast.error("Gagal menyimpan: " + msg)
    }
  }

  const uniqueKecamatan = [
    "Cilacap Selatan", "Cilacap Tengah", "Cilacap Utara", "Kesugihan", "Adipala", "Maos", "Kroya", "Binangun", "Nusawungu", "Sampang", "Karangpucung", "Cimanggu", "Majenang", "Wanareja", "Dayeuhluhur", "Gandrungmangu", "Sidareja", "Kedungreja", "Patimuan", "Bantarsari", "Kawunganten", "Jeruklegi", "Kampung Laut", "Cipari"
  ].sort()

  // ── Export Excel (client-side, grouped by jenjang & kecamatan) ──
  const handleExportExcel = async (targetJenjang: string = 'all', targetKecamatan: string = 'all') => {
    setIsExporting(true)
    try {
      const res = await schoolApi.paginate({ page: 1, per_page: 9999 })
      let allSchools: any[] = res.data || []

      if (allSchools.length === 0) {
        toast.error('Tidak ada data satuan pendidikan untuk diekspor')
        return
      }

      // Filter by Jenjang if specified
      if (targetJenjang !== 'all') {
        allSchools = allSchools.filter(s => detectSchoolJenjang(s) === targetJenjang)
      }

      // Filter by Kecamatan if specified
      if (targetKecamatan !== 'all') {
        allSchools = allSchools.filter(s => (s.kecamatan || '').trim().toLowerCase() === targetKecamatan.trim().toLowerCase())
      }

      if (allSchools.length === 0) {
        toast.warning(`Tidak ada data satuan pendidikan untuk jenjang ${targetJenjang} di kecamatan ${targetKecamatan}`)
        return
      }

      // ── Header definitions ──────────────────────────────────────────
      // Sheet dengan kolom Kecamatan
      const HEADERS_ALL = [
        'No', 'Kecamatan', 'Nama Satpend', 'Jenjang', 'NSM', 'NPSN', 'NPSM-NU',
        'Kepala Madrasah', 'No. HP', 'Akreditasi', 'Status Lembaga', 'Status Jamiyyah',
        'Alamat', 'Kelurahan', 'Email',
      ]
      const COL_WIDTHS_ALL = [
        { wch: 5 },   // No
        { wch: 18 },  // Kecamatan
        { wch: 35 },  // Nama Satpend
        { wch: 10 },  // Jenjang
        { wch: 18 },  // NSM
        { wch: 14 },  // NPSN
        { wch: 16 },  // NPSM-NU
        { wch: 28 },  // Kepala Madrasah
        { wch: 16 },  // No. HP
        { wch: 12 },  // Akreditasi
        { wch: 16 },  // Status Lembaga
        { wch: 16 },  // Status Jamiyyah
        { wch: 40 },  // Alamat
        { wch: 18 },  // Kelurahan
        { wch: 28 },  // Email
      ]

      // Sheet per kecamatan (tanpa kolom Kecamatan)
      const HEADERS_KEC = [
        'No', 'Nama Satpend', 'Jenjang', 'NSM', 'NPSN', 'NPSM-NU',
        'Kepala Madrasah', 'No. HP', 'Akreditasi', 'Status Lembaga', 'Status Jamiyyah',
        'Alamat', 'Kelurahan', 'Email',
      ]
      const COL_WIDTHS_KEC = [
        { wch: 5 },   // No
        { wch: 35 },  // Nama Satpend
        { wch: 10 },  // Jenjang
        { wch: 18 },  // NSM
        { wch: 14 },  // NPSN
        { wch: 16 },  // NPSM-NU
        { wch: 28 },  // Kepala Madrasah
        { wch: 16 },  // No. HP
        { wch: 12 },  // Akreditasi
        { wch: 16 },  // Status Lembaga
        { wch: 16 },  // Status Jamiyyah
        { wch: 40 },  // Alamat
        { wch: 18 },  // Kelurahan
        { wch: 28 },  // Email
      ]

      const borderStyle = {
        top:    { style: 'thin', color: { rgb: 'BFBFBF' } },
        bottom: { style: 'thin', color: { rgb: 'BFBFBF' } },
        left:   { style: 'thin', color: { rgb: 'BFBFBF' } },
        right:  { style: 'thin', color: { rgb: 'BFBFBF' } },
      }
      const enc = (r: number, c: number) => XLSX.utils.encode_cell({ r, c })

      // ── Build one worksheet ──────────────────────────────────────────
      const buildSheet = (schoolsList: any[], headers: string[], colWidths: any[], includeKecamatan: boolean) => {
        const sorted = [...schoolsList].sort((a, b) => {
          if (includeKecamatan) {
            const kecCmp = (a.kecamatan || '').localeCompare(b.kecamatan || '', 'id')
            if (kecCmp !== 0) return kecCmp
          }
          return (a.nama || '').localeCompare(b.nama || '', 'id')
        })

        const wsData: any[][] = [headers]
        sorted.forEach((s, i) => {
          const jenjangVal = detectSchoolJenjang(s)
          const base = [
            jenjangVal,
            s.nsm || '',
            s.npsn || '',
            s.npsm_nu || '',
            s.kepala_madrasah || '',
            s.telepon || '',
            s.akreditasi || '',
            s.status_lembaga || '',
            s.status_jamiyyah || '',
            s.alamat || '',
            s.kelurahan || '',
            s.email || '',
          ]
          const row = includeKecamatan
            ? [i + 1, s.kecamatan || '', s.nama || '', ...base]
            : [i + 1, s.nama || '', ...base]
          wsData.push(row)
        })

        const ws = XLSX.utils.aoa_to_sheet(wsData)
        ws['!cols'] = colWidths
        const numCols = headers.length

        for (let r = 0; r < wsData.length; r++) {
          for (let c = 0; c < numCols; c++) {
            const cellRef = enc(r, c)
            if (!ws[cellRef]) ws[cellRef] = { t: 'z', v: '' }
            ws[cellRef].s = {
              border: borderStyle,
              alignment: {
                vertical: 'center',
                wrapText: c === (includeKecamatan ? 12 : 11), // wrap Alamat
                horizontal: c === 0 || c === (includeKecamatan ? 3 : 2) ? 'center' : 'left',
              },
              ...(r === 0 ? {
                font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
                fill: { fgColor: { rgb: '1F7A4D' } }, // LP Ma'arif green
              } : {
                font: { sz: 10 },
                fill: { fgColor: { rgb: r % 2 !== 0 ? 'FFFFFF' : 'EEF4FF' } },
              }),
            }
          }
        }
        return ws
      }

      // ── Build workbook ───────────────────────────────────────────────
      const wb = XLSX.utils.book_new()
      const dateStr = new Date().toISOString().slice(0, 10)

      if (targetJenjang === 'all' && targetKecamatan === 'all') {
        // Main summary sheet: Semua Satpend
        XLSX.utils.book_append_sheet(wb, buildSheet(allSchools, HEADERS_ALL, COL_WIDTHS_ALL, true), 'Semua Satpend')

        // Add sub-sheets per jenjang
        const jenjangList = ['MI', 'MTs', 'MA', 'SMK', 'RA']
        for (const j of jenjangList) {
          const filtered = allSchools.filter(s => detectSchoolJenjang(s) === j)
          if (filtered.length > 0) {
            XLSX.utils.book_append_sheet(wb, buildSheet(filtered, HEADERS_ALL, COL_WIDTHS_ALL, true), `Satpend ${j}`)
          }
        }

        // Add sub-sheets per kecamatan
        const groupedKec = new Map<string, any[]>()
        for (const s of allSchools) {
          const kec = s.kecamatan || '(Lainnya)'
          if (!groupedKec.has(kec)) groupedKec.set(kec, [])
          groupedKec.get(kec)!.push(s)
        }
        const sortedKecamatan = [...groupedKec.keys()].sort((a, b) => a.localeCompare(b, 'id'))
        for (const kec of sortedKecamatan) {
          const sheetName = kec.replace(/[:\\/?*[\]]/g, '').slice(0, 31)
          XLSX.utils.book_append_sheet(wb, buildSheet(groupedKec.get(kec)!, HEADERS_KEC, COL_WIDTHS_KEC, false), sheetName)
        }

        XLSX.writeFile(wb, `Data_Satpend_Semua_Jenjang_${dateStr}.xlsx`)
        toast.success(`Berhasil export ${allSchools.length} satpend (Semua Jenjang & Kecamatan)!`)
      } else if (targetJenjang !== 'all' && targetKecamatan === 'all') {
        // Single jenjang, all kecamatan
        XLSX.utils.book_append_sheet(wb, buildSheet(allSchools, HEADERS_ALL, COL_WIDTHS_ALL, true), `Semua Satpend ${targetJenjang}`)

        // Group by kecamatan for this jenjang
        const groupedKec = new Map<string, any[]>()
        for (const s of allSchools) {
          const kec = s.kecamatan || '(Lainnya)'
          if (!groupedKec.has(kec)) groupedKec.set(kec, [])
          groupedKec.get(kec)!.push(s)
        }
        const sortedKecamatan = [...groupedKec.keys()].sort((a, b) => a.localeCompare(b, 'id'))
        for (const kec of sortedKecamatan) {
          const sheetName = kec.replace(/[:\\/?*[\]]/g, '').slice(0, 31)
          XLSX.utils.book_append_sheet(wb, buildSheet(groupedKec.get(kec)!, HEADERS_KEC, COL_WIDTHS_KEC, false), sheetName)
        }

        XLSX.writeFile(wb, `Data_Satpend_${targetJenjang}_Semua_Kecamatan_${dateStr}.xlsx`)
        toast.success(`Berhasil export ${allSchools.length} satpend jenjang ${targetJenjang}!`)
      } else {
        // Specific jenjang and/or specific kecamatan
        const titleSheet = `${targetJenjang !== 'all' ? targetJenjang : 'Satpend'} ${targetKecamatan !== 'all' ? targetKecamatan : ''}`.trim().slice(0, 31)
        XLSX.utils.book_append_sheet(wb, buildSheet(allSchools, HEADERS_ALL, COL_WIDTHS_ALL, true), titleSheet)

        const kecSafe = targetKecamatan !== 'all' ? targetKecamatan.replace(/\s+/g, '_') : 'Semua'
        const jenjangSafe = targetJenjang !== 'all' ? targetJenjang : 'Semua'
        XLSX.writeFile(wb, `Data_Satpend_${jenjangSafe}_${kecSafe}_${dateStr}.xlsx`)
        toast.success(`Berhasil export ${allSchools.length} satpend terfilter!`)
      }

      setIsDownloadModalOpen(false)
    } catch (e: any) {
      toast.error('Gagal export: ' + (e.response?.data?.message || e.message))
    } finally {
      setIsExporting(false)
    }
  }

  // ── Delete All ──
  const deleteAllMutation = useMutation({
    mutationFn: () => schoolApi.deleteAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] })
      toast.success('Semua data lembaga berhasil dihapus')
      setIsDeleteAllOpen(false)
    },
    onError: (e: any) => toast.error('Gagal hapus: ' + (e.response?.data?.message || e.message))
  })

  // ── Generate Akun (semua sekolah) ──
  const handleGenerateAccounts = async () => {
    setIsGenerating(true)
    try {
      const res = await schoolApi.generateAccounts()
      setGenerateResult(res.accounts || [])
      toast.success(`Berhasil generate ${res.accounts?.length || 0} akun!`)
    } catch (e: any) {
      toast.error('Gagal generate akun: ' + (e.response?.data?.message || e.message))
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Generate Akun per-sekolah ──
  const handleGenerateSingle = async (school: School) => {
    setGenerateTarget(school)
    setGenerateResult([])
    setIsGenerateOpen(true)
  }

  const handleConfirmGenerateSingle = async () => {
    if (!generateTarget) return
    setIsGenerating(true)
    try {
      const res = await schoolApi.generateAccounts(generateTarget.id)
      setGenerateResult(res.accounts || [])
      if (res.accounts?.length === 0) {
        toast.info(`Akun untuk ${generateTarget.nama} sudah ada (skipped: ${res.skipped})`)
      } else {
        toast.success(`Berhasil generate ${res.accounts?.length} akun untuk ${generateTarget.nama}`)
      }
    } catch (e: any) {
      toast.error('Gagal generate akun: ' + (e.response?.data?.message || e.message))
    } finally {
      setIsGenerating(false)
    }
  }



  if (selectedHeadmasterSchool) {
    return (
      <div className="space-y-6 pb-10 max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" onClick={() => setSelectedHeadmasterSchool(null)} className="rounded-xl">
            Kembali ke Daftar
          </Button>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
              Edit Profil Kepala Madrasah
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              {selectedHeadmasterSchool.nama} • {selectedHeadmasterSchool.kecamatan}
            </p>
          </div>
        </div>
        <HeadmasterProfileForm
          school={selectedHeadmasterSchool}
          onSuccess={() => setSelectedHeadmasterSchool(null)}
          onCancel={() => setSelectedHeadmasterSchool(null)}
          isAdminMode={true}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <SoftPageHeader
        title="Data Satpend"
        description="Kelola data dan identitas satuan pendidikan di lingkungan LP Ma'arif NU Cilacap."
        actions={[
          {
            label: isExporting ? 'Mengekspor...' : 'Download Data Satpend',
            onClick: () => setIsDownloadModalOpen(true),
            variant: 'outline',
            icon: isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-emerald-600" />
          },
          ...(canToggleSk ? [
              { label: 'Tutup Pengajuan SK', onClick: () => setIsConfirmTutupSkOpen(true), variant: 'outline', icon: <Lock className="h-4 w-4 text-amber-600" /> },
          ] : []),
          ...(isSuperAdmin ? [
              { label: 'Import Excel', onClick: () => setIsImportModalOpen(true), variant: 'outline', icon: <FileSpreadsheet className="h-4 w-4" /> },
              { label: 'Generate Akun', onClick: () => { setGenerateResult([]); setIsGenerateOpen(true) }, variant: 'outline', icon: <KeyRound className="h-4 w-4" /> },
              { label: 'Hapus Semua', onClick: () => setIsDeleteAllOpen(true), variant: 'destructive', icon: <Trash2 className="h-4 w-4" /> },
              { label: 'Tambah Sekolah', onClick: openAdd, variant: 'default', icon: <Plus className="h-4 w-4" /> },
          ] : [])
        ]}
      />

      <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader className="p-6 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full max-w-md">
                    <Search className="absolute left-4 top-3 h-4 w-4 text-emerald-500" />
                    <Input
                        placeholder="Cari nama sekolah..."
                        className="pl-11 h-10 rounded-2xl bg-white border-slate-200 focus-visible:ring-emerald-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <Select value={filterJenjang} onValueChange={setFilterJenjang}>
                        <SelectTrigger className="w-full sm:w-[170px] h-10 rounded-2xl bg-white border-slate-200">
                            <Layers className="h-4 w-4 mr-2 text-emerald-600" />
                            <SelectValue placeholder="Semua Jenjang" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100">
                            {JENJANG_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filterKecamatan} onValueChange={setFilterKecamatan}>
                        <SelectTrigger className="w-full sm:w-[200px] h-10 rounded-2xl bg-white border-slate-200">
                            <MapPin className="h-4 w-4 mr-2 text-emerald-600" />
                            <SelectValue placeholder="Semua Kecamatan" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100">
                            <SelectItem value="all">Semua Kecamatan</SelectItem>
                            {uniqueKecamatan.map(k => (
                              <SelectItem key={k} value={k}>{k}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <TableRow className="border-b-0 hover:bg-transparent">
                        <TableHead className="py-3 px-4 font-bold text-emerald-800">NSM</TableHead>
                        <TableHead className="py-3 px-4 font-bold text-emerald-800">Jenjang</TableHead>
                        <TableHead className="py-3 px-4 font-bold text-emerald-800">Nama Satpend</TableHead>
                        <TableHead className="py-3 px-4 font-bold text-emerald-800">Kecamatan</TableHead>
                        <TableHead className="py-3 px-4 font-bold text-emerald-800">Kepala Madrasah</TableHead>
                        <TableHead className="py-3 px-4 font-bold text-emerald-800 text-center">Pengajuan SK</TableHead>
                        <TableHead className="py-3 px-4 font-bold text-emerald-800 text-right rounded-tr-xl">Aksi</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-emerald-500" /></TableCell></TableRow>
                    ) : schools.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-48 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-500">
                              <SchoolIcon className="h-12 w-12 text-slate-300 mb-3" />
                              <p className="font-semibold text-slate-600">Tidak ada data lembaga</p>
                              <p className="text-sm mt-1 mb-4">Tambahkan data lembaga baru atau sesuaikan filter pencarian Anda.</p>
                              {isSuperAdmin && (
                                <Button onClick={openAdd} variant="outline" size="sm">
                                  <Plus className="h-4 w-4 mr-2" /> Tambah Lembaga
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                    ) : (
                        schools.map((item: School) => (
                            <TableRow key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                <TableCell className="px-4 py-3 font-semibold text-slate-700 text-sm">{item.nsm}</TableCell>
                                <TableCell className="px-4 py-3">{getJenjangBadge(item)}</TableCell>
                                <TableCell className="px-4 py-3">
                                    <div className="font-bold text-slate-900 text-sm">{item.nama}</div>
                                    <div className="text-xs text-slate-400 mt-0.5 flex items-start gap-1 max-w-[220px]">
                                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                                        <span className="truncate">{item.alamat || '-'}</span>
                                    </div>
                                    <Badge variant="outline" className="mt-1 rounded-lg bg-slate-50 text-slate-600 border-slate-200 font-medium px-2 py-0.5 text-[10px]">
                                        {item.status_jamiyyah}
                                    </Badge>
                                </TableCell>
                                <TableCell className="px-4 py-3 text-sm text-slate-600">{item.kecamatan}</TableCell>
                                <TableCell className="px-4 py-3">
                                  <div className="text-sm font-medium text-slate-900">{item.kepala_madrasah || "-"}</div>
                                  {item.kepala_whatsapp && <div className="text-xs text-slate-400 mt-0.5">{item.kepala_whatsapp}</div>}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-center">
                                  {(() => {
                                    const jenjang = (item.jenjang || "").toUpperCase()
                                    const isRaTk = jenjang === "RA" || jenjang === "TK" || jenjang.includes("RA") || jenjang.includes("TK")
                                    if (isRaTk) {
                                      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Selalu Buka</Badge>
                                    }
                                    const isUnlocked = item.sk_submission_unlocked === true
                                    const isPending = toggleSkMutation.isPending
                                    return (
                                      <div className="flex flex-col items-center gap-1">
                                        {isUnlocked ? (
                                          <Button
                                            size="sm" variant="outline"
                                            className="h-6 text-[10px] px-2 py-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded"
                                            disabled={isPending || !canToggleSk}
                                            onClick={(e) => { e.stopPropagation(); toggleSkMutation.mutate({ schoolId: item.id, unlocked: null }) }}
                                            title="Sedang dibuka. Klik untuk reset ke default (ditutup)."
                                          >
                                            {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <LockOpen className="h-3 w-3 mr-1" />}
                                            Dibuka
                                          </Button>
                                        ) : (
                                          <Button
                                            size="sm" variant="outline"
                                            className="h-6 text-[10px] px-2 py-0 border-slate-200 text-slate-500 hover:bg-slate-50 rounded"
                                            disabled={isPending || !canToggleSk}
                                            onClick={(e) => { e.stopPropagation(); toggleSkMutation.mutate({ schoolId: item.id, unlocked: true }) }}
                                            title="Sedang ditutup. Klik untuk buka paksa izin."
                                          >
                                            {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                                            Ditutup
                                          </Button>
                                        )}
                                      </div>
                                    )
                                  })()}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-right">
                                    <div className="flex gap-1 items-center justify-end">
                                        <Link to={`/dashboard/master/schools/${item.id}`}>
                                            <Button variant="ghost" size="icon-sm" title="Detail"><Eye className="h-4 w-4 text-slate-600" /></Button>
                                        </Link>
                                        {isSuperAdmin && (
                                            <>
                                                <Button variant="ghost" size="icon-sm" title="Kelola Kepala Madrasah" onClick={() => setSelectedHeadmasterSchool(item)}><UserCog className="h-4 w-4 text-purple-600" /></Button>
                                                <Button variant="ghost" size="icon-sm" title="Generate Akun" onClick={() => handleGenerateSingle(item)}><KeyRound className="h-4 w-4 text-blue-600" /></Button>
                                                <Button variant="ghost" size="icon-sm" title="Edit Lembaga" onClick={() => openEdit(item)}><Edit className="h-4 w-4 text-slate-600" /></Button>
                                                <Button variant="ghost" size="icon-sm" title="Hapus Lembaga" onClick={() => setConfirmDelete(item)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            
            <div className="flex items-center justify-between p-6 border-t border-slate-100">
                <div className="text-sm font-medium text-slate-500">Halaman {currentPage} dari {totalPages}</div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-xl border-slate-200" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Sebelumnya</Button>
                    <Button variant="outline" size="sm" className="rounded-xl border-slate-200" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Selanjutnya</Button>
                </div>
            </div>
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-4xl">
            <DialogHeader><DialogTitle>{isEditMode ? 'Edit' : 'Tambah'} Sekolah</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Nama Sekolah</Label>
                        <Input value={formData.nama || ""} onChange={e => setFormData({...formData, nama: e.target.value})} placeholder="Masukkan nama sekolah" />
                    </div>
                    <div className="space-y-2">
                        <Label>Kecamatan</Label>
                        <Select value={formData.kecamatan} onValueChange={v => setFormData({...formData, kecamatan: v})}>
                            <SelectTrigger><SelectValue placeholder="Pilih Kecamatan" /></SelectTrigger>
                            <SelectContent>
                                {uniqueKecamatan.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>NSM</Label>
                        <Input value={formData.nsm || ""} onChange={e => setFormData({...formData, nsm: e.target.value})} placeholder="Nomor Statistik Madrasah" />
                    </div>
                    <div className="space-y-2">
                        <Label>NPSN</Label>
                        <Input value={formData.npsn || ""} onChange={e => setFormData({...formData, npsn: e.target.value})} placeholder="Nomor Pokok Sekolah Nasional" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Kepala Madrasah</Label>
                        <Input value={formData.kepala_madrasah || ""} onChange={e => setFormData({...formData, kepala_madrasah: e.target.value})} placeholder="Nama Kepala Madrasah" />
                    </div>
                    <div className="space-y-2">
                        <Label>Akreditasi</Label>
                        <Select value={formData.akreditasi} onValueChange={v => setFormData({...formData, akreditasi: v})}>
                            <SelectTrigger><SelectValue placeholder="Pilih Akreditasi" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="A">Terakreditasi A</SelectItem>
                                <SelectItem value="B">Terakreditasi B</SelectItem>
                                <SelectItem value="C">Terakreditasi C</SelectItem>
                                <SelectItem value="Belum">Belum Terakreditasi</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>NPSMNU</Label>
                        <Input value={formData.npsm_nu || ""} onChange={e => setFormData({...formData, npsm_nu: e.target.value})} placeholder="Nomor Pokok Statistik Ma'arif NU" />
                    </div>
                    <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={formData.status_jamiyyah} onValueChange={v => setFormData({...formData, status_jamiyyah: v})}>
                            <SelectTrigger><SelectValue placeholder="Pilih Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Jam'iyyah">Jam'iyyah</SelectItem>
                                <SelectItem value="Jama'ah (Afiliasi)">Jama'ah (Afiliasi)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                        <Label>Alamat Lengkap</Label>
                        <Input value={formData.alamat || ""} onChange={e => setFormData({...formData, alamat: e.target.value})} placeholder="Jl. Raya No..." />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={formData.email || ""} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="sekolah@maarif.nu" />
                    </div>
                    <div className="space-y-2">
                        <Label>No. Telepon</Label>
                        <Input value={formData.telepon || ""} onChange={e => setFormData({...formData, telepon: e.target.value})} placeholder="08..." />
                    </div>
                </div>
            </div>
            <DialogFooter className="border-t pt-4">
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
                <Button variant="default" onClick={handleSave}>Simpan</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExcelImportModal
        title="Import Data Sekolah"
        description="Pastikan file excel Anda memiliki kolom: nama_sekolah, nsm, npsn, kepala_madrasah, akreditasi, npsm_nu, status, kecamatan, alamat, email, no_telepon."
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        templateUrl="/TEMPLATE_IMPORT_DATA_LEMBAGA_V3.xlsx"
        enablePreview={true}
        onImport={async (data) => {
          try {
            const res = await schoolApi.import(data)
            queryClient.invalidateQueries({ queryKey: ['schools'] })
            if (res.errors && res.errors.length > 0) {
                const firstError = res.errors[0]?.error || "Unknown error"
                toast.warning(`Berhasil: ${res.created}, Gagal: ${res.errors.length}. Detail error pertama: ${firstError}`, {
                    duration: 6000
                })
            } else {
                toast.success(`Berhasil mengimpor ${res.created} data sekolah!`)
            }
            setIsImportModalOpen(false)
          } catch (e: any) {
            toast.error("Gagal import: " + e.message)
          }
        }}
      />

      {/* ── Delete All Confirmation Dialog ── */}
      <Dialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <DialogContent className="rounded-[2rem] p-8 sm:max-w-md border-0 ring-1 ring-slate-100">
          <DialogHeader className="items-center text-center">
            <div className="bg-red-50 h-16 w-16 rounded-3xl flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">Hapus Semua Data Lembaga?</DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500 pt-2">
              Tindakan ini akan menghapus <strong>seluruh data profil lembaga/sekolah</strong> secara permanen dan tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-3 sm:justify-center">
            <button onClick={() => setIsDeleteAllOpen(false)} className="flex-1 h-12 rounded-2xl border border-slate-200 font-black uppercase tracking-widest text-xs text-slate-600 hover:bg-slate-50 transition-colors">Batal</button>
            <button
              onClick={() => deleteAllMutation.mutate()}
              disabled={deleteAllMutation.isPending}
              className="flex-1 h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs disabled:opacity-50 transition-colors"
            >
              {deleteAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Ya, Hapus Semua'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Generate Akun Dialog ── */}
      <Dialog open={isGenerateOpen} onOpenChange={(v) => { if (!isGenerating) { setIsGenerateOpen(v); if (!v) { setGenerateTarget(null); setGenerateResult([]) } } }}>
        <DialogContent className="rounded-[2rem] p-8 sm:max-w-2xl border-0 ring-1 ring-slate-100 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="items-center text-center">
            <div className="bg-purple-50 h-16 w-16 rounded-3xl flex items-center justify-center mb-4">
              <KeyRound className="h-8 w-8 text-purple-500" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">
              {generateTarget ? `Generate Akun — ${generateTarget.nama}` : 'Generate Akun Operator'}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500 pt-2">
              {generateTarget
                ? <>Generate akun operator untuk <strong>{generateTarget.nama}</strong>.<br />Username: {generateTarget.nsm?.toLowerCase()}@simmaci.com &bull; Password: {generateTarget.nsm}</>
                : <>Membuat akun login untuk kepala madrasah / operator sekolah yang belum memiliki akun.<br />Username: NSM@simmaci.com &bull; Password: NSM sekolah</>
              }
            </DialogDescription>
          </DialogHeader>

          {generateResult.length > 0 ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-600 text-center">{generateResult.length} Akun Berhasil Dibuat</p>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-black text-slate-500">Lembaga</th>
                      <th className="text-left px-4 py-2 font-black text-slate-500">Email / Username</th>
                      <th className="text-left px-4 py-2 font-black text-slate-500">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generateResult.map((a: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-medium">{a.nama}</td>
                        <td className="px-4 py-2 font-mono text-slate-600">{a.email}</td>
                        <td className="px-4 py-2 font-mono text-purple-600 font-bold">{a.password_plain}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => {
                  const ws = XLSX.utils.json_to_sheet(generateResult.map((a: any) => ({ Lembaga: a.nama, Email: a.email, Password: a.password_plain })))
                  const wb = XLSX.utils.book_new()
                  XLSX.utils.book_append_sheet(wb, ws, 'Akun Operator')
                  XLSX.writeFile(wb, `Akun_Operator_${new Date().toISOString().slice(0, 10)}.xlsx`)
                }}
                className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest transition-colors"
              >
                <Download className="h-3 w-3 inline mr-2" /> Download Daftar Akun (Excel)
              </button>
            </div>
          ) : (
            <DialogFooter className="mt-6 flex gap-3 sm:justify-center">
              <button onClick={() => { setIsGenerateOpen(false); setGenerateTarget(null) }} className="flex-1 h-12 rounded-2xl border border-slate-200 font-black uppercase tracking-widest text-xs text-slate-600 hover:bg-slate-50 transition-colors">Batal</button>
              <button
                onClick={generateTarget ? handleConfirmGenerateSingle : handleGenerateAccounts}
                disabled={isGenerating}
                className="flex-1 h-12 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest text-xs disabled:opacity-50 transition-colors"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Generate Sekarang'}
              </button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      
      {/* ── Confirm Delete Single School ── */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}
        title="Hapus Sekolah"
        description={`Yakin ingin menghapus ${confirmDelete?.nama}? Data yang dihapus tidak dapat dikembalikan.`}
        confirmText="Hapus"
        variant="destructive"
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete.id)
          setConfirmDelete(null)
        }}
      />

      {/* ── Confirm Tutup Pengajuan SK Massal ── */}
      <ConfirmDialog
        open={isConfirmTutupSkOpen}
        onOpenChange={setIsConfirmTutupSkOpen}
        title="Tutup Pengajuan SK Massal"
        description="Apakah Anda yakin ingin menutup (mengunci) akses pengajuan SK untuk seluruh satuan pendidikan? Madrasah non-RA/TK tidak akan dapat mengajukan SK baru sampai izin dibuka kembali."
        confirmText={resetAllSkMutation.isPending ? "Memproses..." : "Tutup Pengajuan SK"}
        cancelText="Batal"
        variant="destructive"
        onConfirm={() => {
          resetAllSkMutation.mutate(undefined, {
            onSuccess: () => {
              setIsConfirmTutupSkOpen(false)
            }
          })
        }}
      />

      {/* ── Dialog Download Data Satpend per Jenjang ── */}
      <Dialog open={isDownloadModalOpen} onOpenChange={setIsDownloadModalOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-6 sm:p-8 bg-white border border-slate-100 shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight text-slate-900">
                  Download Data Satpend (Excel)
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-xs">
                  Unduh data lembaga satuan pendidikan dalam format file Microsoft Excel (.xlsx) per jenjang atau kolektif.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-4 space-y-6">
            {/* Quick 1-Click Cards */}
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 block">
                Pilihan Cepat Berdasarkan Jenjang
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {JENJANG_OPTIONS.map((item) => {
                  const count = countsByJenjang[item.value] ?? 0
                  const isAll = item.value === 'all'
                  return (
                    <button
                      key={item.value}
                      onClick={() => handleExportExcel(item.value, 'all')}
                      disabled={isExporting}
                      className={cn(
                        "group relative flex flex-col justify-between p-3.5 rounded-2xl border text-left transition-all duration-200",
                        "hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer",
                        isAll
                          ? "bg-gradient-to-br from-emerald-50 to-teal-50/40 border-emerald-200 hover:border-emerald-400"
                          : "bg-slate-50/60 hover:bg-white border-slate-200 hover:border-emerald-300"
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-lg font-bold text-[10px] px-2 py-0.5 border",
                            isAll && "bg-emerald-600 text-white border-emerald-600",
                            item.value === 'RA' && "bg-purple-100 text-purple-700 border-purple-200",
                            item.value === 'MI' && "bg-emerald-100 text-emerald-700 border-emerald-200",
                            item.value === 'MTs' && "bg-blue-100 text-blue-700 border-blue-200",
                            item.value === 'MA' && "bg-amber-100 text-amber-700 border-amber-200",
                            item.value === 'SMK' && "bg-rose-100 text-rose-700 border-rose-200"
                          )}
                        >
                          {item.label}
                        </Badge>
                        <Download className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-800">
                          {item.fullName}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                          {count} Lembaga
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom Filter Section */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-700">Filter Khusus (Jenjang & Kecamatan)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-500">Jenjang</Label>
                  <Select value={modalFilterJenjang} onValueChange={setModalFilterJenjang}>
                    <SelectTrigger className="h-9 rounded-xl bg-white border-slate-200 text-xs">
                      <SelectValue placeholder="Semua Jenjang" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100">
                      {JENJANG_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label} ({opt.fullName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-500">Kecamatan</Label>
                  <Select value={modalFilterKecamatan} onValueChange={setModalFilterKecamatan}>
                    <SelectTrigger className="h-9 rounded-xl bg-white border-slate-200 text-xs">
                      <SelectValue placeholder="Semua Kecamatan" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100">
                      <SelectItem value="all" className="text-xs">Semua Kecamatan</SelectItem>
                      {uniqueKecamatan.map((k) => (
                        <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={() => handleExportExcel(modalFilterJenjang, modalFilterKecamatan)}
                disabled={isExporting}
                className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm mt-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                    Mengekspor Data...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Download Sesuai Filter
                  </>
                )}
              </Button>
            </div>
          </div>

          <DialogFooter className="mt-4 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDownloadModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
