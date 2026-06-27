import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffAttendanceApi, staffApi } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { FileDown, Search, PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

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

          <Button variant="outline"><FileDown className="mr-2 h-4 w-4" /> Export Excel</Button>
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

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Nama Staff</TableHead>
              <TableHead>Masuk</TableHead>
              <TableHead>Pulang</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Validasi GPS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
            ) : attendanceList.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center">Tidak ada data absensi</TableCell></TableRow>
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
                    <Badge variant={log.status === 'Hadir' ? 'default' : log.status === 'Sakit' ? 'secondary' : log.status === 'Izin' ? 'outline' : 'destructive'}>{log.status}</Badge>
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
