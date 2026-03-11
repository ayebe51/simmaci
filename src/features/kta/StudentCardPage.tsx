import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import StudentCard from "../master-data/components/StudentCard";

export default function StudentCardPage() {
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // Fetch all students (simplified for generator)
  const students = useQuery(api.students.list, { token: localStorage.getItem("token") || "" }) || [];

  const filteredStudents = search 
    ? students.filter((s: any) => 
        s.nama?.toLowerCase().includes(search.toLowerCase()) || 
        s.nisn?.includes(search) ||
        s.nik?.includes(search)
      )
    : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-blue-900">Kartu Pelajar Digital</h1>
          <p className="text-muted-foreground">Generator Kartu Identitas Siswa LP Ma'arif NU Cilacap</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SEARCH PANEL */}
        <Card className="print:hidden md:col-span-1 border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl rounded-3xl overflow-hidden relative z-10">
          <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[60%] bg-blue-400/10 blur-[100px] pointer-events-none rounded-full" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[60%] bg-indigo-400/10 blur-[100px] pointer-events-none rounded-full" />
          <CardHeader className="pb-4 border-b border-white/60 bg-white/40 px-6 pt-6">
            <CardTitle className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">Cari Data Siswa</CardTitle>
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
            
            <div className="border-0 rounded-2xl h-[500px] overflow-y-auto space-y-1 p-1 scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-transparent">
                {filteredStudents.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs italic bg-white/40 rounded-xl mt-4">
                        {search ? "Data tidak ditemukan" : "Silakan ketik nama untuk mencari..."}
                    </div>
                )}
                {filteredStudents.map((s: any) => (
                    <div 
                        key={s._id} 
                        className={`p-4 rounded-xl transition-all cursor-pointer hover:bg-white/80 active:scale-[0.98] ${selectedStudent?._id === s._id ? 'bg-white shadow-[0_4px_15px_rgb(0,0,0,0.05)] border-l-4 border-l-blue-500' : 'border border-transparent opacity-80'}`}
                        onClick={() => setSelectedStudent(s)}
                    >
                        <div className="font-bold text-xs text-slate-800 line-clamp-1">{s.nama}</div>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                            <span className="text-[9px] font-bold text-blue-700 bg-blue-100/50 px-2 py-0.5 rounded-full backdrop-blur-sm">NISN: {s.nisn || "-"}</span>
                            <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 truncate max-w-[200px]">{s.namaSekolah}</span>
                        </div>
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* PREVIEW PANEL */}
        <div className="md:col-span-2 print:col-span-3">
            {selectedStudent ? (
                <div className="bg-white p-8 rounded-xl shadow-lg border print:p-0 print:border-none print:shadow-none min-h-[600px] flex items-center justify-center">
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
                <div className="h-full min-h-[600px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl bg-slate-50/50 text-gray-400">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                        <CreditCard className="w-12 h-12 opacity-20 text-blue-600" />
                    </div>
                    <p className="font-medium">Pilih siswa dari daftar di samping</p>
                    <p className="text-xs mt-1">Pratinjau Kartu Pelajar akan muncul di sini</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
