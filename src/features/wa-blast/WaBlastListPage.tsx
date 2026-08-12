import { useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Filter, Calendar, Search, FilterX } from "lucide-react"
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
  const [page, setPage] = useState(1)

  // Transform filters for API - convert "all" to undefined
  const apiFilters = {
    ...filters,
    status: filters.status === "all" ? undefined : filters.status,
    page,
  }

  const { data, isLoading, error } = useWaBlasts(apiFilters)

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  return (
    <div className="space-y-6">
      {/* PAGE HEADER — List pattern */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 truncate">WA Blast</h1>
          <p className="text-sm text-slate-500 mt-1 truncate">Kelola pengiriman pesan WhatsApp massal</p>
        </div>
        <Link to="/dashboard/wa-blast/create">
          <Button variant="default" size="sm">
            <Plus className="h-3.5 w-3.5" />
            Buat Blast Baru
          </Button>
        </Link>
      </div>

      {/* Inline Filter Toolbar — compact, proximity to table */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Cari judul blast..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={filters.status}
              onValueChange={(value) => handleFilterChange("status", value)}
            >
              <SelectTrigger className="h-8 w-[150px] text-sm">
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
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Input
                type="date"
                placeholder="Dari Tanggal"
                value={filters.date_from}
                onChange={(e) => handleFilterChange("date_from", e.target.value)}
                className="pl-9 h-8 text-sm w-[145px]"
              />
            </div>

            {/* Date To */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Input
                type="date"
                placeholder="Sampai Tanggal"
                value={filters.date_to}
                onChange={(e) => handleFilterChange("date_to", e.target.value)}
                className="pl-9 h-8 text-sm w-[145px]"
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
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <FilterX className="h-8 w-8 text-red-300" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-slate-600">Gagal memuat data</p>
              <p className="text-xs text-slate-400">Silakan coba lagi atau hubungi administrator</p>
            </div>
          ) : !data?.data || !Array.isArray(data.data) || data.data.length === 0 ? (
            <div className="p-12 text-center">
              {/* Differentiate: no data vs no search/filter result */}
              {filters.search || filters.status !== 'all' || filters.date_from || filters.date_to ? (
                <div className="flex flex-col items-center gap-2">
                  <FilterX className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-slate-500">Tidak ada blast yang sesuai filter</p>
                  <p className="text-xs text-slate-400">Coba ubah kata kunci atau tanggal filter</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Plus className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-slate-500">Belum ada blast session</p>
                  <Link to="/dashboard/wa-blast/create">
                    <Button className="mt-3" variant="outline" size="sm">
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Buat Blast Pertama
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
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
      {data && data.last_page > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Menampilkan {data.total === 0 ? 0 : (data.current_page - 1) * data.per_page + 1} - {Math.min(data.current_page * data.per_page, data.total)} dari {data.total}{" "}
            blast
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.current_page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.current_page >= data.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
