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
  Alpha: "text-red-600 font-bold",
};

const statusShort: Record<string, string> = {
  Hadir: "H",
  Sakit: "S",
  Izin: "I",
  Alpa: "A",
  Alpha: "A", // Backend transition support
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

    // Build headers explicitly to ensure "No", "NISN", "Nama" are on the left
    const dayHeaders = daysInMonth.map(d => String(d.day));
    const allHeaders = ["No", "NISN", "Nama", ...dayHeaders, "H", "S", "I", "A"];

    const data = reportData.students.map((student, idx) => {
      const row: any = {
        No: idx + 1,
        NISN: student.nisn,
        Nama: student.nama,
      };
      let hCount = 0, sCount = 0, iCount = 0, aCount = 0;
      daysInMonth.forEach(d => {
        const stat = reportData.attendance[student.id]?.[d.fullDate];
        const statusStr = String(stat || "").toLowerCase();
        
        row[String(d.day)] = stat ? statusShort[stat] || statusShort[stat.charAt(0).toUpperCase() + stat.slice(1).toLowerCase()] : "-";
        
        if (statusStr === "hadir") hCount++;
        else if (statusStr === "sakit") sCount++;
        else if (statusStr === "izin") iCount++;
        else if (statusStr === "alpa" || statusStr === "alpha") aCount++;
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

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          
          /* Hide all global wrapper elements */
          aside, header, footer, .print\\:hidden, 
          div[class*="bg-emerald-400"], div[class*="bg-blue-400"], div[class*="bg-amber-400"] { 
            display: none !important; 
          }
          
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
            background: white !important;
            font-family: "Times New Roman", Times, serif;
            overflow: visible !important;
            height: auto !important;
          }
          
          /* Reset main content container */
          main, .flex-1, .h-screen { 
            display: block !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            overflow: visible !important;
            height: auto !important;
            max-width: none !important;
          }

          .shadow-xl, .shadow-sm, .shadow { box-shadow: none !important; border: none !important; }
          .border-slate-200 { border: none !important; }
          .p-0, .p-6 { padding: 0 !important; }
          
          table { 
            font-size: 9px !important; 
            width: 100% !important; 
            border-collapse: collapse !important; 
            border: 1.5px solid black !important;
            margin-top: 10px !important;
          }
          th, td { 
            padding: 4px 2px !important; 
            border: 1px solid black !important; 
            color: black !important;
          }
          th { background-color: #f1f5f9 !important; font-weight: bold !important; }
          
          .bg-slate-50 { background-color: transparent !important; }
          .bg-emerald-50 { background-color: #f0fdf4 !important; }
          .bg-yellow-50 { background-color: #fefce8 !important; }
          .bg-blue-50 { background-color: #eff6ff !important; }
          .bg-red-50 { background-color: #fef2f2 !important; }
          
          .sticky { position: static !important; }
          h1, h2, h3 { color: black !important; margin: 0 !important; }
          
          .kop-surat {
            border-bottom: 3px double black;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
        }
      `}} />

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
              <SelectTrigger title="Pilih Mapel"><SelectValue placeholder="Pilih Mapel" /></SelectTrigger>
              <SelectContent>
                {subjects?.map(subj => <SelectItem key={subj._id} value={subj._id}>{subj.nama}</SelectItem>)}
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
               {/* PRINT HEADER (Kop Surat) */}
               <div className="hidden print:block text-center kop-surat">
                 <h2 className="text-xl font-bold uppercase leading-tight">Lembaga Pendidikan Ma'arif NU Cilacap</h2>
                 <h3 className="text-lg font-bold uppercase leading-tight">{user?.unitKerja || "Unit Kerja"}</h3>
                 <p className="text-xs italic mt-1">Sistem Informasi Manajemen Madrasah Cilacap (SIMMACI)</p>
                 
                 <div className="flex justify-between items-end mt-6 text-left text-xs">
                    <div className="space-y-1">
                       <p><span className="font-bold">Mata Pelajaran:</span> {subjects?.find(s => s._id === selectedSubjectId)?.nama}</p>
                       <p><span className="font-bold">Kelas:</span> {reportData.className}</p>
                    </div>
                    <div className="text-right space-y-1">
                       <p className="text-sm font-bold underline capitalize">Rekapitulasi Absensi Siswa</p>
                       <p><span className="font-bold">Periode:</span> {new Date(bulan).toLocaleDateString('id-ID', {month:'long', year:'numeric'})}</p>
                    </div>
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
                  {reportData.students.map((student, idx) => {
                    let hCount = 0, sCount = 0, iCount = 0, aCount = 0;
                    return (
                      <TableRow key={student.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="text-center border sticky left-0 bg-white z-10">{idx + 1}</TableCell>
                        <TableCell className="border font-medium sticky left-[50px] bg-white z-10 truncate max-w-[250px]">
                            {student.nama}
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{student.nisn}</p>
                        </TableCell>
                        {daysInMonth.map(d => {
                          const status = reportData.attendance[student.id]?.[d.fullDate];
                          const statusStr = String(status || "").toLowerCase();
                          
                          if (statusStr === "hadir") hCount++;
                          else if (statusStr === "sakit") sCount++;
                          else if (statusStr === "izin") iCount++;
                          else if (statusStr === "alpa" || statusStr === "alpha") aCount++;

                          return (
                            <TableCell key={d.day} className={`text-center p-0 border text-[11px] h-10 ${status ? "" : "bg-slate-50/30"}`}>
                              <span className={status ? statusColors[status] || statusColors[status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()] : ""}>
                                {status ? statusShort[status] || statusShort[status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()] : "-"}
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

               {/* LEGEND & SIGNATURE (Print only) */}
               <div className="hidden print:block mt-8 text-xs">
                  <div className="flex justify-between">
                      <div className="space-y-1 border p-2 rounded max-w-xs">
                          <p className="font-bold border-b pb-1 mb-1">Keterangan:</p>
                          <div className="grid grid-cols-2 gap-x-4">
                              <p>H: Hadir</p>
                              <p>S: Sakit</p>
                              <p>I: Izin</p>
                              <p>A: Alpa</p>
                          </div>
                      </div>
                      
                      <div className="flex gap-20">
                          <div className="text-center w-40">
                              <p>Mengetahui,</p>
                              <p className="mb-16">Kepala Madrasah</p>
                              <p className="font-bold underline">( ............................ )</p>
                          </div>
                          <div className="text-center w-40">
                              <p>Cilacap, {new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</p>
                              <p className="mb-16">Guru Mata Pelajaran</p>
                              <p className="font-bold underline">( {user?.nama || "............................"} )</p>
                          </div>
                      </div>
                  </div>
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
