import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, Printer, Users, CalendarDays, Loader2, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { Input } from "@/components/ui/input";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const statusColors: Record<string, string> = {
  Hadir: "text-emerald-600 font-bold",
  Sakit: "text-yellow-600 font-bold",
  Izin: "text-blue-600 font-bold",
  Alpa: "text-red-600 font-bold",
};

const statusShort: Record<string, string> = {
  Hadir: "H",
  Sakit: "S",
  Izin: "I",
  Alpa: "A",
};

export default function StudentAttendanceReportPage() {
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const schoolId = user?.schoolId as Id<"schools"> | undefined;

  const { search } = useLocation();
  const queryParams = new URLSearchParams(search);
  const classParam = queryParams.get("className");

  const [bulan, setBulan] = useState(new Date().toISOString().split("-").slice(0, 2).join("-"));
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  const classes = useQuery(api.classes.listActive, schoolId ? { schoolId } : "skip");
  const subjects = useQuery(api.subjects.listActive, schoolId ? { schoolId } : "skip");

  // Auto-select class from query param
  useEffect(() => {
    if (classParam && classes) {
      const found = classes.find(c => c.nama === classParam);
      if (found) setSelectedClassId(found._id);
    }
  }, [classParam, classes]);

  const classIdTyped = selectedClassId ? selectedClassId as Id<"classes"> : undefined;
  const subjectIdTyped = selectedSubjectId ? selectedSubjectId as Id<"subjects"> : undefined;

  const reportData = useQuery(
    api.studentAttendance.getMonthlyClassReport,
    classIdTyped && subjectIdTyped ? { classId: classIdTyped, subjectId: subjectIdTyped, bulan } : "skip"
  );

  const daysInMonth = useMemo(() => {
    const [year, month] = bulan.split("-").map(Number);
    const date = new Date(year, month, 0);
    const days = date.getDate();
    return Array.from({ length: days }, (_, i) => {
      const day = i + 1;
      const dayStr = String(day).padStart(2, "0");
      const fullDate = `${bulan}-${dayStr}`;
      const dayName = new Date(year, month - 1, day).toLocaleDateString("id-ID", { weekday: "short" });
      return { day, fullDate, dayName };
    });
  }, [bulan]);

  const handleExportExcel = () => {
    if (!reportData) return;

    const data = reportData.students.map((s, idx) => {
      const row: any = {
        No: idx + 1,
        NISN: s.nisn,
        Nama: s.nama,
      };
      daysInMonth.forEach(d => {
        row[d.day] = reportData.attendance[s.id]?.[d.fullDate] ? statusShort[reportData.attendance[s.id][d.fullDate]] : "-";
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi");
    
    XLSX.writeFile(wb, `Rekap_Absensi_${reportData.className}_${bulan}.xlsx`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Laporan Absensi Siswa</h1>
          <p className="text-muted-foreground">Rekapitulasi kehadiran bulanan per mata pelajaran.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel} disabled={!reportData}>
            <Download className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handlePrint} disabled={!reportData}>
            <Printer className="mr-2 h-4 w-4" /> Cetak PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="print:hidden border-slate-200 shadow-sm">
        <CardHeader className="pb-3 text-slate-800">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-500" /> Filter Laporan
            </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Bulan</label>
            <Input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Kelas</label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
              <SelectContent>
                {classes?.map(c => <SelectItem key={c._id} value={c._id}>{c.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Mata Pelajaran</label>
            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
              <SelectTrigger><SelectValue placeholder="Pilih Mapel" /></SelectTrigger>
              <SelectContent>
                {subjects?.map(s => <SelectItem key={s._id} value={s._id}>{s.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <p className="text-[10px] text-slate-400 italic">Pilih filter untuk memuat data laporan.</p>
          </div>
        </CardContent>
      </Card>

      {/* Matrix Table */}
      <Card className="border-slate-200 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          {!selectedClassId || !selectedSubjectId ? (
            <div className="py-20 text-center text-slate-400">
              <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">Silakan pilih Filter terlebih dahulu.</p>
            </div>
          ) : reportData === undefined ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-2" />
              <p className="text-sm text-slate-500">Memproses data laporan...</p>
            </div>
          ) : (reportData as any)?.error ? (
            <div className="py-20 text-center text-red-500">
              <p className="font-bold">Error!</p>
              <p className="text-sm">{(reportData as any).error}</p>
            </div>
          ) : (
            <div className="overflow-x-auto relative min-h-[400px]">
              {/* PRINT HEADER */}
              <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4 pt-4">
                <h2 className="text-2xl font-bold uppercase">Rekapitulasi Absensi Siswa</h2>
                <p className="text-sm">Lembaga Pendidikan Ma'arif NU Cilacap</p>
                <div className="grid grid-cols-2 text-left mt-6 max-w-md mx-auto text-sm">
                   <p><span className="font-bold">Unit Kerja:</span> {user?.unitKerja}</p>
                   <p><span className="font-bold">Kelas:</span> {reportData.className}</p>
                   <p><span className="font-bold">Bulan:</span> {new Date(bulan).toLocaleDateString('id-ID', {month:'long', year:'numeric'})}</p>
                </div>
              </div>

              <Table className="border-collapse">
                <TableHeader>
                  <TableRow className="bg-slate-50 print:bg-slate-100">
                    <TableHead className="w-[50px] border text-center font-bold sticky left-0 bg-slate-50 z-20">No</TableHead>
                    <TableHead className="w-[250px] border font-bold sticky left-[50px] bg-slate-50 z-20">Nama Siswa</TableHead>
                    {daysInMonth.map(d => (
                      <TableHead key={d.day} className="border text-center p-1 min-w-[32px] font-bold text-[10px]">
                        <div className="flex flex-col">
                          <span>{d.dayName}</span>
                          <span className="text-slate-900 border-t mt-0.5">{d.day}</span>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="w-[60px] border text-center font-bold bg-emerald-50">H</TableHead>
                    <TableHead className="w-[60px] border text-center font-bold bg-yellow-50">S</TableHead>
                    <TableHead className="w-[60px] border text-center font-bold bg-blue-50">I</TableHead>
                    <TableHead className="w-[60px] border text-center font-bold bg-red-50">A</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.students.map((s, idx) => {
                    let hCount = 0, sCount = 0, iCount = 0, aCount = 0;
                    return (
                      <TableRow key={s.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="text-center border sticky left-0 bg-white z-10">{idx + 1}</TableCell>
                        <TableCell className="border font-medium sticky left-[50px] bg-white z-10 truncate max-w-[250px]">
                            {s.nama}
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{s.nisn}</p>
                        </TableCell>
                        {daysInMonth.map(d => {
                          const status = reportData.attendance[s.id]?.[d.fullDate];
                          if (status === "Hadir") hCount++;
                          else if (status === "Sakit") sCount++;
                          else if (status === "Izin") iCount++;
                          else if (status === "Alpa") aCount++;

                          return (
                            <TableCell key={d.day} className={`text-center p-0 border text-[11px] h-10 ${status ? "" : "bg-slate-50/30"}`}>
                              <span className={status ? statusColors[status] : ""}>
                                {status ? statusShort[status] : "-"}
                              </span>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center border font-black bg-emerald-50/30 text-emerald-700">{hCount || "-"}</TableCell>
                        <TableCell className="text-center border font-black bg-yellow-50/30 text-yellow-700">{sCount || "-"}</TableCell>
                        <TableCell className="text-center border font-black bg-blue-50/30 text-blue-700">{iCount || "-"}</TableCell>
                        <TableCell className="text-center border font-black bg-red-50/30 text-red-700">{aCount || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* LEGEND (Print only) */}
              <div className="hidden print:flex flex-wrap gap-4 mt-8 text-xs border-t pt-4 px-4">
                  <p><strong>Keterangan:</strong></p>
                  <p>H: Hadir</p>
                  <p>S: Sakit</p>
                  <p>I: Izin</p>
                  <p>A: Alpa (Tanpa Keterangan)</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <p className="text-[10px] text-slate-400 italic text-center print:hidden uppercase tracking-widest font-bold">
        SIMMACI DIGITAL REKAPITULASI • PERSENSI OTOMATIS
      </p>
    </div>
  );
}
