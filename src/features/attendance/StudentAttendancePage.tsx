import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { GraduationCap, Save, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceApi, studentApi } from "@/lib/api";

const statusColors: Record<string, string> = {
  Hadir: "bg-emerald-100 text-emerald-700",
  Sakit: "bg-yellow-100 text-yellow-700",
  Izin: "bg-blue-100 text-blue-700",
  Alpa: "bg-red-100 text-red-700",
};

export default function StudentAttendancePage() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [studentStatuses, setStudentStatuses] = useState<Record<number, string>>({});

  // 🔥 REST API QUERIES
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: attendanceApi.classList });
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: attendanceApi.subjectList });

  const selectedClassName = classes.find((c: any) => c.id === Number(selectedClassId))?.nama;

  const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students', 'class', selectedClassName],
    queryFn: () => studentApi.list({ kelas: selectedClassName, per_page: 100 }),
    enabled: !!selectedClassName
  });

  const { data: existingRecords = [], isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['attendance', 'students', selectedClassId, selectedSubjectId, selectedDate],
    queryFn: () => attendanceApi.studentLogIndex({ 
        class_id: selectedClassId, 
        subject_id: selectedSubjectId, 
        tanggal: selectedDate 
    }),
    enabled: !!selectedClassId && !!selectedSubjectId && !!selectedDate
  });

  const recordBulkMutation = useMutation({
    queryFn: (data: any) => attendanceApi.studentLogStore(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'students'] });
      toast.success("Absensi siswa berhasil disimpan!");
    }
  });

  useEffect(() => {
    if (existingRecords.length > 0) {
      const statuses: Record<number, string> = {};
      existingRecords.forEach((r: any) => {
        statuses[r.student_id] = r.status;
      });
      setStudentStatuses(statuses);
    } else {
      setStudentStatuses({});
    }
  }, [existingRecords]);

  const handleStatusChange = (studentId: number, status: string) => {
    setStudentStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSaveBulk = async () => {
    if (!selectedClassId || !selectedSubjectId) return;
    
    const records = Object.entries(studentStatuses).map(([studentId, status]) => ({
      student_id: Number(studentId),
      status,
    }));

    if (records.length === 0) {
      toast.warning("Belum ada data yang diisi");
      return;
    }

    recordBulkMutation.mutate({
      class_id: Number(selectedClassId),
      subject_id: Number(selectedSubjectId),
      tanggal: selectedDate,
      records,
    });
  };

  const navigateDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  const students = studentsData?.data || [];
  const isLoading = isLoadingStudents || isLoadingAttendance;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Absensi Siswa</h1>
        <p className="text-slate-500 text-sm mt-1">Input absensi per kelas per mata pelajaran</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4 items-end">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">Tanggal</label>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            <Button variant="outline" size="icon" onClick={() => navigateDate(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">Kelas</label>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
            <SelectContent>
              {classes.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.nama}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">Mata Pelajaran</label>
          <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
            <SelectTrigger><SelectValue placeholder="Pilih mapel..." /></SelectTrigger>
            <SelectContent>
              {subjects.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.nama}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSaveBulk} className="bg-emerald-600 h-10" disabled={!selectedClassId || !selectedSubjectId || recordBulkMutation.isPending}>
          {recordBulkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Simpan Absensi
        </Button>
      </div>

      {selectedClassId && selectedSubjectId ? (
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b py-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-600" />
              Siswa Kelas {selectedClassName || ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">No</TableHead>
                  <TableHead>Nama Siswa</TableHead>
                  <TableHead className="text-center">Status Absensi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={3} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-emerald-500" /></TableCell></TableRow>
                ) : students.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="h-32 text-center text-slate-400">Tidak ada siswa di kelas ini.</TableCell></TableRow>
                ) : (
                  students.map((student: any, i: number) => (
                    <TableRow key={student.id}>
                      <TableCell className="text-center text-xs text-slate-400">{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-800">{student.nama}</div>
                        <div className="text-[10px] text-slate-500 font-mono uppercase">{student.nisn || "No NISN"}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {["Hadir", "Sakit", "Izin", "Alpa"].map((s) => (
                            <Button 
                              key={s} 
                              size="sm" 
                              variant={studentStatuses[student.id] === s ? "default" : "outline"}
                              className={`h-8 px-4 text-xs ${studentStatuses[student.id] === s ? statusColors[s] : "text-slate-500"}`}
                              onClick={() => handleStatusChange(student.id, s)}
                            >
                              {s}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center">
           <GraduationCap className="h-12 w-12 opacity-20 mb-3" />
           <p className="text-sm">Pilih filter untuk memuat daftar siswa</p>
        </div>
      )}
    </div>
  );
}
