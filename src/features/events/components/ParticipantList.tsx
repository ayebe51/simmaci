import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2, AlertTriangle, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Participant {
  id: string;
  name: string;
  institution: string;
}

interface ParticipantListProps {
  competitionId: string;
  participants: Participant[];
}

export default function ParticipantList({ competitionId, participants: initialParticipants }: ParticipantListProps) {
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants || []);
  const [loading, setLoading] = useState(false);
  const [newParticipant, setNewParticipant] = useState({ name: '', institution: '' });
  
  // Custom Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [participantToDelete, setParticipantToDelete] = useState<Participant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setParticipants(initialParticipants || []);
  }, [initialParticipants]);

  const handleAdd = async () => {
    if (!newParticipant.name || !newParticipant.institution) {
        toast.error('Nama dan Asal Lembaga wajib diisi!');
        return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/events/competitions/${competitionId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newParticipant),
      });
      if (res.ok) {
        const added = await res.json();
        setParticipants([...participants, added]);
        setNewParticipant({ name: '', institution: '' });
        toast.success(`Peserta "${added.name}" berhasil ditambahkan`);
      } else {
          const err = await res.text();
          toast.error(`Gagal menambah peserta: ${err}`);
      }
    } catch (error) {
      console.error(error);
      toast.error('Terjadi kesalahan koneksi');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (p: Participant) => {
      setParticipantToDelete(p);
      setIsDeleteDialogOpen(true);
  }

  const confirmDelete = async () => {
      if(!participantToDelete) return;
      try {
          setIsDeleting(true);
          await fetch(`${API_URL}/events/participants/${participantToDelete.id}`, { method: 'DELETE' });
          setParticipants(participants.filter(p => p.id !== participantToDelete.id));
          toast.success(`Peserta "${participantToDelete.name}" berhasil dihapus`);
          setIsDeleteDialogOpen(false);
          setParticipantToDelete(null);
      } catch (e) { 
          console.error(e);
          toast.error("Gagal menghapus peserta");
      } finally {
          setIsDeleting(false);
      }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Nama Peserta</label>
            <Input
              value={newParticipant.name}
              onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
              placeholder="Contoh: Ahmad"
            />
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Asal Lembaga / Sekolah</label>
            <Input
              value={newParticipant.institution}
              onChange={(e) => setNewParticipant({ ...newParticipant, institution: e.target.value })}
              placeholder="Contoh: SMP Ma'arif 1"
            />
          </div>
          <Button onClick={handleAdd} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : 'Tambah Peserta'}
          </Button>
        </div>

        <div className="rounded-md border mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Lembaga</TableHead>
                <TableHead className="w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    Belum ada peserta terdaftar.
                  </TableCell>
                </TableRow>
              ) : (
                participants.map((p, index) => (
                  <TableRow key={p.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.institution}</TableCell>
                    <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(p)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={14} />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <div className="p-2 bg-red-50 rounded-full">
                            <UserMinus className="h-6 w-6" />
                        </div>
                        <DialogTitle className="text-xl font-bold">Hapus Peserta</DialogTitle>
                    </div>
                </DialogHeader>
                <div className="py-2">
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Apakah Anda yakin ingin menghapus peserta:
                    </p>
                    <p className="font-bold text-lg mt-1 text-slate-800">
                        {participantToDelete?.name}
                    </p>
                    <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-xs text-red-800 font-bold flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" /> PERINGATAN
                        </p>
                        <p className="text-[11px] text-red-700 mt-1 leading-normal">
                            Data peserta dan riwayat nilainya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                        </p>
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
                    <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
                        Batal
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={confirmDelete}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700 shadow-sm"
                    >
                        {isDeleting ? "Menghapus..." : "Ya, Hapus Peserta"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
