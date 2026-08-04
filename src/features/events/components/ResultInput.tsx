import { useState, useEffect } from 'react';
import { eventApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, CheckCircle2, Loader2, Trophy, Filter } from 'lucide-react';
import { toast } from 'sonner';
import ExcelImportModal from '@/features/master-data/components/ExcelImportModal';

interface Criterion { component: string; weight: number; }

interface Props {
  competitionId: string;
  participants: any[];
  results: any[];
  criteria?: Criterion[];
}

export default function ResultInput({ competitionId, participants, results: initial, criteria = [] }: Props) {
  const [map, setMap] = useState<Record<string, any>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filterJenjang, setFilterJenjang] = useState<string>('all');

  useEffect(() => {
    const m: Record<string, any> = {};
    (initial ?? []).forEach(r => { m[r.participant_id ?? r.participantId] = r; });
    setMap(m);
  }, [initial]);

  const set = (pid: string | number, field: string, value: string) =>
    setMap(p => ({ ...p, [pid]: { ...p[pid], participant_id: pid, [field]: value } }));

  const setBreakdown = (pid: string | number, component: string, value: string) => {
    setMap(p => {
      const item = p[pid] ?? { participant_id: pid };
      const currentBreakdown = item.score_breakdown ?? {};
      return {
        ...p,
        [pid]: {
          ...item,
          score_breakdown: { ...currentBreakdown, [component]: value }
        }
      };
    });
  };

  const calcWeightedScore = (pid: string | number) => {
    const brk = map[pid]?.score_breakdown;
    if (!brk || criteria.length === 0) return '';
    let total = 0;
    for (const c of criteria) {
      const val = Number(brk[c.component]) || 0;
      total += val * (c.weight / 100);
    }
    return total.toFixed(2);
  };

  const handleSave = async (pid: string | number) => {
    setSavingId(String(pid));
    const item = map[pid] ?? {};
    try {
      await eventApi.results.save(Number(competitionId), {
        participant_id: typeof pid === 'string' && pid.startsWith('reg_') ? pid : Number(pid),
        score: criteria.length > 0 ? Number(calcWeightedScore(pid)) : (item.score ? Number(item.score) : undefined),
        rank: item.rank ? Number(item.rank) : undefined,
        notes: item.notes,
        score_breakdown: item.score_breakdown,
      });
      const name = participants.find(p => p.id == pid)?.name ?? '';
      toast.success(`Nilai "${name}" tersimpan`, { icon: <CheckCircle2 className="h-4 w-4 text-green-600" /> });
    } catch {
      toast.error('Gagal menyimpan nilai');
    } finally {
      setSavingId(null);
    }
  };

  const handleImport = async (file: File) => {
    try {
      const res = await eventApi.results.import(Number(competitionId), file);
      toast.success(`${res.imported ?? '?'} hasil berhasil diimport`);
      window.location.reload();
    } catch {
      toast.error('Gagal mengimport file');
    }
  };

  const getRankEmoji = (rank?: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {/* Scoring criteria reference */}
        {criteria.length > 0 && (
          <div className="p-3 bg-slate-50 rounded-xl border text-xs space-y-1">
            <p className="font-bold text-slate-600 uppercase">Bobot Penilaian</p>
            <div className="flex flex-wrap gap-2">
              {criteria.map((c, i) => (
                <span key={i} className="bg-white border rounded-lg px-2 py-1 text-slate-700">
                  {c.component} <span className="font-black text-blue-600">({c.weight}%)</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between items-end">
          <div className="space-y-1.5 w-[200px]">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Filter size={12} /> Filter Jenjang
            </label>
            <Select value={filterJenjang} onValueChange={setFilterJenjang}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Semua Jenjang" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenjang</SelectItem>
                <SelectItem value="MI/SD">MI / SD</SelectItem>
                <SelectItem value="MTs/SMP">MTs / SMP</SelectItem>
                <SelectItem value="MA/SMA/SMK">MA / SMA / SMK</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ExcelImportModal
            title="Import Hasil Kompetisi"
            description="Upload file Excel (.xlsx). Kolom: Juara, Nama, Lembaga, Nilai."
            triggerLabel="Import Hasil (Excel)"
            onFileImport={handleImport}
          />
        </div>

        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Nama Peserta</TableHead>
                {criteria.length > 0 ? (
                  criteria.map(c => (
                    <TableHead key={c.component} className="w-[100px] text-xs leading-tight">
                      {c.component} ({c.weight}%)
                    </TableHead>
                  ))
                ) : null}
                <TableHead className="w-[120px]">{criteria.length > 0 ? 'Total Skor' : 'Skor / Nilai'}</TableHead>
                <TableHead className="w-[90px]">Juara ke-</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead className="w-[90px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.filter(p => filterJenjang === 'all' || p.jenjang === filterJenjang).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-slate-400">
                    Belum ada peserta {filterJenjang !== 'all' ? `untuk jenjang ${filterJenjang}` : ''}.
                  </TableCell>
                </TableRow>
              ) : participants.filter(p => filterJenjang === 'all' || p.jenjang === filterJenjang).map(p => {
                const r = map[p.id] ?? {};
                const isSaving = savingId === String(p.id);
                const emoji = getRankEmoji(r.rank ? Number(r.rank) : undefined);
                return (
                  <TableRow key={p.id} className={r.rank == 1 ? 'bg-amber-50/40' : r.rank == 2 ? 'bg-slate-50/50' : r.rank == 3 ? 'bg-orange-50/30' : ''}>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-1.5">
                          {emoji && <span>{emoji}</span>}
                          {p.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {p.institution} {p.jenjang && <span className="text-[10px] ml-1 bg-slate-100 px-1.5 rounded">{p.jenjang}</span>}
                        </div>
                      </div>
                    </TableCell>
                    {criteria.length > 0 ? (
                      criteria.map(c => (
                        <TableCell key={c.component} className="p-2">
                          <Input
                            type="number" min="0" max="100" step="0.5"
                            value={r.score_breakdown?.[c.component] ?? ''}
                            onChange={e => setBreakdown(p.id, c.component, e.target.value)}
                            placeholder="0-100"
                            className="h-8 text-sm px-2 text-center"
                          />
                        </TableCell>
                      ))
                    ) : null}
                    <TableCell>
                      <Input 
                        type="number" 
                        value={criteria.length > 0 ? calcWeightedScore(p.id) : (r.score ?? '')} 
                        onChange={e => { if (criteria.length === 0) set(p.id, 'score', e.target.value); }} 
                        readOnly={criteria.length > 0}
                        placeholder="—" 
                        className={`h-8 text-sm ${criteria.length > 0 ? 'bg-slate-50 font-bold text-slate-600' : ''}`} 
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Input type="number" min="1" max="10" value={r.rank ?? ''} onChange={e => set(p.id, 'rank', e.target.value)} placeholder="—" className="h-8 text-sm" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input value={r.notes ?? ''} onChange={e => set(p.id, 'notes', e.target.value)} placeholder="Catatan..." className="h-8 text-sm" />
                    </TableCell>
                    <TableCell>
                      <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => handleSave(p.id)} disabled={isSaving}>
                        {isSaving ? <Loader2 size={11} className="animate-spin"/> : <Save size={11}/>}
                        Simpan
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
