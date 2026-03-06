import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BookOpen, Plus, Pencil, Trash2, Check, X } from "lucide-react";


export default function SubjectsPage() {
  const userStr = localStorage.getItem('user');
const user = userStr ? JSON.parse(userStr) : null;
  const schoolId = user?.schoolId as Id<"schools"> | undefined;
  const subjects = useQuery(api.subjects.list, schoolId ? { schoolId } : "skip");
  const createMutation = useMutation(api.subjects.create);
  const updateMutation = useMutation(api.subjects.update);
  const removeMutation = useMutation(api.subjects.remove);

  const [newNama, setNewNama] = useState("");
  const [newKode, setNewKode] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editKode, setEditKode] = useState("");

  const handleCreate = async () => {
    if (!schoolId || !newNama.trim()) return;
    try {
      await createMutation({ nama: newNama.trim(), kode: newKode.trim() || undefined, schoolId });
      setNewNama("");
      setNewKode("");
      toast.success("Mata pelajaran berhasil ditambahkan!");
    } catch { toast.error("Gagal menambahkan"); }
  };

  const handleUpdate = async (id: string, isActive: boolean) => {
    try {
      await updateMutation({ id: id as Id<"subjects">, nama: editNama, kode: editKode || undefined, isActive });
      setEditId(null);
      toast.success("Berhasil diupdate!");
    } catch { toast.error("Gagal mengupdate"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus mata pelajaran ini?")) return;
    try {
      await removeMutation({ id: id as Id<"subjects"> });
      toast.success("Berhasil dihapus");
    } catch { toast.error("Gagal menghapus"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mata Pelajaran</h1>
        <p className="text-slate-500 text-sm mt-1">Kelola daftar mata pelajaran untuk absensi</p>
      </div>

      {/* Add Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Tambah Mata Pelajaran
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="Nama (misal: Matematika)" value={newNama} onChange={(e) => setNewNama(e.target.value)} className="flex-1" />
            <Input placeholder="Kode (MTK)" value={newKode} onChange={(e) => setNewKode(e.target.value)} className="w-24" />
            <Button onClick={handleCreate} disabled={!newNama.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Tambah
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Daftar Mapel ({subjects?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {subjects?.map((s: any) => (
              <div key={s._id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border">
                {editId === s._id ? (
                  <div className="flex gap-2 flex-1 mr-2">
                    <Input value={editNama} onChange={(e) => setEditNama(e.target.value)} className="flex-1" />
                    <Input value={editKode} onChange={(e) => setEditKode(e.target.value)} className="w-24" />
                    <Button size="sm" onClick={() => handleUpdate(s._id, s.isActive)}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{s.nama}</span>
                      {s.kode && <Badge variant="secondary" className="font-mono text-xs">{s.kode}</Badge>}
                      {!s.isActive && <Badge variant="destructive" className="text-xs">Nonaktif</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditId(s._id); setEditNama(s.nama); setEditKode(s.kode || ""); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(s._id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {(!subjects || subjects.length === 0) && (
              <p className="text-center text-slate-400 py-8 text-sm">Belum ada mata pelajaran. Tambahkan di atas.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
