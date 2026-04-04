import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, CreditCard, User, Printer, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import KtaCard from "../master-data/components/KtaCard";
import { useQuery } from "@tanstack/react-query";
import { teacherApi } from "@/lib/api";

export default function KtaGeneratorPage() {
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);

  // 🔥 REST API QUERY
  const { data: teachersData, isLoading } = useQuery({
    queryKey: ['teachers', 'kta'],
    queryFn: () => teacherApi.list({ per_page: 100 })
  });
  
  const teachers = teachersData?.data || [];
  
  const filteredTeachers = useMemo(() => {
    return search 
      ? teachers.filter((t: any) => 
          t.nama?.toLowerCase().includes(search.toLowerCase()) || 
          t.nuptk?.includes(search) ||
          t.nip?.includes(search)
        )
      : teachers;
  }, [teachers, search]);

  const handlePrintAll = () => {
    window.print();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">KTA Digital Guru</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Generator Kartu Identitas LP Ma'arif NU Cilacap</p>
        </div>
        <div className="flex gap-2">
           <Button variant={isBatchMode ? "default" : "outline"} onClick={() => setIsBatchMode(!isBatchMode)} className="rounded-xl">
              {isBatchMode ? "Mode Tunggal" : "Mode Batch"}
           </Button>
           {isBatchMode && (
             <Button onClick={handlePrintAll} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg">
               <Printer className="w-4 h-4 mr-2" /> Cetak Halaman
             </Button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* SIDE PANEL */}
        <Card className="print:hidden md:col-span-1 border-0 shadow-sm bg-white rounded-[2rem] overflow-hidden">
          <div className="p-6 space-y-6">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" /> Database Guru
            </h2>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Cari nama/NUPTK..." 
                className="pl-10 h-11 bg-slate-50 border-0 focus-visible:ring-emerald-500 rounded-xl transition-all" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="space-y-2 h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {isLoading ? (
                    <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>
                ) : filteredTeachers.map((t: any) => (
                  <div 
                      key={t.id} 
                      className={`p-4 rounded-2xl transition-all cursor-pointer border ${selectedPerson?.id === t.id ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                      onClick={() => setSelectedPerson(t)}
                  >
                      <div className="font-bold text-sm text-slate-800 line-clamp-1">{t.nama}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{t.nuptk || "No ID"}</div>
                  </div>
                ))}
                {!isLoading && filteredTeachers.length === 0 && (
                    <div className="py-20 text-center text-slate-400 text-xs italic">
                        Tidak ditemukan guru
                    </div>
                )}
            </div>
          </div>
        </Card>

        {/* MAIN DISPLAY AREA */}
        <div className="md:col-span-3">
          {isBatchMode ? (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[600px] print:p-0 print:border-none print:shadow-none print:block print:w-full print:space-y-0">
               <div className="flex items-center justify-between border-b pb-6 mb-8 print:hidden">
                  <h3 className="font-bold text-lg text-slate-800">Pratinjau Cetak Massal</h3>
                  <Badge variant="outline" className="rounded-full px-4">{filteredTeachers.length} Kartu</Badge>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 justify-items-center print:block print:w-full">
                 {filteredTeachers.map((person: any) => (
                   <div key={person.id} className="print:block print:w-full print:m-0 print:p-0 print:mb-20">
                     <KtaCard 
                        data={person} 
                        type="teacher" 
                        isBatch 
                        photoId={person.foto_path}
                      />
                   </div>
                 ))}
               </div>
            </div>
          ) : selectedPerson ? (
            <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-center min-h-[600px] print:p-0 print:border-none print:shadow-none">
                <KtaCard data={selectedPerson} type="teacher" photoId={selectedPerson.foto_path} />
            </div>
          ) : (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center border-2 border-dashed rounded-[2.5rem] bg-slate-50/50 text-slate-400">
                <div className="bg-white h-24 w-24 rounded-3xl shadow-sm flex items-center justify-center mb-6">
                    <CreditCard className="w-10 h-10 opacity-20" />
                </div>
                <p className="font-bold">Pilih guru dari daftar database</p>
                <p className="text-[10px] uppercase font-black tracking-widest mt-1 opacity-50 text-slate-400">Preview KTA akan muncul secara otomatis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
