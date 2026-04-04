import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, CreditCard, Printer, School, Layers, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StudentCard from "../master-data/components/StudentCard";
import { useQuery } from "@tanstack/react-query";
import { studentApi, schoolApi, attendanceApi } from "@/lib/api";

export default function StudentCardPage() {
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("all");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [isBatchMode, setIsBatchMode] = useState(false);

  // 🔥 REST API QUERIES
  const { data: schools = [] } = useQuery({ queryKey: ['schools'], queryFn: schoolApi.list });
  
  const { data: classes = [] } = useQuery({ 
      queryKey: ['classes', selectedSchoolId], 
      queryFn: attendanceApi.classList,
      enabled: selectedSchoolId !== "all"
  });

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students', 'card', selectedSchoolId, selectedClassId],
    queryFn: () => {
        const params: any = { per_page: 200 };
        if (selectedSchoolId !== "all") params.school_id = selectedSchoolId;
        if (selectedClassId !== "all") {
            const className = classes.find((c: any) => c.id.toString() === selectedClassId)?.nama;
            if (className) params.kelas = className;
        }
        return studentApi.list(params);
    }
  });

  const students = studentsData?.data || [];

  const filteredStudents = useMemo(() => {
    if (!search) return students;
    const query = search.toLowerCase();
    return students.filter((s: any) => 
      s.nama?.toLowerCase().includes(query) || 
      s.nisn?.includes(query)
    );
  }, [students, search]);

  const handlePrintAll = () => {
    window.print();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-blue-900 uppercase">Kartu Pelajar Digital</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Generator Identitas Siswa LP Ma'arif NU Cilacap</p>
        </div>
        <div className="flex gap-3">
            <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm flex items-center">
              <button 
                onClick={() => setIsBatchMode(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!isBatchMode ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Mode Tunggal
              </button>
              <button 
                onClick={() => setIsBatchMode(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isBatchMode ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Mode Batch
              </button>
            </div>
            {isBatchMode && (
               <Button 
                onClick={handlePrintAll} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-6 h-12 shadow-lg shadow-emerald-50 transition-all font-bold"
                disabled={filteredStudents.length === 0}
               >
                  <Printer className="w-4 h-4 mr-2" />
                  Cetak ({filteredStudents.length})
               </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* FILTER & SEARCH PANEL */}
        <div className="space-y-6 md:col-span-1 print:hidden">
            <Card className="border-0 shadow-sm bg-white rounded-[2rem] overflow-hidden">
                <CardHeader className="pb-4 border-b bg-slate-50/50 px-6 pt-6">
                    <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Filter Data</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 leading-none">
                            <School className="w-3.5 h-3.5 text-blue-600" /> Madrasah
                        </label>
                        <Select value={selectedSchoolId} onValueChange={(val) => {
                            setSelectedSchoolId(val);
                            setSelectedClassId("all");
                        }}>
                            <SelectTrigger className="bg-slate-50 border-0 rounded-xl h-11 focus:ring-blue-500">
                                <SelectValue placeholder="Semua Madrasah" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">Semua Madrasah</SelectItem>
                                {schools.map((s: any) => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.nama}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 leading-none">
                            <Layers className="w-3.5 h-3.5 text-blue-600" /> Kelas / Rombel
                        </label>
                        <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                            <SelectTrigger className="bg-slate-50 border-0 rounded-xl h-11 focus:ring-blue-500">
                                <SelectValue placeholder="Pilih Kelas" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">Semua Kelas</SelectItem>
                                {classes.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id.toString()}>{c.nama}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card className={`border-0 shadow-sm bg-white rounded-[2rem] overflow-hidden ${isBatchMode ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                <CardHeader className="pb-4 border-b bg-slate-50/50 px-6 pt-6">
                    <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Data Siswa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                        <Input 
                            placeholder="Cari nama / NISN..." 
                            className="pl-10 h-11 bg-slate-50 border-0 focus-visible:ring-blue-500 rounded-xl transition-all" 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    
                    <div className="space-y-2 h-[450px] overflow-y-auto pr-1 custom-scrollbar">
                        {isLoading ? (
                            <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 text-xs italic">
                                Siswa tidak ditemukan
                            </div>
                        ) : filteredStudents.map((s: any) => (
                            <div 
                                key={s.id} 
                                className={`p-4 rounded-2xl transition-all cursor-pointer border ${selectedStudent?.id === s.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                                onClick={() => setSelectedStudent(s)}
                            >
                                <div className="font-bold text-sm text-slate-800 line-clamp-1">{s.nama}</div>
                                <div className="text-[10px] font-bold text-blue-600 mt-1 uppercase tracking-tighter">NISN: {s.nisn || "-"}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* PREVIEW PANEL */}
        <div className="md:col-span-3">
          {isBatchMode ? (
            <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[600px] print:p-0 print:border-none print:shadow-none print:block print:w-full print:space-y-0">
               <div className="flex items-center justify-between border-b pb-6 mb-8 print:hidden">
                  <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Pratinjau Batch Kartu Pelajar</h3>
                  <Badge className="bg-blue-600 rounded-full px-4">{filteredStudents.length} Kartu</Badge>
               </div>
               
               {filteredStudents.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                        <Layers className="w-16 h-16 text-slate-200 mb-4" />
                        <p className="text-sm font-bold text-slate-600">Tidak ada kartu untuk ditampilkan</p>
                        <p className="text-xs text-slate-400 mt-1">Gunakan filter Madrasah atau Kelas untuk memuat data.</p>
                   </div>
               ) : (
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 justify-items-center print:block print:w-full">
                        {filteredStudents.map((s: any) => (
                        <div key={s.id} className="print:block print:w-full print:m-0 print:p-0 print:mb-20">
                            <StudentCard 
                                student={{
                                    nama: s.nama,
                                    nisn: s.nisn,
                                    nik: s.nik,
                                    namaSekolah: s.school?.nama || "-",
                                    photoId: s.foto_path,
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
                <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[600px] flex items-center justify-center relative">
                    <StudentCard student={{
                      nama: selectedStudent.nama,
                      nisn: selectedStudent.nisn,
                      nik: selectedStudent.nik,
                      namaSekolah: selectedStudent.school?.nama || "-",
                      photoId: selectedStudent.foto_path,
                      kelas: selectedStudent.kelas
                    }} />
                </div>
            ) : (
                <div className="h-full min-h-[600px] flex flex-col items-center justify-center border-2 border-dashed rounded-[2.5rem] bg-slate-50/50 text-slate-400">
                    <div className="bg-white h-24 w-24 rounded-3xl shadow-sm flex items-center justify-center mb-6">
                        <CreditCard className="w-10 h-10 text-blue-500 opacity-20" />
                    </div>
                    <p className="font-bold">Pilih siswa dari daftar database</p>
                    <p className="text-[10px] uppercase font-black tracking-widest mt-1 opacity-50 px-12 text-center">Preview Kartu Pelajar akan muncul secara otomatis</p>
                </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
