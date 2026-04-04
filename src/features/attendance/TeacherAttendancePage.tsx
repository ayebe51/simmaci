import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Clock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teacherApi, attendanceApi } from "@/lib/api";

const statusColors: Record<string, string> = {
  Hadir: "bg-emerald-100 text-emerald-700",
  Sakit: "bg-yellow-100 text-yellow-700",
  Izin: "bg-blue-100 text-blue-700",
  Alpa: "bg-red-100 text-red-700",
  "Dinas Luar": "bg-purple-100 text-purple-700",
  Cuti: "bg-slate-100 text-slate-700",
};

export default function TeacherAttendancePage() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  // 🔥 REST API QUERIES
  const { data: teachersData, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ['teachers', 'all'],
    queryFn: () => teacherApi.list({ per_page: 100 })
  });
  
  const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['attendance', 'teacher', selectedDate],
    queryFn: () => attendanceApi.teacherIndex({ tanggal: selectedDate })
  });

  const recordMutation = useMutation({
    queryFn: (data: any) => attendanceApi.teacherStore(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'teacher', selectedDate] });
      toast.success("Status absensi diperbarui");
    }
  });

  const teachers = teachersData?.data || [];
  const attendance = attendanceData || [];

  const getAttendance = (teacherId: number) => {
    return attendance.find((a: any) => a.teacher_id === teacherId);
  };

  const handleStatusChange = async (teacherId: number, status: string) => {
    const jamMasuk = status === "Hadir" ? new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }) : undefined;
    recordMutation.mutate({
      teacher_id: teacherId,
      tanggal: selectedDate,
      status,
      jam_masuk: jamMasuk
    });
  };

  const navigateDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  const summary = {
    hadir: attendance.filter((a: any) => a.status === "Hadir").length,
    sakit: attendance.filter((a: any) => a.status === "Sakit").length,
    izin: attendance.filter((a: any) => a.status === "Izin").length,
    alpa: Math.max(0, teachers.length - attendance.length),
  };

  const isLoading = isLoadingTeachers || isLoadingAttendance;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Absensi Guru</h1>
        <p className="text-slate-500 text-sm mt-1">Input dan rekap kehadiran guru harian</p>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-44" />
        <Button variant="outline" size="icon" onClick={() => navigateDate(1)}><ChevronRight className="h-4 w-4" /></Button>
        <span className="text-sm text-slate-500 font-medium">
          {new Date(selectedDate).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Hadir", val: summary.hadir, color: "emerald" },
          { label: "Sakit", val: summary.sakit, color: "yellow" },
          { label: "Izin", val: summary.izin, color: "blue" },
          { label: "Belum Absen", val: summary.alpa, color: "red" },
        ].map((s) => (
          <Card key={s.label} className={`border-${s.color}-200`}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className={`text-2xl font-bold text-${s.color}-600`}>{s.val}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-12 text-center">No</TableHead>
                <TableHead>Nama Guru</TableHead>
                <TableHead className="text-center">Status Kehadiran</TableHead>
                <TableHead className="text-center">Jam Masuk</TableHead>
                <TableHead className="text-center">Jam Pulang</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-emerald-500" /></TableCell></TableRow>
              ) : teachers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-400">Tidak ada data guru.</TableCell></TableRow>
              ) : (
                teachers.map((teacher: any, i: number) => {
                  const att = getAttendance(teacher.id);
                  return (
                    <TableRow key={teacher.id}>
                      <TableCell className="text-center text-slate-400 text-xs">{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-800">{teacher.nama}</div>
                        <div className="text-[10px] text-slate-500 font-mono uppercase">{teacher.nuptk || "No NUPTK"}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Select value={att?.status || ""} onValueChange={(v) => handleStatusChange(teacher.id, v)}>
                          <SelectTrigger className="h-8 w-32 mx-auto rounded-lg">
                            <SelectValue placeholder="Pilih Status" />
                          </SelectTrigger>
                          <SelectContent>
                            {["Hadir", "Sakit", "Izin", "Alpa", "Dinas Luar", "Cuti"].map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        {att?.jam_masuk ? <Badge className={`${statusColors["Hadir"]} rounded-md border-0`}><Clock className="h-3 w-3 mr-1" />{att.jam_masuk}</Badge> : <span className="text-slate-300">-</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {att?.jam_pulang ? <Badge className={`${statusColors["Hadir"]} rounded-md border-0`}><Clock className="h-3 w-3 mr-1" />{att.jam_pulang}</Badge> : <span className="text-slate-300">-</span>}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
