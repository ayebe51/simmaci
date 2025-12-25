import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Download, FileText, Search } from "lucide-react"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"

import { api } from "@/lib/api"
// ...

export default function MySkPage() {
  const [skList, setSkList] = useState<any[]>([])
  const [filteredSk, setFilteredSk] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    // 1. Get User
    const userStr = localStorage.getItem("user")
    if (userStr) setUser(JSON.parse(userStr))

    // 2. Fetch SK Data
    fetchSk()
  }, [])

  const fetchSk = async () => {
      try {
          const data = await api.getSk()
          setSkList(data)
          setFilteredSk(data)
      } catch (err) {
          console.error("Failed to fetch SK", err)
      }
  }

  useEffect(() => {
    if (!searchTerm) {
        setFilteredSk(skList)
        return
    }
    const lower = searchTerm.toLowerCase()
    const filtered = skList.filter(item => 
        item.nama.toLowerCase().includes(lower) || 
        (item.nomorSurat && item.nomorSurat.toLowerCase().includes(lower)) ||
        item.jabatan.toLowerCase().includes(lower)
    )
    setFilteredSk(filtered)
  }, [searchTerm, skList])

  const handleDownload = (sk: any) => {
      // Simulation
      alert(`Mendownload SK: ${sk.nomorSurat || 'Draft'} untuk ${sk.nama}`)
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
                        filteredSk.map((sk, i) => (
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
        </CardContent>
      </Card>
    </div>
  )
}
