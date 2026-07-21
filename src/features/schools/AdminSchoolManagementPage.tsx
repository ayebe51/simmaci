import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { schoolApi, School, authApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Building2, Loader2, Edit, ArrowLeft, MapPin, LockOpen, Lock } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import SoftPageHeader from "@/components/ui/SoftPageHeader"
import HeadmasterProfileForm from "./components/HeadmasterProfileForm"
import { toast } from "sonner"

// Extended School interface with headmaster fields
interface SchoolWithHeadmaster extends School {
  kepala_madrasah?: string | null
  kepala_nim?: string | null
  kepala_nuptk?: string | null
  kepala_whatsapp?: string | null
  kepala_jabatan_mulai?: string | null
  kepala_jabatan_selesai?: string | null
  sk_submission_unlocked?: boolean | null
}

// Skeleton loader for table rows - moved outside component to avoid recreation on each render
const TableSkeleton = () => (
  <>
    {[...Array(5)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
      </TableRow>
    ))}
  </>
)

export default function AdminSchoolManagementPage() {
  const navigate = useNavigate()
  const user = authApi.getStoredUser()
  
  // State declarations - must be before any conditional returns
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [filterKecamatan, setFilterKecamatan] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedSchool, setSelectedSchool] = useState<SchoolWithHeadmaster | null>(null)
  const itemsPerPage = 15

  // Debounce search input to optimize API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setCurrentPage(1) // Reset to first page on search
    }, 300) // 300ms debounce delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  // List of kecamatan in Cilacap
  const uniqueKecamatan = [
    "Cilacap Selatan", "Cilacap Tengah", "Cilacap Utara", "Kesugihan", "Adipala", 
    "Maos", "Kroya", "Binangun", "Nusawungu", "Sampang", "Karangpucung", "Cimanggu", 
    "Majenang", "Wanareja", "Dayeuhluhur", "Gandrungmangu", "Sidareja", "Kedungreja", 
    "Patimuan", "Bantarsari", "Kawunganten", "Jeruklegi", "Kampung Laut", "Cipari"
  ].sort()

  // Fetch schools list with pagination and filters
  const { data: schoolsData, isLoading } = useQuery({
    queryKey: ['admin-schools', currentPage, debouncedSearchTerm, filterKecamatan],
    queryFn: () => schoolApi.paginate({
      page: currentPage,
      per_page: itemsPerPage,
      search: debouncedSearchTerm || undefined,
      kecamatan: filterKecamatan === "all" ? undefined : filterKecamatan,
    }),
    staleTime: 0, // selalu fetch fresh — kolom sk_submission_unlocked harus up-to-date
  })

  // Mutation untuk toggle SK submission
  const queryClient = useQueryClient()
  const toggleSkMutation = useMutation({
    mutationFn: ({ schoolId, unlocked }: { schoolId: number; unlocked: boolean | null }) =>
      schoolApi.toggleSkSubmission(schoolId, unlocked),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-schools'] })
      const label = variables.unlocked === true ? 'dibuka' : variables.unlocked === false ? 'ditutup paksa' : 'direset ke default'
      toast.success(`Pengajuan SK berhasil ${label}`)
    },
    onError: () => toast.error('Gagal mengubah status pengajuan SK'),
  })

  // Mutation untuk reset semua SK submission ke null (locked)
  const resetAllSkMutation = useMutation({
    mutationFn: () => schoolApi.resetAllSkSubmission(),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-schools'] })
      toast.success(data?.message || 'Semua izin pengajuan SK berhasil direset')
    },
    onError: () => toast.error('Gagal mereset izin pengajuan SK'),
  })

  const isAuthorized = user?.role === "super_admin" || user?.role === "admin_yayasan"
  
  useEffect(() => {
    if (!isAuthorized) {
      navigate("/dashboard", { replace: true })
    }
  }, [isAuthorized, navigate])
  
  // Don't render if not authorized
  if (!isAuthorized) {
    return null
  }

  const schools = schoolsData?.data || []
  const totalPages = schoolsData?.last_page || 1

  // Handle school selection
  const handleSelectSchool = (school: SchoolWithHeadmaster) => {
    setSelectedSchool(school)
  }

  // Handle form success - return to list view (React Query will auto-refresh via invalidation)
  const handleFormSuccess = () => {
    setSelectedSchool(null)
  }

  // Handle form cancel - return to list view
  const handleFormCancel = () => {
    setSelectedSchool(null)
  }

  // Format date for display
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-"
    try {
      return new Date(dateString).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  // If a school is selected, show the edit form
  if (selectedSchool) {
    return (
      <div className="space-y-6 pb-10 max-w-5xl mx-auto">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFormCancel}
            className="rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali ke Daftar
          </Button>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
              Edit Profil Kepala Madrasah
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              {selectedSchool.nama} • {selectedSchool.kecamatan}
            </p>
          </div>
        </div>

        <HeadmasterProfileForm
          school={selectedSchool}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
          isAdminMode={true}
        />
      </div>
    )
  }

  // Show school list
  return (
    <div className="space-y-6 pb-10">
      <SoftPageHeader
        title="Kelola Sekolah"
        description="Manajemen profil kepala madrasah untuk seluruh sekolah di lingkungan LP Ma'arif NU Cilacap"
        actions={[]}
      />

      {/* Tombol bulk action pengajuan SK */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={resetAllSkMutation.isPending}
          onClick={() => {
            if (window.confirm('Reset semua izin pengajuan SK yang sudah dibuka ke default (ditutup)? Madrasah yang sudah dibuka akan perlu dibuka lagi satu per satu.')) {
              resetAllSkMutation.mutate()
            }
          }}
          className="h-9 px-4 rounded-xl border-red-200 text-red-600 hover:bg-red-50 font-black uppercase tracking-widest text-[10px] flex items-center gap-2"
        >
          {resetAllSkMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Lock className="h-3.5 w-3.5" />
          )}
          Tutup Semua Pengajuan SK
        </Button>
      </div>

      <Card className="border-0 shadow-sm rounded-3xl overflow-hidden bg-white/80 backdrop-blur-md">
        <CardHeader className="p-6 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-4 top-3 h-4 w-4 text-blue-500" />
              <Input
                placeholder="Cari nama sekolah..."
                className="pl-11 h-10 rounded-2xl bg-white border-slate-200 focus-visible:ring-blue-500"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  // Debouncing is handled by useEffect
                }}
              />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-blue-500 pointer-events-none" />
                <Select value={filterKecamatan} onValueChange={(value) => {
                  setFilterKecamatan(value)
                  setCurrentPage(1) // Reset to first page on filter change
                }}>
                  <SelectTrigger className="w-full sm:w-[220px] h-10 rounded-2xl bg-white border-slate-200 pl-10">
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
              
              <div className="text-sm font-medium text-slate-500">
                {schools.length} sekolah
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-blue-50/50">
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableHead className="py-3 px-4 font-bold text-blue-800 rounded-tl-xl">
                  Nama Sekolah
                </TableHead>
                <TableHead className="py-3 px-4 font-bold text-blue-800">
                  Kecamatan
                </TableHead>
                <TableHead className="py-3 px-4 font-bold text-blue-800">
                  Kepala Madrasah
                </TableHead>
                <TableHead className="py-3 px-4 font-bold text-blue-800">
                  Masa Jabatan
                </TableHead>
                <TableHead className="py-3 px-4 font-bold text-blue-800 text-center">
                  Pengajuan SK
                </TableHead>
                <TableHead className="py-3 px-4 font-bold text-blue-800 text-right rounded-tr-xl">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton />
              ) : schools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Building2 className="h-12 w-12 text-slate-300" />
                      <p className="text-slate-400 font-medium">
                        {searchTerm ? "Tidak ada sekolah yang cocok dengan pencarian" : "Tidak ada data sekolah"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                schools.map((school: SchoolWithHeadmaster) => (
                  <TableRow
                    key={school.id}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => handleSelectSchool(school)}
                  >
                    <TableCell className="px-4 py-3">
                      <div className="font-bold text-slate-900 text-sm">
                        {school.nama}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        NSM: {school.nsm || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-slate-600">
                      {school.kecamatan || "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">
                        {school.kepala_madrasah || "-"}
                      </div>
                      {school.kepala_whatsapp && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          {school.kepala_whatsapp}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="text-sm text-slate-600">
                        {school.kepala_jabatan_mulai ? (
                          <>
                            <div>{formatDate(school.kepala_jabatan_mulai)}</div>
                            {school.kepala_jabatan_selesai && (
                              <div className="text-xs text-slate-400">
                                s/d {formatDate(school.kepala_jabatan_selesai)}
                              </div>
                            )}
                          </>
                        ) : (
                          "-"
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const jenjang = (school.jenjang || "").toUpperCase()
                        const isRaTk = jenjang === "RA" || jenjang === "TK" || jenjang.includes("RA") || jenjang.includes("TK")
                        if (isRaTk) {
                          return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Selalu Buka</Badge>
                        }
                        const isUnlocked = school.sk_submission_unlocked === true
                        const isPending = toggleSkMutation.isPending
                        return (
                          <div className="flex flex-col items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isPending}
                              onClick={() => toggleSkMutation.mutate({
                                schoolId: school.id,
                                unlocked: isUnlocked ? null : true
                              })}
                              className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                                isUnlocked
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-red-50 text-red-600 hover:bg-red-100'
                              }`}
                            >
                              {isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : isUnlocked ? (
                                <><LockOpen className="h-3 w-3 mr-1" />Dibuka</>
                              ) : (
                                <><Lock className="h-3 w-3 mr-1" />Ditutup</>
                              )}
                            </Button>
                            <span className="text-[9px] text-slate-400">klik untuk toggle</span>
                          </div>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectSchool(school)
                        }}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {!isLoading && schools.length > 0 && (
            <div className="flex items-center justify-between p-6 border-t border-slate-100">
              <div className="text-sm font-medium text-slate-500">
                Halaman {currentPage} dari {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-200"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-200"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
