import { useState, useRef, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, CreditCard, Printer, School, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StudentCard from "../master-data/components/StudentCard";
import { Id } from "../../../convex/_generated/dataModel";

export default function StudentCardPage() {
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [isBatchMode, setIsBatchMode] = useState(false);

  const token = localStorage.getItem("token") || "";
  
  // Data Fetching
  const schools = useQuery(api.schools.list, { token }) || [];
  const classesForSchool = useQuery(api.classes.list, { 
    schoolId: selectedSchoolId !== "all" ? (selectedSchoolId as Id<"schools">) : undefined 
  } as any) || [];

  const students = useQuery(api.students.list, { token }) || [];

  // Derived Filtering Logic
  const filteredStudents = useMemo(() => {
    let result = students;

    // Filter by School
    if (selectedSchoolId !== "all") {
      const school = schools.find(s => s._id === selectedSchoolId);
      if (school) {
        result = result.filter((s: any) => s.namaSekolah === school.nama);
      }
    }

    // Filter by Class
    if (selectedClass !== "all") {
      result = result.filter((s: any) => s.kelas === selectedClass);
    }

    // Filter by Search
    if (search) {
      const query = search.toLowerCase();
      result = result.filter((s: any) => 
        s.nama?.toLowerCase().includes(query) || 
        s.nisn?.includes(search) ||
        s.nik?.includes(search)
      );
    }

    return result;
  }, [students, schools, selectedSchoolId, selectedClass, search]);

  // Limit display students for the interactive list to keep it fast
  const displayStudents = useMemo(() => {
      if (isBatchMode) return filteredStudents;
      if (search || selectedClass !== "all" || selectedSchoolId !== "all") return filteredStudents;
      return filteredStudents.slice(0, 20);
  }, [filteredStudents, isBatchMode, search, selectedClass, selectedSchoolId]);

  const handlePrintAll = () => {
    window.print();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-blue-900">Kartu Pelajar Digital</h1>
          <p className="text-muted-foreground">Generator Kartu Identitas Siswa LP Ma'arif NU Cilacap</p>
        </div>
        <div className="flex gap-3">
            <div className="bg-white/50 backdrop-blur-md p-1 rounded-2xl border border-white/60 shadow-sm flex items-center">
              <button 
                onClick={() => setIsBatchMode(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!isBatchMode ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-white/50'}`}
              >
                Mode Tunggal
              </button>
              <button 
                onClick={() => setIsBatchMode(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isBatchMode ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-white/50'}`}
              >
                Mode Batch
              </button>
            </div>
            {isBatchMode && (
               <Button 
                onClick={handlePrintAll} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-6 shadow-lg shadow-emerald-200 transition-all active:scale-95"
                disabled={filteredStudents.length === 0}
               >
                  <Printer className="w-4 h-4 mr-2" />
                  Cetak Halaman ({filteredStudents.length})
               </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* FILTER & SEARCH PANEL */}
        <div className="space-y-6 md:col-span-1 print:hidden">
            {/* Filter Card */}
            <Card className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl rounded-3xl overflow-hidden relative">
                <CardHeader className="pb-4 border-b border-white/60 bg-white/40 px-6 pt-6">
                    <CardTitle className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">Filter Data</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                    {/* School Filter (only if multiple schools exist) */}
                    {schools.length > 1 && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 ml-1">
                                <School className="w-3 h-3" /> Madrasah
                            </label>
                            <Select value={selectedSchoolId} onValueChange={(val) => {
                                setSelectedSchoolId(val);
                                setSelectedClass("all");
                            }}>
                                <SelectTrigger className="bg-white/60 border-slate-200 rounded-xl shadow-sm focus:ring-blue-500">
                                    <SelectValue placeholder="Semua Madrasah" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-200 shadow-xl max-h-[300px]">
                                    <SelectItem value="all">Semua Madrasah</SelectItem>
                                    {schools.map((s) => (
                                        <SelectItem key={s._id} value={s._id}>{s.nama}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Class Filter */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 ml-1">
                            <Layers className="w-3 h-3" /> Kelas
                        </label>
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                            <SelectTrigger className="bg-white/60 border-slate-200 rounded-xl shadow-sm focus:ring-blue-500">
                                <SelectValue placeholder="Pilih Kelas" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200 shadow-xl max-h-[300px]">
                                <SelectItem value="all">Semua Kelas</SelectItem>
                                {selectedSchoolId !== "all" ? (
                                    classesForSchool.map((c: any) => (
                                        <SelectItem key={c._id} value={c.nama}>{c.nama}</SelectItem>
                                    ))
                                ) : (
                                    // Fallback to extraction from current students if no school selected
                                    Array.from(new Set(students.map((s: any) => s.kelas).filter(Boolean))).sort().map(cls => (
                                        <SelectItem key={String(cls)} value={String(cls)}>{String(cls)}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card className={`border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl rounded-3xl overflow-hidden relative z-10 ${isBatchMode ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[60%] bg-blue-400/10 blur-[100px] pointer-events-none rounded-full" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[60%] bg-indigo-400/10 blur-[100px] pointer-events-none rounded-full" />
                <CardHeader className="pb-4 border-b border-white/60 bg-white/40 px-6 pt-6">
                    <CardTitle className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">Data Siswa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                    <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-blue-600/60" />
                    <Input 
                        placeholder="Nama / NISN / NIK..." 
                        className="pl-10 bg-white/60 border-slate-200 focus-visible:ring-blue-500 shadow-sm rounded-xl transition-all" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    </div>
                    
                    <div className="border-0 rounded-2xl h-[400px] overflow-y-auto space-y-1 p-1 scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-transparent">
                        {displayStudents.length === 0 && (
                            <div className="p-8 text-center text-slate-400 text-xs italic bg-white/40 rounded-xl mt-4">
                                {search ? "Data tidak ditemukan" : "Tidak ada data untuk filter ini"}
                            </div>
                        )}
                        {displayStudents.map((s: any) => (
                            <div 
                                key={s._id} 
                                className={`p-4 rounded-xl transition-all cursor-pointer hover:bg-white/80 active:scale-[0.98] ${selectedStudent?._id === s._id ? 'bg-white shadow-[0_4px_15px_rgb(0,0,0,0.05)] border-l-4 border-l-blue-500' : 'border border-transparent opacity-80'}`}
                                onClick={() => setSelectedStudent(s)}
                            >
                                <div className="font-bold text-xs text-slate-800 line-clamp-1">{s.nama}</div>
                                <div className="flex flex-wrap gap-2 mt-1.5">
                                    <span className="text-[9px] font-bold text-blue-700 bg-blue-100/50 px-2 py-0.5 rounded-full backdrop-blur-sm">NISN: {s.nisn || "-"}</span>
                                    <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 truncate max-w-[200px] font-medium">{s.namaSekolah}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* PREVIEW PANEL */}
        <div className="md:col-span-3">
          {isBatchMode ? (
            <div className="bg-white p-6 rounded-3xl shadow-xl border space-y-8 min-h-[600px] print:p-0 print:border-none print:shadow-none print:block print:w-full print:space-y-0">
               <div className="flex items-center justify-between border-b pb-4 print:hidden">
                  <h3 className="font-bold text-lg text-slate-800">Pratinjau Batch Kartu Pelajar</h3>
                  <p className="text-xs text-slate-500 font-mono bg-slate-100 px-3 py-1 rounded-lg font-bold border border-slate-200">Total: {filteredStudents.length} Kartu</p>
               </div>
               
               {filteredStudents.length > 50 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 print:hidden shadow-sm">
                     <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                        <Layers className="w-4 h-4" />
                     </div>
                     <div>
                        <p className="text-xs font-bold text-blue-800">Tips Cetak Banyak ({filteredStudents.length} siswa)</p>
                        <p className="text-[10px] text-blue-700/80 mt-0.5 leading-relaxed">
                            Gunakan filter **Kelas** untuk mencetak per rombel agar loading lebih cepat dan pembagian kartu lebih teratur. 
                            Browser mungkin akan sedikit lambat saat memuat pratinjau jika jumlah kartu terlalu banyak.
                        </p>
                     </div>
                  </div>
               )}

               {filteredStudents.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                        <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                            <Layers className="w-10 h-10 text-slate-300" />
                        </div>
                        <p className="text-sm font-bold text-slate-600">Tidak ada kartu untuk ditampilkan</p>
                        <p className="text-xs text-slate-400 mt-1">Sesuaikan filter Madrasah atau Kelas untuk memuat data.</p>
                   </div>
               ) : (
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 justify-items-center print:block print:w-full print:m-0 print:p-0">
                        {filteredStudents.map((s: any) => (
                        <div key={s._id} className="print:block print:w-full print:m-0 print:p-0 print:page-break-after-always">
                            <StudentCard 
                                student={{
                                    nama: s.nama,
                                    nisn: s.nisn,
                                    nik: s.nik,
                                    namaSekolah: s.namaSekolah,
                                    photoId: s.photoId,
                                    kelas: s.kelas
                                }}
                                isBatch 
                            />
                        </div>
                        ))}
                   </div>
               )}
            </div>
          ) : (
            selectedStudent ? (
                <div className="bg-white p-8 rounded-3xl shadow-xl border print:p-0 print:border-none print:shadow-none min-h-[600px] flex items-center justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] pointer-events-none rounded-full" />
                    <StudentCard student={{
                      nama: selectedStudent.nama,
                      nisn: selectedStudent.nisn,
                      nik: selectedStudent.nik,
                      namaSekolah: selectedStudent.namaSekolah,
                      photoId: selectedStudent.photoId,
                      kelas: selectedStudent.kelas
                    }} />
                </div>
            ) : (
                <div className="h-full min-h-[600px] flex flex-col items-center justify-center border-2 border-dashed rounded-3xl bg-white/40 backdrop-blur-xl text-slate-400 shadow-sm transition-all hover:bg-white/60">
                    <div className="bg-white p-6 rounded-full shadow-[0_8px_30px_rgba(59,130,246,0.1)] mb-4 animate-pulse">
                        <CreditCard className="w-12 h-12 text-blue-500" />
                    </div>
                    <p className="font-bold text-slate-800 tracking-tight">Pilih siswa dari daftar</p>
                    <p className="text-xs mt-1 text-slate-500">Pratinjau Kartu Pelajar akan muncul di sini</p>
                </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
