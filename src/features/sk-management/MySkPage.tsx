import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Download, FileText, Search } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"

import { api } from "@/lib/api"

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
  const [skList, setSkList] = useState<SkDocument[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [user] = useState<any>(() => {
    try {
        const str = localStorage.getItem("user")
        return str ? JSON.parse(str) : null
    } catch { return null }
  })

  const [headmasterSkList, setHeadmasterSkList] = useState<HeadmasterApproval[]>([])

  // Pagination States
  const [currentSkPage, setCurrentSkPage] = useState(1)
  const [currentHmPage, setCurrentHmPage] = useState(1)
  const itemsPerPage = 10

  // Derived state for filtering
  const filteredSk = useMemo(() => {
    if(!searchTerm) return skList
    const lower = searchTerm.toLowerCase()
    return skList.filter(item => 
        (item.nama || "").toLowerCase().includes(lower) || 
        (item.nomorSurat && item.nomorSurat.toLowerCase().includes(lower)) ||
        (item.jabatan || "").toLowerCase().includes(lower)
    )
  }, [skList, searchTerm])

  useEffect(() => {
      const loadSkData = async () => {
          try {
              const [data, hmRes] = await Promise.all([
                  api.getSk(),
                  api.getHeadmasterTenures()
              ])
              
              setSkList(data)

               // Filter HM Data by Unit Kerja
               if (user?.unitKerja) {
                    const allHm = Array.isArray(hmRes) ? hmRes : (hmRes as any).data || []
                    const myHm = allHm.filter((h: any) => 
                       h.school?.nama === user.unitKerja || h.teacher?.nama === user.name
                    )
                    setHeadmasterSkList(myHm)
               }
          } catch (err) {
              console.error("Failed to fetch SK", err)
          }
      }
      
      loadSkData()
  }, [user])



  const handleDownload = (sk: SkDocument) => {
      // Simulation
      alert(`Mendownload SK: ${sk.nomorSurat || 'Draft'} untuk ${sk.nama}`)
  }

  // Pagination Logic for SK Digital
  const totalSkPages = Math.ceil(filteredSk.length / itemsPerPage)
  const paginatedSk = filteredSk.slice(
      (currentSkPage - 1) * itemsPerPage,
      currentSkPage * itemsPerPage
  )

  // Pagination Logic for Headmaster SK
  const totalHmPages = Math.ceil(headmasterSkList.length / itemsPerPage)
  const paginatedHm = headmasterSkList.slice(
      (currentHmPage - 1) * itemsPerPage,
      currentHmPage * itemsPerPage
  )

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
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nomor SK</TableHead>
                        <TableHead>Nama Guru / PTK</TableHead>
                        <TableHead>Jabatan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredSk.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                Belum ada SK yang diterbitkan untuk unit ini.
                            </TableCell>
                        </TableRow>
                    ): (
                        paginatedSk.map((sk, i) => (
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
                                            <Download className="mr-2 h-3 w-3" />
                                            Unduh PDF
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {/* Pagination Controls for SK Digital */}
            {filteredSk.length > itemsPerPage && (
              <div className="flex items-center justify-end space-x-2 py-4 px-2">
                <div className="flex-1 text-sm text-muted-foreground">
                  Halaman {currentSkPage} dari {totalSkPages} ({filteredSk.length} data)
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentSkPage(1)}
                    disabled={currentSkPage === 1}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentSkPage(p => Math.max(1, p - 1))}
                    disabled={currentSkPage === 1}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentSkPage(p => Math.min (totalSkPages, p + 1))}
                    disabled={currentSkPage === totalSkPages}
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentSkPage(totalSkPages)}
                    disabled={currentSkPage === totalSkPages}
                  >
                    Last
                  </Button>
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* --- SECTION FOR HEADMASTER SK --- */}
      <Card>
        <CardHeader>
             <CardTitle>Riwayat Pengangkatan Kepala Madrasah</CardTitle>
             <CardDescription>Status pengajuan SK Kepala Madrasah.</CardDescription>
        </CardHeader>
        <CardContent>
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nama Calon</TableHead>
                        <TableHead>Periode</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>SK Final</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {headmasterSkList.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Tidak ada data.</TableCell></TableRow>
                    ) : (
                        paginatedHm.map((item) => (
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

             {/* Pagination Controls for Headmaster SK */}
             {headmasterSkList.length > itemsPerPage && (
               <div className="flex items-center justify-end space-x-2 py-4 px-2">
                 <div className="flex-1 text-sm text-muted-foreground">
                   Halaman {currentHmPage} dari {totalHmPages} ({headmasterSkList.length} data)
                 </div>
                 <div className="space-x-2">
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => setCurrentHmPage(1)}
                     disabled={currentHmPage === 1}
                   >
                     First
                   </Button>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => setCurrentHmPage(p => Math.max(1, p - 1))}
                     disabled={currentHmPage === 1}
                   >
                     Prev
                   </Button>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => setCurrentHmPage(p => Math.min(totalHmPages, p + 1))}
                     disabled={currentHmPage === totalHmPages}
                   >
                     Next
                   </Button>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => setCurrentHmPage(totalHmPages)}
                     disabled={currentHmPage === totalHmPages}
                   >
                     Last
                   </Button>
                 </div>
               </div>
             )}
        </CardContent>
      </Card>
    </div>
  )
}
