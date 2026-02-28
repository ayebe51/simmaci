import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import KtaCard from "../master-data/components/KtaCard";

export default function KtaGeneratorPage() {
  const [search, setSearch] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);

  // Fetch teachers for search (Use listAll for legacy behavior)
  const teachers = useQuery(api.teachers.listAll, { token: localStorage.getItem("token") || "" }) || [];

  const filteredTeachers = search 
    ? teachers.filter((t: any) => 
        t.nama?.toLowerCase().includes(search.toLowerCase()) || 
        t.nuptk?.includes(search) ||
        t.nip?.includes(search)
      )
    : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#004D40]">KTA Digital</h1>
          <p className="text-muted-foreground">Generator Kartu Tanda Anggota LP Ma'arif NU Cilacap</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SEARCH PANEL */}
        <Card className="print:hidden md:col-span-1 border-none shadow-md bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Cari Data Guru</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Nama / NUPTK / NIP..." 
                className="pl-8 bg-slate-50" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="border rounded-md h-[500px] overflow-y-auto bg-slate-50 shadow-inner">
                {filteredTeachers.length === 0 && (
                    <div className="p-8 text-center text-gray-400 text-sm italic">
                        {search ? "Data tidak ditemukan" : "Silakan ketik nama untuk mencari..."}
                    </div>
                )}
                {filteredTeachers.map((t: any) => (
                    <div 
                        key={t._id} 
                        className={`p-4 border-b transition-all cursor-pointer hover:bg-white active:bg-green-50 ${selectedTeacher?._id === t._id ? 'bg-white border-l-4 border-l-green-600 shadow-sm' : 'border-transparent'}`}
                        onClick={() => setSelectedTeacher(t)}
                    >
                        <div className="font-bold text-sm text-slate-800">{t.nama}</div>
                        <div className="flex gap-2 mt-1">
                            <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono">ID: {t.nuptk || "-"}</span>
                            <span className="text-[10px] bg-green-100 px-1.5 py-0.5 rounded text-green-700 truncate max-w-[150px]">{t.unitKerja}</span>
                        </div>
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* PREVIEW PANEL */}
        <div className="md:col-span-2 print:col-span-3">
            {selectedTeacher ? (
                <div className="bg-white p-8 rounded-xl shadow-lg border print:p-0 print:border-none print:shadow-none min-h-[600px] flex items-center justify-center">
                    <KtaCard teacher={selectedTeacher} />
                </div>
            ) : (
                <div className="h-full min-h-[600px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl bg-slate-50/50 text-gray-400">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                        <CreditCard className="w-12 h-12 opacity-20" />
                    </div>
                    <p className="font-medium">Pilih guru dari daftar di samping</p>
                    <p className="text-xs mt-1">Pratinjau KTA 2-Sisi akan muncul di sini</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
