import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BookOpen, Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "@/lib/api";

export default function SubjectsPage() {
  const queryClient = useQueryClient();
  
  // 🔥 REST API QUERIES
  const { data: subjects = [], isLoading } = useQuery({ 
      queryKey: ['subjects'], 
      queryFn: attendanceApi.subjectList 
  });

  const createMutation = useMutation({
    queryFn: (data: any) => attendanceApi.subjectStore(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setNewNama("");
      setNewKode("");
      toast.success("Mata pelajaran berhasil ditambahkan!");
    }
  });

  const updateMutation = useMutation({
    queryFn: ({ id, data }: { id: number, data: any }) => attendanceApi.subjectUpdate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setEditId(null);
      toast.success("Berhasil diperbarui!");
    }
  });

  const [newNama, setNewNama] = useState("");
  const [newKode, setNewKode] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editKode, setEditKode] = useState("");

  const handleCreate = () => {
    if (!newNama.trim()) return;
    createMutation.mutate({ nama: newNama.trim(), kode: newKode.trim() || undefined });
  };

  const handleUpdate = (id: number) => {
    updateMutation.mutate({ id, data: { nama: editNama, kode: editKode || undefined } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mata Pelajaran</h1>
        <p className="text-slate-500 text-sm mt-1">Kelola daftar mata pelajaran untuk absensi</p>
      </div>

      <Card className="border-0 shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-600" />
            Tambah Mata Pelajaran
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="Nama (misal: Matematika)" value={newNama} onChange={(e) => setNewNama(e.target.value)} className="flex-1 rounded-lg" />
            <Input placeholder="Kode" value={newKode} onChange={(e) => setNewKode(e.target.value)} className="w-24 rounded-lg" />
            <Button onClick={handleCreate} disabled={!newNama.trim() || createMutation.isPending} className="bg-emerald-600">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} 
              Tambah
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-3 bg-slate-50/50">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-600" />
            Daftar Mapel ({subjects.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2">
            {isLoading ? (
               <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
            ) : subjects.length === 0 ? (
               <p className="text-center text-slate-400 py-8 text-sm">Belum ada mata pelajaran. Tambahkan di atas.</p>
            ) : (
                subjects.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-100 hover:border-emerald-200 transition-colors">
                    {editId === s.id ? (
                      <div className="flex gap-2 flex-1 mr-2">
                        <Input value={editNama} onChange={(e) => setEditNama(e.target.value)} className="flex-1" />
                        <Input value={editKode} onChange={(e) => setEditKode(e.target.value)} className="w-24" />
                        <Button size="sm" onClick={() => handleUpdate(s.id)} disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-700">{s.nama}</span>
                          {s.kode && <Badge variant="secondary" className="font-mono text-[10px] bg-white border-slate-200 text-slate-600 px-2 uppercase">{s.kode}</Badge>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600 rounded-full" onClick={() => { setEditId(s.id); setEditNama(s.nama); setEditKode(s.kode || ""); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600 rounded-full">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
