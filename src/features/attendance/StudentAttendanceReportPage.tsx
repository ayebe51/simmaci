import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, Printer, Users, CalendarDays, Loader2, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { Input } from "@/components/ui/input";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { attendanceApi } from "@/lib/api";

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
  const { search } = useLocation();
  const queryParams = new URLSearchParams(search);
  const classIdParam = queryParams.get("classId");

  const [bulan, setBulan] = useState(new Date().toISOString().split("-").slice(0, 2).join("-"));
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  useEffect(() => {
    if (classIdParam) setSelectedClassId(classIdParam);
  }, [classIdParam]);

  // 🔥 REST API QUERIES
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: attendanceApi.classList });
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: attendanceApi.subjectList });

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['attendance', 'report', selectedClassId, selectedSubjectId, bulan],
    queryFn: () => attendanceApi.studentReport({ 
        class_id: selectedClassId, 
        subject_id: selectedSubjectId, 
        bulan 
    }),
    enabled: !!selectedClassId && !!selectedSubjectId && !!bulan
  });

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

    const dayHeaders = daysInMonth.map(d => String(d.day));
    const allHeaders = ["No", "NISN", "Nama", ...dayHeaders, "H", "S", "I", "A"];

    const data = reportData.students.map((student: any, idx: number) => {
      const row: any = {
        No: idx + 1,
        NISN: student.nisn,
        Nama: student.nama,
      };
      let hCount = 0, sCount = 0, iCount = 0, aCount = 0;
      daysInMonth.forEach(d => {
        const stat = reportData.matrix[student.id]?.[d.fullDate];
        row[String(d.day)] = stat ? statusShort[stat] || "-" : "-";
        
        if (stat === "Hadir") hCount++;
        else if (stat === "Sakit") sCount++;
        else if (stat === "Izin") iCount++;
        else if (stat === "Alpa") aCount++;
      });
      row["H"] = hCount;
      row["S"] = sCount;
      row["I"] = iCount;
      row["A"] = aCount;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data, { header: allHeaders });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi");
    XLSX.writeFile(wb, `Rekap_Absensi_${reportData.class_name}_${bulan}.xlsx`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Laporan Absensi Siswa</h1>
          <p className="text-slate-500 text-sm mt-1">Rekapitulasi kehadiran bulanan per mata pelajaran</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-lg shadow-sm" onClick={handleExportExcel} disabled={!reportData}>
            <Download className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md" onClick={handlePrint} disabled={!reportData}>
            <Printer className="mr-2 h-4 w-4" /> Cetak PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="print:hidden border-0 shadow-sm rounded-xl">
        <CardHeader className="pb-3 border-b bg-slate-50/50">
            <CardTitle className="text-xs font-bold flex items-center gap-2 text-slate-500 uppercase tracking-widest">
                <Search className="w-4 h-4" /> Filter Pencarian
            </CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid gap-4 md:grid-cols-4 items-end">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Periode Bulan</label>
            <Input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} className="rounded-lg h-10" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Kelas</label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
              <SelectContent>
                {classes.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Mata Pelajaran</label>
            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
              <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="Pilih Mapel" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[10px] text-slate-400 italic font-medium leading-tight">
             Laporan akan otomatis dimuat setelah filter lengkap.
          </p>
        </CardContent>
      </Card>

      {/* Matrix Table */}
      <Card className="border-0 shadow-sm rounded-xl overflow-hidden relative min-h-[400px]">
        <CardContent className="p-0">
          {!selectedClassId || !selectedSubjectId ? (
            <div className="py-24 text-center text-slate-400 flex flex-col items-center">
              <CalendarDays className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="text-sm font-bold tracking-tight">Tentukan Filter Terlebih Dahulu</p>
              <p className="text-[10px] uppercase font-bold tracking-widest mt-1 opacity-50">Data rekapitulasi akan muncul di sini</p>
            </div>
          ) : isLoading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-500 mb-4" />
              <p className="text-sm font-bold text-slate-500">Mengkalkulasi Laporan...</p>
            </div>
          ) : (
            <div className="overflow-x-auto relative">
              <Table className="border-collapse">
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b-2">
                    <TableHead className="w-10 border-x text-center font-black sticky left-0 bg-slate-50 z-20 text-[10px]">NO</TableHead>
                    <TableHead className="w-[180px] border-x font-black sticky left-10 bg-slate-50 z-20 text-[10px]">NAMA SISWA</TableHead>
                    {daysInMonth.map(d => (
                      <TableHead key={d.day} className="border-x text-center p-0.5 min-w-[28px] font-black text-[9px] leading-tight">
                        <div className="flex flex-col">
                          <span className="text-slate-400">{d.dayName}</span>
                          <span className="text-slate-800 border-t mt-0.5 pt-0.5">{d.day}</span>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="border-x text-center font-black bg-emerald-50 text-[10px] text-emerald-700">H</TableHead>
                    <TableHead className="border-x text-center font-black bg-yellow-50 text-[10px] text-yellow-700">S</TableHead>
                    <TableHead className="border-x text-center font-black bg-blue-50 text-[10px] text-blue-700">I</TableHead>
                    <TableHead className="border-x text-center font-black bg-red-50 text-[10px] text-red-700">A</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.students.map((student: any, idx: number) => {
                    let hCount = 0, sCount = 0, iCount = 0, aCount = 0;
                    return (
                      <TableRow key={student.id} className="hover:bg-slate-50 transition-colors border-b">
                        <TableCell className="text-center border-x p-2 font-mono text-xs text-slate-400 sticky left-0 bg-white z-10">{idx + 1}</TableCell>
                        <TableCell className="border-x p-2 font-bold text-xs sticky left-10 bg-white z-10 truncate max-w-[180px] text-slate-700">
                            {student.nama}
                        </TableCell>
                        {daysInMonth.map(d => {
                          const status = reportData.matrix[student.id]?.[d.fullDate];
                          if (status === "Hadir") hCount++;
                          else if (status === "Sakit") sCount++;
                          else if (status === "Izin") iCount++;
                          else if (status === "Alpa") aCount++;

                          return (
                            <TableCell key={d.day} className={`text-center p-0.5 border-x text-[10px] h-10 ${status ? "" : "bg-slate-50/20"}`}>
                              <span className={status ? statusColors[status] : "text-slate-200"}>
                                {status ? statusShort[status] : "—"}
                              </span>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center border-x font-black bg-emerald-50/50 text-emerald-700 text-xs">{hCount || "-"}</TableCell>
                        <TableCell className="text-center border-x font-black bg-yellow-50/50 text-yellow-700 text-xs">{sCount || "-"}</TableCell>
                        <TableCell className="text-center border-x font-black bg-blue-50/50 text-blue-700 text-xs">{iCount || "-"}</TableCell>
                        <TableCell className="text-center border-x font-black bg-red-50/50 text-red-700 text-xs">{aCount || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="flex justify-center items-center gap-6 print:hidden">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span><span className="text-[10px] font-bold text-slate-500">H: HADIR</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500"></span><span className="text-[10px] font-bold text-slate-500">S: SAKIT</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span><span className="text-[10px] font-bold text-slate-500">I: IZIN</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span><span className="text-[10px] font-bold text-slate-500">A: ALPA</span></div>
      </div>
    </div>
  );
}
