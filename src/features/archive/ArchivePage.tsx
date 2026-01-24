import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Archive, RotateCcw, Trash2, Search } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Id } from "../../../convex/_generated/dataModel"

export default function ArchivePage() {
  const [jenisFilter, setJenisFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [targetSk, setTargetSk] = useState<any>(null)

  // Get user from localStorage
  const userStr = localStorage.getItem("user")
  const user = userStr ? JSON.parse(userStr) : null

  // Fetch archived SKs
  const archivedSks = useQuery(api.archive.getArchivedSks, {
    jenisSk: jenisFilter,
    search: searchQuery || undefined,
  })

  // Fetch archive stats
  const archiveStats = useQuery(api.archive.getArchiveStats)

  // Mutations
  const restoreMutation = useMutation(api.archive.restoreSk)
  const bulkRestoreMutation = useMutation(api.archive.bulkRestore)

  const handleRestore = async (skId: string) => {
    if (!user?._id) return

    try {
      toast.info("Memulihkan SK...")
      await restoreMutation({
        skId: skId as Id<"skDocuments">,
        restoredBy: user._id,
      })
      toast.success("SK berhasil dipulihkan!")
      setRestoreDialogOpen(false)
      setTargetSk(null)
    } catch (error) {
      console.error(error)
      toast.error("Gagal memulihkan SK: " + (error as Error).message)
    }
  }

  const handleBulkRestore = async () => {
    if (!user?._id || selectedIds.length === 0) return

    try {
      toast.info(`Memulihkan ${selectedIds.length} SK...`)
      const result = await bulkRestoreMutation({
        skIds: selectedIds as Id<"skDocuments">[],
        restoredBy: user._id,
      })
      toast.success(`${result.restored} SK berhasil dipulihkan!`)
      setSelectedIds([])
    } catch (error) {
      console.error(error)
      toast.error("Gagal memulihkan SK: " + (error as Error).message)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked && archivedSks) {
      setSelectedIds(archivedSks.map(sk => sk._id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (skId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, skId])
    } else {
      setSelectedIds(selectedIds.filter(id => id !== skId))
    }
  }

  const openRestoreDialog = (sk: any) => {
    setTargetSk(sk)
    setRestoreDialogOpen(true)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const getJenisBadge = (jenis: string) => {
    const colors: Record<string, string> = {
      gty: "bg-blue-100 text-blue-800",
      gtt: "bg-green-100 text-green-800",
      kamad: "bg-purple-100 text-purple-800",
      tendik: "bg-orange-100 text-orange-800",
    }
    return colors[jenis] || "bg-gray-100 text-gray-800"
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Archive Management</h1>
        <p className="text-muted-foreground">
          View and restore archived SK documents
        </p>
      </div>

      {/* Archive Statistics */}
      {archiveStats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Archived</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{archiveStats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">GTY</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{archiveStats.byType.gty}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">GTT</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{archiveStats.byType.gtt}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Kamad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{archiveStats.byType.kamad}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tendik</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{archiveStats.byType.tendik}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Archived SK Documents</CardTitle>
          <CardDescription>
            Manage archived documents - restore or permanently delete
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <Select value={jenisFilter} onValueChange={setJenisFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Jenis SK" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                <SelectItem value="gty">GTY</SelectItem>
                <SelectItem value="gtt">GTT</SelectItem>
                <SelectItem value="kamad">Kamad</SelectItem>
                <SelectItem value="tendik">Tendik</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nomor SK atau nama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedIds.length > 0 && (
            <div className="flex gap-2 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-sm font-medium text-blue-900">
                {selectedIds.length} SK dipilih
              </span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={handleBulkRestore}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Pulihkan
                </Button>
                {user?.role === "super_admin" && (
                  <Button size="sm" variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Hapus Permanen
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === archivedSks?.length && archivedSks.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded"
                      aria-label="Select all archived SKs"
                    />
                  </TableHead>
                  <TableHead>Nomor SK</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Unit Kerja</TableHead>
                  <TableHead>Archived At</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!archivedSks ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center h-24">
                      Memuat...
                    </TableCell>
                  </TableRow>
                ) : archivedSks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                      <Archive className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Tidak ada SK yang diarsipkan</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  archivedSks.map((sk) => (
                    <TableRow key={sk._id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(sk._id)}
                          onChange={(e) => handleSelectOne(sk._id, e.target.checked)}
                          className="rounded"
                          aria-label={`Select SK ${sk.nomorSk}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{sk.nomorSk}</TableCell>
                      <TableCell>{sk.nama}</TableCell>
                      <TableCell>
                        <Badge className={getJenisBadge(sk.jenisSk)}>
                          {sk.jenisSk.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{sk.unitKerja || "-"}</TableCell>
                      <TableCell className="text-sm">
                        {sk.archivedAt ? formatDate(sk.archivedAt) : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {sk.archiveReason || "-"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRestoreDialog(sk)}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Pulihkan
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pulihkan SK?</DialogTitle>
            <DialogDescription>
              SK akan dipulihkan ke status aktif dan muncul kembali di daftar SK.
            </DialogDescription>
          </DialogHeader>
          {targetSk && (
            <div className="py-4 space-y-2">
              <p className="text-sm">
                <span className="font-medium">Nomor SK:</span> {targetSk.nomorSk}
              </p>
              <p className="text-sm">
                <span className="font-medium">Nama:</span> {targetSk.nama}
              </p>
              <p className="text-sm">
                <span className="font-medium">Jenis:</span> {targetSk.jenisSk.toUpperCase()}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => targetSk && handleRestore(targetSk._id)}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Pulihkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
