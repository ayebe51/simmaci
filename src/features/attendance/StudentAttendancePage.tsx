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
import { GraduationCap, CheckCircle2, Save, ChevronLeft, ChevronRight } from "lucide-react";


const statusOptions = ["Hadir", "Sakit", "Izin", "Alpa"];
const statusColors: Record<string, string> = {
  Hadir: "bg-emerald-100 text-emerald-700",
  Sakit: "bg-yellow-100 text-yellow-700",
  Izin: "bg-blue-100 text-blue-700",
  Alpa: "bg-red-100 text-red-700",
};

export default function StudentAttendancePage() {
  const userStr = localStorage.getItem('user');
const user = userStr ? JSON.parse(userStr) : null;
  const schoolId = user?.schoolId as Id<"schools"> | undefined;

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [studentStatuses, setStudentStatuses] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const classes = useQuery(api.classes.listActive, schoolId ? { schoolId } : "skip");
  const subjects = useQuery(api.subjects.listActive, schoolId ? { schoolId } : "skip");

  const classIdTyped = selectedClassId ? selectedClassId as Id<"classes"> : undefined;
  const subjectIdTyped = selectedSubjectId ? selectedSubjectId as Id<"subjects"> : undefined;

  const existingRecords = useQuery(
    api.studentAttendance.listByClassSubjectDate,
    classIdTyped && subjectIdTyped ? { classId: classIdTyped, subjectId: subjectIdTyped, tanggal: selectedDate } : "skip"
  );

  // We need to get students by school — use search or list
  // For now, use a simple list filtered by kelas from the class name
  const selectedClass = classes?.find((c: any) => c._id === selectedClassId);

  const recordBulk = useMutation(api.studentAttendance.recordBulk);

  // Initialize statuses from existing records
  const initializeStatuses = () => {
    if (existingRecords && existingRecords.length > 0) {
      const statuses: Record<string, string> = {};
      existingRecords.forEach((r: any) => {
        statuses[r.studentId] = r.status;
      });
      return statuses;
    }
    return {};
  };

  const handleStatusChange = (studentId: string, status: string) => {
    setStudentStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSaveBulk = async () => {
    if (!schoolId || !classIdTyped || !subjectIdTyped) return;
    setSaving(true);
    try {
      const records = Object.entries(studentStatuses).map(([studentId, status]) => ({
        studentId,
        status,
      }));

      if (records.length === 0) {
        toast.warning("Belum ada yang diisi");
        setSaving(false);
        return;
      }

      await recordBulk({
        schoolId,
        classId: classIdTyped,
        subjectId: subjectIdTyped,
        tanggal: selectedDate,
        records,
      });
      toast.success(`Absensi ${records.length} siswa berhasil disimpan!`);
    } catch { toast.error("Gagal menyimpan"); }
    setSaving(false);
  };

  const navigateDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  const summary = Object.values(studentStatuses);
  const hadir = summary.filter((s) => s === "Hadir").length;
  const sakit = summary.filter((s) => s === "Sakit").length;
  const izin = summary.filter((s) => s === "Izin").length;
  const alpa = summary.filter((s) => s === "Alpa").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Absensi Siswa</h1>
        <p className="text-slate-500 text-sm mt-1">Input absensi per kelas per mata pelajaran</p>
      </div>

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Tanggal</label>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-9" onClick={() => navigateDate(-1)}><ChevronLeft className="h-3 w-3" /></Button>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-9" />
            <Button variant="outline" size="icon" className="h-9" onClick={() => navigateDate(1)}><ChevronRight className="h-3 w-3" /></Button>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Kelas</label>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
            <SelectContent>
              {classes?.map((c: any) => (
                <SelectItem key={c._id} value={c._id}>{c.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Mata Pelajaran</label>
          <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Pilih mapel..." /></SelectTrigger>
            <SelectContent>
              {subjects?.map((s: any) => (
                <SelectItem key={s._id} value={s._id}>{s.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={handleSaveBulk} className="w-full h-9 bg-emerald-600 hover:bg-emerald-700" disabled={saving || !selectedClassId || !selectedSubjectId}>
            <Save className="h-4 w-4 mr-1" /> Simpan Absensi
          </Button>
        </div>
      </div>

      {/* Summary Strip */}
      {Object.keys(studentStatuses).length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <Badge className="bg-emerald-100 text-emerald-700">Hadir: {hadir}</Badge>
          <Badge className="bg-yellow-100 text-yellow-700">Sakit: {sakit}</Badge>
          <Badge className="bg-blue-100 text-blue-700">Izin: {izin}</Badge>
          <Badge className="bg-red-100 text-red-700">Alpa: {alpa}</Badge>
        </div>
      )}

      {/* Student Checklist */}
      {selectedClassId && selectedSubjectId ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Daftar Siswa — {selectedClass?.nama || ""}
            </CardTitle>
            <p className="text-xs text-slate-400">
              Klik status untuk setiap siswa, lalu simpan. Atau gunakan QR Scanner untuk scan massal.
            </p>
          </CardHeader>
          <CardContent>
            {existingRecords !== undefined ? (
              <div className="space-y-2">
                {existingRecords.map((r: any, i: number) => (
                  <div key={r._id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-6">{i + 1}</span>
                      <span className="font-medium text-sm">{r.studentId}</span>
                    </div>
                    <Badge className={statusColors[r.status] || ""}>{r.status}</Badge>
                  </div>
                ))}
                {existingRecords.length === 0 && (
                  <p className="text-center text-slate-400 py-6 text-sm">
                    Belum ada data absensi untuk sesi ini. Gunakan QR Scanner atau input manual di bawah.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-slate-400 py-6">Memuat data...</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Pilih kelas dan mata pelajaran untuk mulai input absensi</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
