import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { School, Plus, Pencil, Trash2, Check, X } from "lucide-react";


export default function ClassesPage() {
  const userStr = localStorage.getItem('user');
const user = userStr ? JSON.parse(userStr) : null;
  const schoolId = user?.schoolId as Id<"schools"> | undefined;
  const classes = useQuery(api.classes.list, schoolId ? { schoolId } : "skip");
  const teachers = useQuery(api.teachers.getBySchool, schoolId ? { schoolId } : "skip");
  const createMutation = useMutation(api.classes.create);
  const updateMutation = useMutation(api.classes.update);
  const removeMutation = useMutation(api.classes.remove);

  const [newNama, setNewNama] = useState("");
  const [newTingkat, setNewTingkat] = useState("");
  const [newWaliKelas, setNewWaliKelas] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editTingkat, setEditTingkat] = useState("");
  const [editWaliKelas, setEditWaliKelas] = useState("");

  const currentTahunAjaran = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  })();

  const handleCreate = async () => {
    if (!schoolId || !newNama.trim() || !newTingkat) return;
    try {
      await createMutation({
        nama: newNama.trim(),
        tingkat: newTingkat,
        tahunAjaran: currentTahunAjaran,
        waliKelasId: newWaliKelas ? newWaliKelas as Id<"teachers"> : undefined,
        schoolId,
      });
      setNewNama(""); setNewTingkat(""); setNewWaliKelas("");
      toast.success("Kelas berhasil ditambahkan!");
    } catch { toast.error("Gagal menambahkan kelas"); }
  };

  const handleUpdate = async (id: string, isActive: boolean) => {
    try {
      await updateMutation({
        id: id as Id<"classes">,
        nama: editNama,
        tingkat: editTingkat,
        tahunAjaran: currentTahunAjaran,
        waliKelasId: editWaliKelas ? editWaliKelas as Id<"teachers"> : undefined,
        isActive,
      });
      setEditId(null);
      toast.success("Kelas berhasil diupdate!");
    } catch { toast.error("Gagal mengupdate"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus kelas ini?")) return;
    try {
      await removeMutation({ id: id as Id<"classes"> });
      toast.success("Kelas dihapus");
    } catch { toast.error("Gagal menghapus"); }
  };

  const getTeacherName = (id: string) => {
    const t = teachers?.find((t: any) => t._id === id);
    return t ? t.nama : "-";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Kelas / Rombel</h1>
        <p className="text-slate-500 text-sm mt-1">Kelola kelas dan wali kelas — TA {currentTahunAjaran}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Tambah Kelas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-4">
            <Input placeholder="Nama (misal: 1A)" value={newNama} onChange={(e) => setNewNama(e.target.value)} />
            <Select value={newTingkat} onValueChange={setNewTingkat}>
              <SelectTrigger><SelectValue placeholder="Tingkat" /></SelectTrigger>
              <SelectContent>
                {["1","2","3","4","5","6","7","8","9","10","11","12"].map(t => (
                  <SelectItem key={t} value={t}>Kelas {t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={newWaliKelas} onValueChange={setNewWaliKelas}>
              <SelectTrigger><SelectValue placeholder="Wali Kelas (opsional)" /></SelectTrigger>
              <SelectContent>
                {teachers?.map((t: any) => (
                  <SelectItem key={t._id} value={t._id}>{t.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleCreate} disabled={!newNama.trim() || !newTingkat}>
              <Plus className="h-4 w-4 mr-1" /> Tambah
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><School className="h-4 w-4" /> Daftar Kelas ({classes?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {classes?.map((c: any) => (
              <div key={c._id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border">
                {editId === c._id ? (
                  <div className="flex gap-2 flex-1 mr-2">
                    <Input value={editNama} onChange={(e) => setEditNama(e.target.value)} className="w-24" />
                    <Select value={editTingkat} onValueChange={setEditTingkat}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["1","2","3","4","5","6","7","8","9","10","11","12"].map(t => (
                          <SelectItem key={t} value={t}>Kelas {t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => handleUpdate(c._id, c.isActive)}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-bold">{c.nama}</Badge>
                      <span className="text-sm text-slate-600">Tingkat {c.tingkat}</span>
                      {c.waliKelasId && <span className="text-xs text-slate-400">Wali: {getTeacherName(c.waliKelasId)}</span>}
                      {!c.isActive && <Badge variant="destructive" className="text-xs">Nonaktif</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditId(c._id); setEditNama(c.nama); setEditTingkat(c.tingkat); setEditWaliKelas(c.waliKelasId || ""); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(c._id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {(!classes || classes.length === 0) && (
              <p className="text-center text-slate-400 py-8 text-sm">Belum ada kelas. Tambahkan di atas.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
