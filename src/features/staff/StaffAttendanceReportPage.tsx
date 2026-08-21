import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffAttendanceApi, staffApi } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { FileDown, Search, PlusCircle, CheckCircle2, Clock, UserX, HeartPulse, Plane, Building2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function StaffAttendanceReportPage() {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['staff-attendances', startDate, endDate],
    queryFn: () => staffAttendanceApi.list({ start_date: startDate, end_date: endDate }),
  });

  const { data: staffsData } = useQuery({
    queryKey: ['staffs-all'],
    queryFn: () => staffApi.list({ per_page: 500 }),
  });

  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    staff_id: '',
    tanggal: format(new Date(), 'yyyy-MM-dd'),
    status: 'Izin',
    jam_masuk: '',
    jam_pulang: ''
  });

  const manualMutation = useMutation({
    mutationFn: (data: any) => staffAttendanceApi.manualRecord(data),
    onSuccess: () => {
      toast.success("Kehadiran manual berhasil dicatat.");
      queryClient.invalidateQueries({ queryKey: ['staff-attendances'] });
      setIsManualDialogOpen(false);
      setManualForm({ ...manualForm, jam_masuk: '', jam_pulang: '', status: 'Izin' });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Gagal mencatat kehadiran manual.");
    }
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.staff_id) return toast.error("Pilih staff terlebih dahulu.");
    manualMutation.mutate(manualForm);
  };

  const attendanceList = Array.isArray(data) ? data : (data?.data || []);

  const handleExportExcel = () => {
    if (!attendanceList || attendanceList.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const summaryMap = new Map();
    const staffGroups = new Map();

    attendanceList.forEach((log: any) => {
      const name = log.staff?.nama || '-';
      const id = log.staff?.nomor_id || '-';
      const staffId = log.staff?.id || 'unknown';
      const statusRaw = String(log.status || '-').trim();
      const status = statusRaw.toLowerCase();
      
      // Populate Summary Map
      const key = `${id}_${name}`;
      if (!summaryMap.has(key)) {
        summaryMap.set(key, { 
          'Nomor ID': id, 
          'Nama Staff': name, 
          'Tepat Waktu': 0,
          'Terlambat': 0,
          'Izin': 0,
          'Sakit': 0,
          'Cuti': 0,
          'Dinas Luar': 0,
          'Alpa': 0 
        });
      }
      
      const counts = summaryMap.get(key);
      if (status === 'hadir') {
        counts['Tepat Waktu'] += 1;
      } else if (status === 'terlambat') {
        counts['Terlambat'] += 1;
      } else if (status.includes('hadir')) {
        counts['Tepat Waktu'] += 1;
      } else if (status.includes('izin')) {
        counts['Izin'] += 1;
      } else if (status.includes('sakit')) {
        counts['Sakit'] += 1;
      } else if (status.includes('cuti')) {
        counts['Cuti'] += 1;
      } else if (status.includes('dinas luar') || status.includes('dl')) {
        counts['Dinas Luar'] += 1;
      } else if (status.includes('alpa') || status.includes('absen') || status.includes('tidak hadir')) {
        counts['Alpa'] += 1;
      } else {
         if (!counts[statusRaw] && statusRaw !== '-') counts[statusRaw] = 0;
         if (statusRaw !== '-') counts[statusRaw] += 1;
      }

      // Populate Staff Groups for individual sheets
      if (!staffGroups.has(staffId)) {
        staffGroups.set(staffId, {
          staffInfo: log.staff || { nama: 'Unknown', nomor_id: '-' },
          logs: []
        });
      }
      staffGroups.get(staffId).logs.push(log);
    });

    const wb = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    // Create a sheet for each staff member
    staffGroups.forEach((group, staffId) => {
        const { staffInfo, logs } = group;
        
        const sheetData = [
            ['Laporan Absensi', `Periode: ${startDate} s/d ${endDate}`],
            ['Nama Staff', staffInfo.nama],
            ['ID Staff', staffInfo.nomor_id],
            [],
            ['Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status', 'Validasi GPS']
        ];
        
        logs.forEach((log: any) => {
            sheetData.push([
                log.tanggal ? format(new Date(log.tanggal), 'yyyy-MM-dd') : '-',
                log.jam_masuk || '-',
                log.jam_pulang || '-',
                log.status || '-',
                log.keterangan || '-',
                log.location_verified ? 'Valid (Di Kantor / Diverifikasi)' : 'Di Luar Area'
            ]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        
        // Style adjustments (optional basic widths)
        ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 35 }];
        
        // Ensure unique sheet name
        let baseName = (staffInfo.nama || 'Unknown').replace(/[\*\?\/\\\[\]:]/g, '').trim().substring(0, 25);
        let sheetName = baseName;
        let counter = 1;
        while (usedSheetNames.has(sheetName)) {
            sheetName = `${baseName} (${counter})`;
            counter++;
        }
        usedSheetNames.add(sheetName);

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // Create Summary Sheet
    const summaryData = Array.from(summaryMap.values());
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Rekapitulasi");

    XLSX.writeFile(wb, `Laporan_Absensi_Staff_${startDate}_sd_${endDate}.xlsx`);
  };

  // Hitung statistik ringkasan dari attendanceList
  const stats = React.useMemo(() => {
    const result = { tepatWaktu: 0, terlambat: 0, izin: 0, sakit: 0, cuti: 0, dinasLuar: 0, alpa: 0 };
    attendanceList.forEach((log: any) => {
      const s = String(log.status || '').toLowerCase().trim();
      if (s === 'hadir') result.tepatWaktu++;
      else if (s === 'terlambat') result.terlambat++;
      else if (s.includes('izin')) result.izin++;
      else if (s.includes('sakit')) result.sakit++;
      else if (s.includes('cuti')) result.cuti++;
      else if (s.includes('dinas luar') || s === 'dl') result.dinasLuar++;
      else if (s.includes('alpa') || s.includes('absen') || s.includes('tidak hadir')) result.alpa++;
    });
    return result;
  }, [attendanceList]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan Absensi Staff</h1>
          <p className="text-muted-foreground">Monitoring kehadiran harian staff LP Ma'arif NU Cilacap</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" className="bg-blue-600 hover:bg-blue-700">
                <PlusCircle className="mr-2 h-4 w-4" /> Catat Manual
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Catat Kehadiran Manual</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleManualSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Staff LP Ma'arif NU</Label>
                  <Select value={manualForm.staff_id} onValueChange={(val) => setManualForm({ ...manualForm, staff_id: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Staff" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffsData?.data?.map((s: any) => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tanggal</Label>
                  <Input type="date" required value={manualForm.tanggal} onChange={(e) => setManualForm({ ...manualForm, tanggal: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={manualForm.status} onValueChange={(val) => setManualForm({ ...manualForm, status: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Izin">Izin</SelectItem>
                      <SelectItem value="Sakit">Sakit</SelectItem>
                      <SelectItem value="Cuti">Cuti</SelectItem>
                      <SelectItem value="Dinas Luar">Dinas Luar</SelectItem>
                      <SelectItem value="Hadir">Hadir (Manual)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Jam Masuk (Opsional)</Label>
                    <Input type="time" value={manualForm.jam_masuk} onChange={(e) => setManualForm({ ...manualForm, jam_masuk: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Jam Pulang (Opsional)</Label>
                    <Input type="time" value={manualForm.jam_pulang} onChange={(e) => setManualForm({ ...manualForm, jam_pulang: e.target.value })} />
                  </div>
                </div>
                <Button type="submit" className="w-full mt-4" disabled={manualMutation.isPending}>
                  {manualMutation.isPending ? "Menyimpan..." : "Simpan Catatan"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleExportExcel}><FileDown className="mr-2 h-4 w-4" /> Export Excel</Button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Input 
          type="date" 
          value={startDate} 
          onChange={(e) => setStartDate(e.target.value)} 
          className="w-40"
        />
        <span>-</span>
        <Input 
          type="date" 
          value={endDate} 
          onChange={(e) => setEndDate(e.target.value)} 
          className="w-40"
        />
        <Button onClick={() => refetch()}><Search className="h-4 w-4 mr-2" /> Filter</Button>
      </div>

      {/* Summary Stats Cards */}
      {attendanceList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col items-center gap-1">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-2xl font-bold text-emerald-700">{stats.tepatWaktu}</span>
            <span className="text-[11px] text-emerald-600 font-medium text-center">Tepat Waktu</span>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex flex-col items-center gap-1">
            <Clock className="h-5 w-5 text-orange-500" />
            <span className="text-2xl font-bold text-orange-600">{stats.terlambat}</span>
            <span className="text-[11px] text-orange-500 font-medium text-center">Terlambat</span>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col items-center gap-1">
            <Plane className="h-5 w-5 text-blue-500" />
            <span className="text-2xl font-bold text-blue-600">{stats.izin}</span>
            <span className="text-[11px] text-blue-500 font-medium text-center">Izin</span>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex flex-col items-center gap-1">
            <HeartPulse className="h-5 w-5 text-yellow-600" />
            <span className="text-2xl font-bold text-yellow-700">{stats.sakit}</span>
            <span className="text-[11px] text-yellow-600 font-medium text-center">Sakit</span>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex flex-col items-center gap-1">
            <CheckCircle2 className="h-5 w-5 text-purple-500" />
            <span className="text-2xl font-bold text-purple-600">{stats.cuti}</span>
            <span className="text-[11px] text-purple-500 font-medium text-center">Cuti</span>
          </div>
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex flex-col items-center gap-1">
            <Building2 className="h-5 w-5 text-sky-500" />
            <span className="text-2xl font-bold text-sky-600">{stats.dinasLuar}</span>
            <span className="text-[11px] text-sky-500 font-medium text-center">Dinas Luar</span>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex flex-col items-center gap-1">
            <UserX className="h-5 w-5 text-red-500" />
            <span className="text-2xl font-bold text-red-600">{stats.alpa}</span>
            <span className="text-[11px] text-red-500 font-medium text-center">Alpa</span>
          </div>
        </div>
      )}

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Nama Staff</TableHead>
              <TableHead>Masuk</TableHead>
              <TableHead>Pulang</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Kepentingan / Keterangan</TableHead>
              <TableHead>Validasi GPS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center">Loading...</TableCell></TableRow>
            ) : attendanceList.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center">Tidak ada data absensi</TableCell></TableRow>
            ) : (
              attendanceList.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell>{log.tanggal ? format(new Date(log.tanggal), 'yyyy-MM-dd') : '-'}</TableCell>
                  <TableCell>
                    <div className="font-medium">{log.staff?.nama}</div>
                    {log.staff?.nomor_id && <div className="text-xs text-muted-foreground">{log.staff?.nomor_id}</div>}
                  </TableCell>
                  <TableCell>{log.jam_masuk || '-'}</TableCell>
                  <TableCell>{log.jam_pulang || '-'}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        log.status === 'Hadir' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' :
                        log.status === 'Terlambat' ? 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100' :
                        log.status === 'Dinas Luar' ? 'bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100' :
                        log.status === 'Sakit' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100' :
                        log.status === 'Cuti' ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100' :
                        log.status === 'Izin' ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' :
                        'bg-red-100 text-red-700 border-red-200 hover:bg-red-100'
                      }
                      variant="outline"
                    >
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[220px] text-xs truncate" title={log.keterangan || '-'}>
                      {log.keterangan || <span className="text-slate-400 italic">-</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.location_verified ? (
                      <span className="text-green-600 font-semibold">Valid (Di Kantor / Diverifikasi)</span>
                    ) : (
                      <span className="text-red-600 font-semibold">Di Luar Area</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
