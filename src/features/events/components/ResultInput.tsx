import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Result {
  participantId: string;
  score?: number;
  rank?: number;
  notes?: string;
}

interface Participant {
  id: string;
  name: string;
  institution: string;
}

interface ResultInputProps {
  competitionId: string;
  participants: Participant[];
  results: Result[];
}

export default function ResultInput({ competitionId, participants, results: initialResults }: ResultInputProps) {
  const [resultsMap, setResultsMap] = useState<Record<string, Result>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const map: Record<string, Result> = {};
    if (initialResults) {
      initialResults.forEach(r => {
        map[r.participantId] = r;
      });
    }
    setResultsMap(map);
  }, [initialResults]);

  const handleChange = (participantId: string, field: keyof Result, value: string) => {
    setResultsMap(prev => ({
      ...prev,
      [participantId]: {
        ...prev[participantId],
        participantId,
        [field]: value
      }
    }));
  };

  const handleSave = async (participantId: string) => {
    setSaving(true);
    const data = resultsMap[participantId] || {};
    try {
      await fetch(`${API_URL}/events/competitions/${competitionId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          score: data.score ? Number(data.score) : undefined,
          rank: data.rank ? Number(data.rank) : undefined,
          notes: data.notes,
        }),
      });
      toast.success(`Nilai untuk "${participants.find(p => p.id === participantId)?.name}" tersimpan`, {
          icon: <CheckCircle2 className="h-4 w-4 text-green-600" />
      });
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan nilai');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Peserta</TableHead>
              <TableHead className="w-[150px]">Skor / Nilai</TableHead>
              <TableHead className="w-[100px]">Ranking</TableHead>
              <TableHead>Catatan</TableHead>
              <TableHead className="w-[100px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map((p) => {
              const res = resultsMap[p.id] || {};
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.institution}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={res.score || ''}
                      onChange={(e) => handleChange(p.id, 'score', e.target.value)}
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={res.rank || ''}
                      onChange={(e) => handleChange(p.id, 'rank', e.target.value)}
                      placeholder="-"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={res.notes || ''}
                      onChange={(e) => handleChange(p.id, 'notes', e.target.value)}
                      placeholder="Catatan..."
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => handleSave(p.id)} disabled={saving}>
                      <Save size={14} className="mr-1" /> Simpan
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
