import { useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Filter, Calendar, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BlastStatusBadge } from "./components/BlastStatusBadge"
import { useWaBlasts } from "./hooks/useWaBlasts"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { Skeleton } from "@/components/ui/skeleton"

export default function WaBlastListPage() {
  const [filters, setFilters] = useState({
    status: "all",
    date_from: "",
    date_to: "",
    search: "",
  })

  // Transform filters for API - convert "all" to undefined
  const apiFilters = {
    ...filters,
    status: filters.status === "all" ? undefined : filters.status,
  }

  const { data, isLoading, error } = useWaBlasts(apiFilters)

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">WA Blast</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola pengiriman pesan WhatsApp massal
          </p>
        </div>
        <Link to="/dashboard/wa-blast/create">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" />
            Buat Blast Baru
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari judul blast..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={filters.status}
              onValueChange={(value) => handleFilterChange("status", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Terjadwal</SelectItem>
                <SelectItem value="sending">Mengirim</SelectItem>
                <SelectItem value="completed">Selesai</SelectItem>
                <SelectItem value="failed">Gagal</SelectItem>
              </SelectContent>
            </Select>

            {/* Date From */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                type="date"
                placeholder="Dari Tanggal"
                value={filters.date_from}
                onChange={(e) => handleFilterChange("date_from", e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Date To */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                type="date"
                placeholder="Sampai Tanggal"
                value={filters.date_to}
                onChange={(e) => handleFilterChange("date_to", e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-500">
              Gagal memuat data blast. Silakan coba lagi.
            </div>
          ) : !data?.data || data.data.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">Belum ada blast session.</p>
              <Link to="/dashboard/wa-blast/create">
                <Button className="mt-4" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Buat Blast Pertama
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Judul</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-center">Total Penerima</TableHead>
                  <TableHead className="text-center">Terkirim</TableHead>
                  <TableHead className="text-center">Gagal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((blast: any) => (
                  <TableRow key={blast.id}>
                    <TableCell className="font-medium">{blast.title}</TableCell>
                    <TableCell>
                      {blast.scheduled_at
                        ? format(new Date(blast.scheduled_at), "dd MMM yyyy HH:mm", {
                            locale: id,
                          })
                        : blast.created_at
                        ? format(new Date(blast.created_at), "dd MMM yyyy HH:mm", {
                            locale: id,
                          })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {blast.total_recipients || 0}
                    </TableCell>
                    <TableCell className="text-center text-emerald-600 font-semibold">
                      {blast.sent_count || 0}
                    </TableCell>
                    <TableCell className="text-center text-red-600 font-semibold">
                      {blast.failed_count || 0}
                    </TableCell>
                    <TableCell>
                      <BlastStatusBadge status={blast.blast_status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/dashboard/wa-blast/${blast.id}`}>
                        <Button variant="ghost" size="sm">
                          Detail
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination (if needed) */}
      {data?.meta && data.meta.last_page > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Menampilkan {data.meta.from} - {data.meta.to} dari {data.meta.total}{" "}
            blast
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.meta.current_page === 1}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.meta.current_page === data.meta.last_page}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
