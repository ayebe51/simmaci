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
  const students = useQuery(api.students.list, {}) || [];

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
        <Card className="print:hidden md:col-span-1 border-none shadow-md bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-blue-800">Cari Data Siswa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Nama / NISN / NIK..." 
                className="pl-8 bg-slate-50 border-blue-100" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="border rounded-md h-[500px] overflow-y-auto bg-slate-50 shadow-inner">
                {filteredStudents.length === 0 && (
                    <div className="p-8 text-center text-gray-400 text-sm italic">
                        {search ? "Data tidak ditemukan" : "Silakan ketik nama untuk mencari..."}
                    </div>
                )}
                {filteredStudents.map((s: any) => (
                    <div 
                        key={s._id} 
                        className={`p-4 border-b transition-all cursor-pointer hover:bg-white active:bg-blue-50 ${selectedStudent?._id === s._id ? 'bg-white border-l-4 border-l-blue-600 shadow-sm' : 'border-transparent'}`}
                        onClick={() => setSelectedStudent(s)}
                    >
                        <div className="font-bold text-sm text-slate-800">{s.nama}</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                            <span className="text-[10px] bg-blue-100 px-1.5 py-0.5 rounded text-blue-700 font-mono">NISN: {s.nisn || "-"}</span>
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
