import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Trash2 } from 'lucide-react';

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

  useEffect(() => {
    setParticipants(initialParticipants || []);
  }, [initialParticipants]);

  const handleAdd = async () => {
    if (!newParticipant.name || !newParticipant.institution) {
        alert('Nama dan Asal Lembaga wajib diisi!');
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
        alert('Peserta berhasil ditambahkan');
      } else {
          const err = await res.text();
          alert(`Gagal menambah peserta: ${err}`);
      }
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan koneksi');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
      if(!confirm('Hapus peserta ini?')) return;
      try {
          await fetch(`${API_URL}/events/participants/${id}`, { method: 'DELETE' });
          setParticipants(participants.filter(p => p.id !== id));
      } catch (e) { console.error(e); }
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
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={14} />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
