import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Download, FileText, Search, Loader2 } from "lucide-react"
import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
// 🔥 CONVEX REAL-TIME
import { useQuery, usePaginatedQuery, useConvex } from "convex/react"
import { api as convexApi } from "../../../convex/_generated/api"
// Import Service
import { generateSingleSkDocx } from "@/services/SkGeneratorService"
import { toast } from "sonner"
import { toast } from "sonner"
import { SimplePagination } from "@/components/ui/simple-pagination" // Check if this exists, otherwise use standard buttons

interface SkDocument {
  id: string
  nomorSurat?: string
  nama: string
  jabatan: string
  status: string
  [key: string]: any
}

interface HeadmasterApproval {
  id: string
  periode: number
  status: string
  skUrl?: string
  teacher?: { nama: string }
  school?: { nama: string }
  [key: string]: any
}

export default function MySkPage() {
  const convex = useConvex()
  const [searchTerm, setSearchTerm] = useState("")
  const [user] = useState<any>(() => {
    try {
        const str = localStorage.getItem("user")
        return str ? JSON.parse(str) : null
    } catch { return null }
  })

  // Determine if user has admin privileges
  const isSuper = ["super_admin", "admin_yayasan", "admin"].includes(user?.role || "")

  // Client-side pagination state
  const [currentSkPage, setCurrentSkPage] = useState(1);
  const itemsPerSkPage = 10;
  
  const [currentHmPage, setCurrentHmPage] = useState(1);
  const itemsPerHmPage = 10;

  // 🔥 QUERY for SK (Fetching all active for this unit, then paginating client-side)
  // This is safe assuming the total number of SKs per unit is manageable.
  // For massive datasets, backend pagination with skip/take would be needed.
  // 🔥 QUERY for SK (Using usePaginatedQuery as required by the backend schema)
  const {
      results: rawSkData,
      status: skQueryStatus,
      loadMore: loadMoreSk
  } = usePaginatedQuery(
      convexApi.sk.list, 
      {
        unitKerja: isSuper ? undefined : (user?.unitKerja || undefined),
        status: "active", // Only show active/approved SK
        userRole: user?.role,
        search: searchTerm || undefined // Pass search term to backend
      },
      { initialNumItems: 100 } // Load a decent chunk initially
  )
  const isSkLoading = skQueryStatus === "LoadingFirstPage";
  const allSkResults = rawSkData || [];

  // 🔥 QUERY for Headmaster
  const rawHmData = useQuery(
      convexApi.headmasters.list, 
      {
        schoolName: user?.unitKerja || undefined,
      }
  )
  const isHmLoading = rawHmData === undefined;
  const allHmResults = rawHmData ? (Array.isArray(rawHmData) ? rawHmData : (rawHmData as any).page || []) : [];

  // Map Convex SK data to SkDocument interface
  const mappedSkList: SkDocument[] = useMemo(() => {
    return allSkResults.map((doc: any) => ({
      id: doc._id,
      nomorSurat: doc.nomorSk,
      nama: doc.nama,
      jabatan: doc.jabatan || "-",
      jenisSk: doc.jenisSk, 
      status: doc.status === "active" ? "Approved" : doc.status,
    }))
  }, [allSkResults])

  // Derive paginated list
  const skTotalPages = Math.ceil(mappedSkList.length / itemsPerSkPage);
  const skList = mappedSkList.slice((currentSkPage - 1) * itemsPerSkPage, currentSkPage * itemsPerSkPage);

  // Map Convex Headmaster data to HeadmasterApproval interface
  const mappedHeadmasterSkList: HeadmasterApproval[] = useMemo(() => {
    return allHmResults.map((hm: any) => ({
      id: hm.id || hm._id, // Handle fallback
      periode: hm.periode,
      status: hm.status === "approved" ? "Approved" : hm.status,
      skUrl: hm.skUrl,
      teacher: hm.teacher ? { nama: hm.teacher.nama } : { nama: hm.teacherName },
      school: hm.school ? { nama: hm.school.nama } : { nama: hm.schoolName },
    }))
  }, [allHmResults])

  const hmTotalPages = Math.ceil(mappedHeadmasterSkList.length / itemsPerHmPage);
  const headmasterSkList = mappedHeadmasterSkList.slice((currentHmPage - 1) * itemsPerHmPage, currentHmPage * itemsPerHmPage);


  // Handle Download (Updated to Fetch from Database Base64)
  const handleDownload = async (sk: SkDocument) => {
      try {
          toast.info("1/2 Mengambil template dari server...", { duration: 2000 })
          
          const { getTemplateId } = await import("@/services/SkGeneratorService")
          const templateId = getTemplateId(sk)
          
          // 2. Get Content from Convex (NEW MODULE: settings_cloud)
          const getQuery = (convexApi as any).settings_cloud?.getContent
          
          if (!getQuery) {
             throw new Error("API settings_cloud belum dimuat. Coba Refresh Halaman.")
          }

          let templateContent: any = null // ArrayBuffer or String
          const result = await convex.query(getQuery, { key: templateId })

          if (result && typeof result === 'string' && !result.startsWith("http")) {
               // BASE64 MODE (Database)
               const base64 = result.split(',')[1] || result;
               const binaryString = window.atob(base64);
               const len = binaryString.length;
               const bytes = new Uint8Array(len);
               for (let i = 0; i < len; i++) {
                   bytes[i] = binaryString.charCodeAt(i);
               }
               templateContent = bytes.buffer;
          } else if (result && typeof result === 'string' && result.startsWith("http")) {
                // LEGACY URL MODE (File Storage)
                const res = await fetch(result)
                const blob = await res.blob()
                templateContent = await blob.arrayBuffer()
          }
          
          if (templateContent) {
              toast.success("2/2 Template didapat! Membuat dokumen...")
              // 4. Generate with ArrayBuffer
              await generateSingleSkDocx(sk, templateContent)
              toast.success("Selesai! File terdownload.")
          } else {
             toast.warning(`Gagal: Template Cloud Kosong. (Key: ${templateId})`)
             generateSingleSkDocx(sk, null)
          }

      } catch (error: any) {
          console.error("Gagal download template:", error)
          toast.error("Gagal mengambil template. Coba upload ulang.")
          generateSingleSkDocx(sk, null)
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Arsip SK Unit Kerja</h1>
        <p className="text-muted-foreground">
           Daftar SK yang diterbitkan untuk: <span className="font-semibold text-foreground">{user?.unitKerja || "Semua Unit"}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Daftar SK Digital</CardTitle>
                    <CardDescription>SK yang telah diterbitkan dan ditandatangani secara digital.</CardDescription>
                </div>
                <div className="relative w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Cari nama atau nomor SK..." 
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border max-h-[500px] overflow-auto">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_3px_0_rgb(0,0,0,0.1)]">
                        <TableRow>
                            <TableHead>Nomor SK</TableHead>
                            <TableHead>Nama Guru / PTK</TableHead>
                            <TableHead>Jabatan</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                <TableBody>
                    {mappedSkList.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                {isSkLoading ? "Memuat data..." : "Belum ada SK yang diterbitkan untuk unit ini."}
                            </TableCell>
                        </TableRow>
                    ): (
                        skList.map((sk, i) => (
                            <TableRow key={i}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-500" />
                                        {sk.nomorSurat || <span className="text-muted-foreground italic">Pending</span>}
                                    </div>
                                </TableCell>
                                <TableCell>{sk.nama}</TableCell>
                                <TableCell>{sk.jabatan}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={
                                        sk.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                                        sk.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" :
                                        "bg-yellow-50 text-yellow-700 border-yellow-200"
                                    }>
                                        {sk.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    {sk.status === 'Approved' && (
                                        <Button size="sm" variant="outline" onClick={() => handleDownload(sk)}>
                                            <FileText className="mr-2 h-3 w-3" />
                                            Unduh Word
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            </div>

            <div className="flex items-center justify-between py-4">
                <span className="text-sm text-muted-foreground">
                    Menampilkan {skList.length > 0 ? (currentSkPage - 1) * itemsPerSkPage + 1 : 0} - {Math.min(currentSkPage * itemsPerSkPage, mappedSkList.length)} dari {mappedSkList.length} data
                </span>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm"
                        disabled={currentSkPage <= 1}
                        onClick={() => setCurrentSkPage(p => Math.max(1, p - 1))}
                    >
                        Sebelumnya
                    </Button>
                    <div className="text-sm font-medium mx-2 pr-2">
                         Halaman {currentSkPage} dari {skTotalPages || 1}
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm"
                        disabled={currentSkPage >= skTotalPages}
                        onClick={() => setCurrentSkPage(p => Math.min(skTotalPages, p + 1))}
                    >
                        Selanjutnya
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>

      {/* --- SECTION FOR HEADMASTER SK --- */}
      <Card>
        <CardHeader>
             <CardTitle>Riwayat Pengangkatan Kepala Madrasah</CardTitle>
             <CardDescription>Status pengajuan SK Kepala Madrasah.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="rounded-md border max-h-[400px] overflow-auto">
             <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_3px_0_rgb(0,0,0,0.1)]">
                    <TableRow>
                        <TableHead>Nama Calon</TableHead>
                        <TableHead>Periode</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>SK Final</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {mappedHeadmasterSkList.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{isHmLoading ? "Memuat data..." : "Tidak ada data."}</TableCell></TableRow>
                    ) : (
                        headmasterSkList.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    {item.teacher?.nama}
                                    <div className="text-xs text-muted-foreground">{item.school?.nama}</div>
                                </TableCell>
                                <TableCell>Periode Ke-{item.periode}</TableCell>
                                <TableCell>
                                     <Badge variant="outline" className={
                                        item.status === 'Approved' ? "bg-green-50 text-green-700 border-green-200" :
                                        "bg-yellow-50 text-yellow-700 border-yellow-200"
                                    }>
                                        {item.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {item.skUrl ? (
                                        <Button size="sm" variant="outline" className="text-blue-600" onClick={() => window.open(item.skUrl, '_blank')}>
                                            <Download className="w-4 h-4 mr-1" /> Unduh SK
                                        </Button>
                                    ) : item.status === 'Approved' ? (
                                        <span className="text-xs text-muted-foreground">Belum diupload</span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
             </Table>
             </div>

            <div className="flex items-center justify-between py-4">
                <span className="text-sm text-muted-foreground">
                    Menampilkan {headmasterSkList.length > 0 ? (currentHmPage - 1) * itemsPerHmPage + 1 : 0} - {Math.min(currentHmPage * itemsPerHmPage, mappedHeadmasterSkList.length)} dari {mappedHeadmasterSkList.length} data
                </span>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm"
                        disabled={currentHmPage <= 1}
                        onClick={() => setCurrentHmPage(p => Math.max(1, p - 1))}
                    >
                        Sebelumnya
                    </Button>
                    <div className="text-sm font-medium mx-2 pr-2">
                         Halaman {currentHmPage} dari {hmTotalPages || 1}
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm"
                        disabled={currentHmPage >= hmTotalPages}
                        onClick={() => setCurrentHmPage(p => Math.min(hmTotalPages, p + 1))}
                    >
                        Selanjutnya
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  )
}
