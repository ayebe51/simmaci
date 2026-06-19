import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { staffAttendanceApi } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { FileDown, Search } from 'lucide-react';

export default function StaffAttendanceReportPage() {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['staff-attendances', startDate, endDate],
    queryFn: () => staffAttendanceApi.list({ start_date: startDate, end_date: endDate }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan Absensi Staff</h1>
          <p className="text-muted-foreground">Monitoring kehadiran harian staff PCNU Cilacap</p>
        </div>
        <Button variant="outline"><FileDown className="mr-2 h-4 w-4" /> Export Excel</Button>
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
            ) : data?.data?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center">Tidak ada data absensi</TableCell></TableRow>
            ) : (
              data?.data?.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell>{log.tanggal}</TableCell>
                  <TableCell className="font-medium">{log.staff?.nama}</TableCell>
                  <TableCell>{log.jam_masuk || '-'}</TableCell>
                  <TableCell>{log.jam_pulang || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === 'Hadir' ? 'default' : 'destructive'}>{log.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {log.location_verified ? (
                      <span className="text-green-600 font-semibold">Valid (Di Kantor)</span>
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
