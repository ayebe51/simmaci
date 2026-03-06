import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { UserCheck, Calendar, Clock, Download, ChevronLeft, ChevronRight } from "lucide-react";


const statusColors: Record<string, string> = {
  Hadir: "bg-emerald-100 text-emerald-700",
  Sakit: "bg-yellow-100 text-yellow-700",
  Izin: "bg-blue-100 text-blue-700",
  Alpa: "bg-red-100 text-red-700",
  "Dinas Luar": "bg-purple-100 text-purple-700",
  Cuti: "bg-slate-100 text-slate-700",
};

export default function TeacherAttendancePage() {
  const userStr = localStorage.getItem('user');
const user = userStr ? JSON.parse(userStr) : null;
  const schoolId = user?.schoolId as Id<"schools"> | undefined;

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const teachers = useQuery(api.teachers.getBySchool, schoolId ? { schoolId } : "skip");
  const attendance = useQuery(api.teacherAttendance.listByDate, schoolId ? { schoolId, tanggal: selectedDate } : "skip");
  const recordManual = useMutation(api.teacherAttendance.recordManual);

  const getAttendance = (teacherId: string) => {
    return attendance?.find((a: any) => a.teacherId === teacherId);
  };

  const handleStatusChange = async (teacherId: string, status: string) => {
    if (!schoolId) return;
    try {
      const jamMasuk = status === "Hadir" ? new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }) : undefined;
      await recordManual({ teacherId: teacherId as Id<"teachers">, schoolId, tanggal: selectedDate, status, jamMasuk });
      toast.success("Status absensi diperbarui");
    } catch { toast.error("Gagal memperbarui"); }
  };

  const navigateDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  const summary = {
    hadir: attendance?.filter((a: any) => a.status === "Hadir").length || 0,
    sakit: attendance?.filter((a: any) => a.status === "Sakit").length || 0,
    izin: attendance?.filter((a: any) => a.status === "Izin").length || 0,
    alpa: (teachers?.length || 0) - (attendance?.length || 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Absensi Guru</h1>
          <p className="text-slate-500 text-sm mt-1">Input dan rekap kehadiran guru harian</p>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-44" />
        <Button variant="outline" size="icon" onClick={() => navigateDate(1)}><ChevronRight className="h-4 w-4" /></Button>
        <span className="text-sm text-slate-500">
          {new Date(selectedDate).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-emerald-200">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{summary.hadir}</p>
            <p className="text-xs text-slate-500">Hadir</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{summary.sakit}</p>
            <p className="text-xs text-slate-500">Sakit</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{summary.izin}</p>
            <p className="text-xs text-slate-500">Izin</p>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-red-600">{summary.alpa}</p>
            <p className="text-xs text-slate-500">Belum Absen</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Table */}
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">No</TableHead>
                <TableHead>Nama Guru</TableHead>
                <TableHead>NUPTK</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Jam Masuk</TableHead>
                <TableHead className="text-center">Jam Pulang</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers?.map((teacher: any, i: number) => {
                const att = getAttendance(teacher._id);
                return (
                  <TableRow key={teacher._id}>
                    <TableCell className="text-slate-400">{i + 1}</TableCell>
                    <TableCell className="font-medium">{teacher.nama}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{teacher.nuptk}</TableCell>
                    <TableCell className="text-center">
                      <Select value={att?.status || ""} onValueChange={(v) => handleStatusChange(teacher._id, v)}>
                        <SelectTrigger className="h-8 w-28 mx-auto">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Hadir", "Sakit", "Izin", "Alpa", "Dinas Luar", "Cuti"].map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      {att?.jamMasuk ? <Badge className={statusColors["Hadir"]}><Clock className="h-3 w-3 mr-1" />{att.jamMasuk}</Badge> : <span className="text-slate-300">-</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {att?.jamPulang ? <Badge className={statusColors["Hadir"]}><Clock className="h-3 w-3 mr-1" />{att.jamPulang}</Badge> : <span className="text-slate-300">-</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {(!teachers || teachers.length === 0) && (
            <p className="text-center text-slate-400 py-8">Tidak ada data guru untuk sekolah ini.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
