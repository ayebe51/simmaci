import { useQuery } from "@tanstack/react-query";
import { activityLogApi } from "@/lib/api";
import { useState } from "react";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Search, Activity, CalendarDays, RefreshCw } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

export default function ActivityLogPage() {
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [eventFilter, setEventFilter] = useState("all");
    
    const debouncedSearch = useDebounce(searchTerm, 500);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['activity-logs', page, debouncedSearch, eventFilter],
        queryFn: () => activityLogApi.list({
            page,
            search: debouncedSearch,
            event: eventFilter === 'all' ? undefined : eventFilter,
        }),
    });

    const getEventBadgeColor = (event: string) => {
        switch (event) {
            case 'created': return 'bg-emerald-100 text-emerald-800';
            case 'updated': return 'bg-blue-100 text-blue-800';
            case 'deleted': return 'bg-rose-100 text-rose-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Log Aktivitas</h1>
                <p className="text-muted-foreground">
                    Riwayat aktivitas dan perubahan data dalam sistem
                </p>
            </div>

            <Card className="border-t-4 border-t-indigo-500 shadow-lg">
                <CardHeader className="bg-slate-50 border-b">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center space-x-2">
                            <Activity className="h-5 w-5 text-indigo-500" />
                            <CardTitle className="text-lg">Audit Trail</CardTitle>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari deskripsi / subjek..."
                                    className="pl-9 bg-white"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select value={eventFilter} onValueChange={setEventFilter}>
                                <SelectTrigger className="w-full sm:w-[150px] bg-white">
                                    <SelectValue placeholder="Semua Event" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Event</SelectItem>
                                    <SelectItem value="created">Created</SelectItem>
                                    <SelectItem value="updated">Updated</SelectItem>
                                    <SelectItem value="deleted">Deleted</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh Data">
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="border rounded-md m-4 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[180px]">Waktu</TableHead>
                                    <TableHead className="w-[180px]">Pelaku</TableHead>
                                    <TableHead>Deskripsi Aktivitas</TableHead>
                                    <TableHead className="w-[100px]">Event</TableHead>
                                    <TableHead className="w-[180px]">Sekolah</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            Memuat data log aktivitas...
                                        </TableCell>
                                    </TableRow>
                                ) : data?.data?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            Tidak ada aktivitas yang ditemukan.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data?.data?.map((log: any) => (
                                        <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                                            <TableCell className="whitespace-nowrap font-medium text-xs text-slate-500">
                                                <div className="flex items-center gap-2">
                                                    <CalendarDays className="h-3 w-3" />
                                                    {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: id })}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-sm text-slate-900">
                                                    {log.causer ? log.causer.name : 'System / Otomatis'}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {log.causer?.role === 'super_admin' ? 'Super Admin' : log.causer?.role}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm text-slate-700">{log.description}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`capitalize ${getEventBadgeColor(log.event)} border-none`}>
                                                    {log.event || 'System'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-600">
                                                {log.school ? log.school.nama : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {data?.last_page > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50">
                            <div className="text-sm text-muted-foreground">
                                Menampilkan <span className="font-medium">{data.from || 0}</span> - <span className="font-medium">{data.to || 0}</span> dari <span className="font-medium">{data.total}</span> data
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    Sebelumnya
                                </Button>
                                <div className="text-sm font-medium px-4">
                                    Halaman {page} / {data.last_page}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(data.last_page, p + 1))}
                                    disabled={page === data.last_page}
                                >
                                    Selanjutnya
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
