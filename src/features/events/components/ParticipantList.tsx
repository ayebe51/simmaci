import { useState, useEffect } from 'react';
import { eventApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2, UserPlus, AlertTriangle, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Participant {
  id: number;
  name: string;
  institution: string;
  gender_category?: string;
  group_name?: string;
  member_count?: number;
  contact_phone?: string;
}

interface Props {
  competitionId: number;
  participants: Participant[];
  isVideoType?: boolean;
  onRefresh: () => void;
}

export default function ParticipantList({ competitionId, participants: init, isVideoType, onRefresh }: Props) {
  const [participants, setParticipants] = useState<Participant[]>(init ?? []);
  const [loading, setLoading] = useState(false);
  const [toDelete, setToDelete] = useState<Participant | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: '', institution: '', gender_category: '', group_name: '', member_count: '', contact_phone: '' });

  useEffect(() => { setParticipants(init ?? []); }, [init]);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.institution.trim()) {
      toast.error('Nama dan Asal Lembaga wajib diisi');
      return;
    }
    setLoading(true);
    try {
      await eventApi.participants.create(competitionId, {
        ...form,
        member_count: form.member_count ? Number(form.member_count) : undefined,
      });
      toast.success('Peserta berhasil ditambahkan');
      setForm({ name: '', institution: '', gender_category: '', group_name: '', member_count: '', contact_phone: '' });
      onRefresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Gagal menambahkan peserta');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await eventApi.participants.delete(toDelete.id);
      toast.success(`Peserta "${toDelete.name}" dihapus`);
      setToDelete(null);
      onRefresh();
    } catch {
      toast.error('Gagal menghapus peserta');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        {/* Add form */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border">
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase text-slate-500">Nama Peserta / Grup *</Label>
            <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Ahmad / Grup Nada Syahdu" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase text-slate-500">Asal Madrasah/Sekolah *</Label>
            <Input value={form.institution} onChange={e => setForm(p => ({...p, institution: e.target.value}))} placeholder="MTs Ma'arif 1 Cilacap" />
          </div>
          {isVideoType && (
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Pa / Pi / Campuran</Label>
              <Select value={form.gender_category} onValueChange={v => setForm(p => ({...p, gender_category: v}))}>
                <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pa">Putra (Pa)</SelectItem>
                  <SelectItem value="pi">Putri (Pi)</SelectItem>
                  <SelectItem value="campuran">Campuran</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase text-slate-500">No. HP Kontak</Label>
            <Input value={form.contact_phone} onChange={e => setForm(p => ({...p, contact_phone: e.target.value}))} placeholder="08xx..." />
          </div>
          <div className="sm:col-span-2 lg:col-span-1 flex items-end">
            <Button onClick={handleAdd} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 size={14} className="animate-spin"/> : <UserPlus size={14}/>}
              Tambah Peserta
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-10">No</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Lembaga</TableHead>
                {isVideoType && <TableHead>Kategori</TableHead>}
                <TableHead>Kontak</TableHead>
                <TableHead className="w-16">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isVideoType ? 6 : 5} className="text-center py-10 text-slate-400">
                    Belum ada peserta terdaftar.
                  </TableCell>
                </TableRow>
              ) : participants.map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell className="text-slate-500">{i + 1}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-slate-600 text-sm">{p.institution}</TableCell>
                  {isVideoType && <TableCell className="text-xs uppercase text-slate-500">{p.gender_category || '—'}</TableCell>}
                  <TableCell className="text-xs text-slate-500">{p.contact_phone || '—'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setToDelete(p)} className="text-red-500 hover:text-red-700 h-7 w-7 p-0">
                      <Trash2 size={13}/>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Delete dialog */}
        <Dialog open={!!toDelete} onOpenChange={o => { if (!o) setToDelete(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <UserMinus size={20}/>
                <DialogTitle>Hapus Peserta</DialogTitle>
              </div>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <p className="text-sm text-slate-600">Hapus peserta <strong>{toDelete?.name}</strong>?</p>
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-xs text-red-700 flex items-center gap-1.5"><AlertTriangle size={12}/> Data nilai peserta ini juga akan dihapus permanen.</p>
              </div>
            </div>
            <DialogFooter className="gap-2 border-t pt-3">
              <Button variant="ghost" size="sm" onClick={() => setToDelete(null)} disabled={deleting}>Batal</Button>
              <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Menghapus...' : 'Hapus'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
