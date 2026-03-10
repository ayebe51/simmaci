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
  const [activeTab, setActiveTab] = useState("teacher");
  const [selectedClass, setSelectedClass] = useState("all");
  const [isBatchMode, setIsBatchMode] = useState(false);

  const token = localStorage.getItem("token") || "";

  // Queries
  const teachers = useQuery(api.teachers.listAll, { token }) || [];
  const classes = useQuery(api.classes.listAll, { token }) || [];
  const students = useQuery(api.students.list, activeTab === "student" ? { token } : "skip") || [];

  const filteredTeachers = useMemo(() => {
    if (activeTab !== "teacher") return [];
    return search 
      ? teachers.filter((t: any) => 
          t.nama?.toLowerCase().includes(search.toLowerCase()) || 
          t.nuptk?.includes(search) ||
          t.nip?.includes(search)
        )
      : teachers.slice(0, 50); // Show first 50 by default
  }, [teachers, search, activeTab]);

  const filteredStudents = useMemo(() => {
    if (activeTab !== "student") return [];
    let filtered = students;
    if (selectedClass !== "all") {
      filtered = filtered.filter((s: any) => s.kelas === selectedClass);
    }
    if (search) {
      filtered = filtered.filter((s: any) => 
        s.nama?.toLowerCase().includes(search.toLowerCase()) || 
        s.nisn?.includes(search)
      );
    }
    return filtered.slice(0, 100); // Limit preview for performance
  }, [students, search, selectedClass, activeTab]);

  const handlePrintAll = () => {
    window.print();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">KTA Digital</h1>
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
        <Card className="print:hidden md:col-span-1 border-none shadow-xl bg-white rounded-3xl overflow-hidden">
          <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setSelectedPerson(null); }} className="w-full">
            <TabsList className="w-full grid grid-cols-2 rounded-none h-12">
              <TabsTrigger value="teacher" className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
                <User className="w-3.5 h-3.5 mr-2" /> Guru
              </TabsTrigger>
              <TabsTrigger value="student" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                <Users className="w-3.5 h-3.5 mr-2" /> Siswa
              </TabsTrigger>
            </TabsList>
            
            <CardContent className="p-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Cari nama/ID..." 
                  className="pl-9 bg-slate-50 border-slate-200 rounded-xl" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {activeTab === "student" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Pilih Kelas</label>
                  <select 
                    title="Pilih Kelas"
                    value={selectedClass} 
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="all">Semua Kelas</option>
                    {classes.map((c: any) => <option key={c._id} value={c.nama}>{c.nama}</option>)}
                  </select>
                </div>
              )}
              
              <div className="border rounded-2xl h-[450px] overflow-y-auto bg-slate-50/50 space-y-1 p-1">
                  {activeTab === "teacher" ? (
                    filteredTeachers.map((t: any) => (
                      <div 
                          key={t._id} 
                          className={`p-3 rounded-xl transition-all cursor-pointer hover:bg-white active:scale-[0.98] ${selectedPerson?._id === t._id ? 'bg-white shadow-md border-l-4 border-l-emerald-600' : 'border border-transparent opacity-70'}`}
                          onClick={() => setSelectedPerson(t)}
                      >
                          <div className="font-bold text-xs text-slate-800 line-clamp-1">{t.nama}</div>
                          <div className="text-[9px] text-slate-400 mt-0.5">{t.nuptk || "No ID"}</div>
                      </div>
                    ))
                  ) : (
                    filteredStudents.map((s: any) => (
                      <div 
                          key={s._id} 
                          className={`p-3 rounded-xl transition-all cursor-pointer hover:bg-white active:scale-[0.98] ${selectedPerson?._id === s._id ? 'bg-white shadow-md border-l-4 border-l-blue-600' : 'border border-transparent opacity-70'}`}
                          onClick={() => setSelectedPerson(s)}
                      >
                          <div className="font-bold text-xs text-slate-800 line-clamp-1">{s.nama}</div>
                          <div className="flex justify-between items-center mt-0.5">
                            <span className="text-[9px] text-slate-400">{s.nisn}</span>
                            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{s.kelas}</span>
                          </div>
                      </div>
                    ))
                  )}
                  {(activeTab === "teacher" ? filteredTeachers : filteredStudents).length === 0 && (
                      <div className="p-8 text-center text-slate-400 text-xs italic">
                          Tidak ditemukan
                      </div>
                  )}
              </div>
            </CardContent>
          </Tabs>
        </Card>

        {/* MAIN DISPLAY AREA */}
        <div className="md:col-span-3">
          {isBatchMode ? (
            <div className="bg-white p-6 rounded-3xl shadow-xl border space-y-8 min-h-[600px] print:p-0 print:border-none print:shadow-none">
               <div className="flex items-center justify-between border-b pb-4 print:hidden">
                  <h3 className="font-bold text-lg">Pratinjau Batch {activeTab === "teacher" ? "Guru" : `Siswa Kelas ${selectedClass}`}</h3>
                  <p className="text-xs text-slate-400 font-medium">Menampilkan {activeTab === "teacher" ? filteredTeachers.length : filteredStudents.length} kartu</p>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 justify-items-center print:grid-cols-1 print:gap-12">
                 {(activeTab === "teacher" ? filteredTeachers : filteredStudents).map((person: any) => (
                   <div key={person._id} className="print:break-after-page">
                     <KtaCard 
                        data={person} 
                        type={activeTab as "teacher" | "student"} 
                        isBatch 
                      />
                   </div>
                 ))}
               </div>
            </div>
          ) : selectedPerson ? (
            <div className="bg-white p-8 rounded-3xl shadow-2xl border flex items-center justify-center min-h-[600px] print:p-0 print:border-none print:shadow-none">
                <KtaCard data={selectedPerson} type={activeTab as "teacher" | "student"} />
            </div>
          ) : (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center border-2 border-dashed rounded-3xl bg-slate-50/50 text-slate-300">
                <div className="bg-white p-6 rounded-full shadow-sm mb-6">
                    <CreditCard className="w-16 h-16 opacity-10" />
                </div>
                <p className="font-bold text-slate-400">Pilih data dari daftar di samping</p>
                <p className="text-xs mt-2 font-medium">KTA {activeTab === "teacher" ? "Guru" : "Siswa"} akan muncul secara otomatis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
