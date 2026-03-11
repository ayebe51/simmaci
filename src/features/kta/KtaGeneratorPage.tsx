import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, CreditCard, Users, User, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import KtaCard from "../master-data/components/KtaCard";

export default function KtaGeneratorPage() {
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);

  const token = localStorage.getItem("token") || "";
  const user = localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user") || "{}") : null;
  const schoolId = user?.role === "operator" ? user.schoolId : undefined;

  // Query Teachers only
  const teachers = useQuery(api.teachers.listAll, { token, schoolId }) || [];
  
  const filteredTeachers = useMemo(() => {
    return search 
      ? teachers.filter((t: any) => 
          t.nama?.toLowerCase().includes(search.toLowerCase()) || 
          t.nuptk?.includes(search) ||
          t.nip?.includes(search)
        )
      : teachers.slice(0, 50); // Show first 50 by default
  }, [teachers, search]);

  const handlePrintAll = () => {
    window.print();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">KTA Digital Guru</h1>
          <p className="text-muted-foreground text-sm">Generator Kartu Identitas LP Ma'arif NU Cilacap</p>
        </div>
        <div className="flex gap-2">
           <Button variant={isBatchMode ? "default" : "outline"} onClick={() => setIsBatchMode(!isBatchMode)}>
              {isBatchMode ? "Mode Tunggal" : "Mode Batch (Cetak Banyak)"}
           </Button>
           {isBatchMode && (
             <Button onClick={handlePrintAll} className="bg-emerald-600 hover:bg-emerald-700">
               <Printer className="w-4 h-4 mr-2" /> Cetak Halaman
             </Button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* SIDE PANEL */}
        <Card className="print:hidden md:col-span-1 border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl rounded-3xl overflow-hidden relative z-10">
          <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[60%] bg-emerald-400/10 blur-[100px] pointer-events-none rounded-full" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[60%] bg-blue-400/10 blur-[100px] pointer-events-none rounded-full" />
          
          <div className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-emerald-600" /> Daftar Guru & Tendik
            </h2>
            
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-emerald-600/60" />
              <Input 
                placeholder="Cari nama/ID..." 
                className="pl-10 bg-white/60 border-slate-200 focus-visible:ring-emerald-500 shadow-sm rounded-xl transition-all" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="border-0 rounded-2xl h-[500px] overflow-y-auto space-y-1 p-1 scrollbar-thin scrollbar-thumb-emerald-200 scrollbar-track-transparent">
                {filteredTeachers.map((t: any) => (
                  <div 
                      key={t._id} 
                      className={`p-3 rounded-xl transition-all cursor-pointer hover:bg-white/80 active:scale-[0.98] ${selectedPerson?._id === t._id ? 'bg-white shadow-[0_4px_15px_rgb(0,0,0,0.05)] border-l-4 border-l-emerald-500' : 'border border-transparent opacity-80'}`}
                      onClick={() => setSelectedPerson(t)}
                  >
                      <div className="font-bold text-xs text-slate-800 line-clamp-1">{t.nama}</div>
                      <div className="text-[10px] text-slate-500 mt-1">{t.nuptk || "No ID"}</div>
                  </div>
                ))}
                {filteredTeachers.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs italic bg-white/40 rounded-xl mt-4">
                        Tidak ditemukan
                    </div>
                )}
            </div>
          </div>
        </Card>

        {/* MAIN DISPLAY AREA */}
        <div className="md:col-span-3">
          {isBatchMode ? (
            <div className="bg-white p-6 rounded-3xl shadow-xl border space-y-8 min-h-[600px] print:p-0 print:border-none print:shadow-none">
               <div className="flex items-center justify-between border-b pb-4 print:hidden">
                  <h3 className="font-bold text-lg">Pratinjau Batch KTA Guru</h3>
                  <p className="text-xs text-slate-400 font-medium">Menampilkan {filteredTeachers.length} kartu</p>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 justify-items-center print:grid-cols-1 print:gap-12">
                 {filteredTeachers.map((person: any) => (
                   <div key={person._id} className="print:break-after-page">
                     <KtaCard 
                        data={person} 
                        type="teacher" 
                        isBatch 
                      />
                   </div>
                 ))}
               </div>
            </div>
          ) : selectedPerson ? (
            <div className="bg-white p-8 rounded-3xl shadow-2xl border flex items-center justify-center min-h-[600px] print:p-0 print:border-none print:shadow-none">
                <KtaCard data={selectedPerson} type="teacher" />
            </div>
          ) : (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center border-2 border-dashed rounded-3xl bg-slate-50/50 text-slate-300">
                <div className="bg-white p-6 rounded-full shadow-sm mb-6">
                    <CreditCard className="w-16 h-16 opacity-10" />
                </div>
                <p className="font-bold text-slate-400">Pilih data dari daftar di samping</p>
                <p className="text-xs mt-2 font-medium">KTA Guru akan muncul secara otomatis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
