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
import CompetitionExportModal from './CompetitionExportModal';

interface Criterion { component: string; weight: number; }

interface Props {
  competitionId: string;
  competition?: any;
  participants: any[];
  results: any[];
  criteria?: Criterion[];
  onSaved?: () => void;
}

export default function ResultInput({ competitionId, competition, participants, results: initial, criteria = [], onSaved }: Props) {
  const [map, setMap] = useState<Record<string, any>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filterJenjang, setFilterJenjang] = useState<string>('all');

  useEffect(() => {
    const m: Record<string, any> = {};
    (initial ?? []).forEach(r => { 
      const pid = r.participant_id ?? r.participantId;
      if (pid) m[pid] = r; 
    });
    (participants ?? []).forEach(p => {
      if (p.result && !m[p.id]) {
        m[p.id] = { ...p.result, participant_id: p.id };
      }
    });
    setMap(m);
  }, [initial, participants]);

  const set = (pid: string | number, field: string, value: string) =>
    setMap(p => ({ ...p, [pid]: { ...p[pid], participant_id: pid, [field]: value } }));

  const getBreakdownValue = (pid: string | number, component: string): string => {
    const raw = map[pid]?.score_breakdown;
    if (!raw) return '';
    if (Array.isArray(raw)) {
      const found = raw.find((b: any) => b.component === component);
      return found?.value != null ? String(found.value) : '';
    }
    if (typeof raw === 'object') {
      return raw[component] != null ? String(raw[component]) : '';
    }
    return '';
  };

  const setBreakdown = (pid: string | number, component: string, value: string) => {
    setMap(p => {
      const item = p[pid] ?? { participant_id: pid };
      const currentBreakdown = item.score_breakdown ?? {};
      const updated = Array.isArray(currentBreakdown)
        ? { ...Object.fromEntries(currentBreakdown.map((b: any) => [b.component, b.value])), [component]: value }
        : { ...currentBreakdown, [component]: value };
      return {
        ...p,
        [pid]: {
          ...item,
          score_breakdown: updated,
        }
      };
    });
  };

  const calcWeightedScore = (pid: string | number) => {
    if (criteria.length === 0) return '';
    let total = 0;
    for (const c of criteria) {
      const val = Number(getBreakdownValue(pid, c.component)) || 0;
      total += val * (c.weight / 100);
    }
    return total.toFixed(2);
  };

  const handleSave = async (pid: string | number) => {
    setSavingId(String(pid));
    const item = map[pid] ?? {};
    try {
      const breakdown = criteria.length > 0
        ? criteria.map(c => ({ component: c.component, weight: c.weight, value: parseFloat(getBreakdownValue(pid, c.component)) || 0 }))
        : item.score_breakdown;

      await eventApi.results.save(Number(competitionId), {
        participant_id: typeof pid === 'string' && pid.startsWith('reg_') ? pid : Number(pid),
        score: criteria.length > 0 ? Number(calcWeightedScore(pid)) : (item.score ? Number(item.score) : undefined),
        rank: item.rank ? Number(item.rank) : undefined,
        notes: item.notes,
        score_breakdown: breakdown,
      });
      const name = participants.find(p => p.id == pid)?.name ?? '';
      toast.success(`Nilai "${name}" tersimpan & juara otomatis dihitung`, { icon: <CheckCircle2 className="h-4 w-4 text-green-600" /> });
      onSaved?.();
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

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
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
          <div className="flex items-center gap-2 flex-wrap">
            <CompetitionExportModal
              competition={competition ?? { id: competitionId, name: 'Rekap Nilai' }}
              participants={participants.map(p => ({
                ...p,
                result: map[p.id] ?? p.result
              }))}
              filterJenjang={filterJenjang}
            />
            <ExcelImportModal
              title="Import Hasil Kompetisi"
              description="Upload file Excel (.xlsx). Kolom: Juara, Nama, Lembaga, Nilai."
              triggerLabel="Import Hasil (Excel)"
              onFileImport={handleImport}
            />
          </div>
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
                <TableHead className="w-[95px]">Juara (Auto)</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead className="w-[90px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.filter(p => filterJenjang === 'all' || p.jenjang === filterJenjang).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={criteria.length + 4} className="text-center py-10 text-slate-400">
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
                        {p.jury_scores && p.jury_scores.length > 0 && (
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-semibold">Juri ({p.jury_scores.length}):</span>
                            {p.jury_scores.map((js: any, idx: number) => (
                              <span key={idx} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200" title={`Catatan: ${js.notes || '-'}`}>
                                {js.jury_name}: <strong>{Number(js.score).toFixed(2)}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {criteria.length > 0 ? (
                      criteria.map(c => (
                        <TableCell key={c.component} className="p-2">
                          <Input
                            type="number" min="0" max="100" step="0.5"
                            value={getBreakdownValue(p.id, c.component)}
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
                        <Input type="number" min="1" max="10" value={r.rank ?? ''} onChange={e => set(p.id, 'rank', e.target.value)} placeholder="Auto" className="h-8 text-sm" />
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
