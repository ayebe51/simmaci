import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, Save, LogOut, Award, Info, RefreshCw, Filter } from 'lucide-react';
import { toast } from 'sonner';

const juryApi = {
  verifyPin: (data: any) => axios.post(`${API_URL}/public/jury/verify-pin`, data).then(r => r.data?.data ?? r.data),
  participants: (token: string) => axios.get(`${API_URL}/public/jury/${token}/participants`).then(r => r.data?.data ?? r.data),
  score: (token: string, data: any) => axios.post(`${API_URL}/public/jury/${token}/score`, data).then(r => r.data?.data ?? r.data),
};

type JuryState = 'login' | 'scoring';

interface Criterion { component: string; weight: number; }

export default function JuryScoringPage() {
  const [state, setState] = useState<JuryState>('login');
  const [token, setToken] = useState('');
  const [competitionId, setCompetitionId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [competition, setCompetition] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<number, { rank: string; score: string; notes: string; breakdown: Record<string, string> }>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [filterJenjang, setFilterJenjang] = useState<string>('all');

  // Reload participants (refresh scores from server)
  const loadParticipants = async (t: string) => {
    setLoading(true);
    try {
      const data = await juryApi.participants(t);
      setCompetition(data.competition);
      setParticipants(data.participants);
      // Pre-fill existing scores
      const init: typeof scores = {};
      (data.participants as any[]).forEach(p => {
        if (p.result) {
          const bd: Record<string, string> = {};
          (p.result.score_breakdown ?? []).forEach((b: any) => { bd[b.component] = String(b.value ?? ''); });
          init[p.id] = {
            rank: p.result.rank != null ? String(p.result.rank) : '',
            score: p.result.score != null ? String(p.result.score) : '',
            notes: p.result.notes ?? '',
            breakdown: bd,
          };
        }
      });
      setScores(init);
    } catch {
      toast.error('Gagal memuat data peserta');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competitionId.trim() || !pin.trim()) { toast.error('ID Lomba dan PIN wajib diisi'); return; }
    setLoading(true);
    try {
      const data = await juryApi.verifyPin({ competition_id: Number(competitionId), pin });
      const t = data.token;
      setToken(t);
      setState('scoring');
      await loadParticipants(t);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'PIN tidak valid');
    } finally {
      setLoading(false);
    }
  };

  const setScore = (pid: number, field: string, val: string) =>
    setScores(p => ({ ...p, [pid]: { rank: '', score: '', notes: '', breakdown: {}, ...p[pid], [field]: val } }));

  const setBreakdown = (pid: number, component: string, val: string) =>
    setScores(p => ({
      ...p,
      [pid]: {
        rank: '', score: '', notes: '', breakdown: {},
        ...p[pid],
        breakdown: { ...(p[pid]?.breakdown ?? {}), [component]: val },
      },
    }));

  // Auto-calculate weighted score from breakdown
  const calcWeightedScore = (pid: number, criteria: Criterion[]): string => {
    if (!criteria.length) return scores[pid]?.score ?? '';
    const bd = scores[pid]?.breakdown ?? {};
    let total = 0;
    let allFilled = true;
    criteria.forEach(c => {
      const v = parseFloat(bd[c.component] ?? '');
      if (isNaN(v)) { allFilled = false; return; }
      total += (v * c.weight) / 100;
    });
    return allFilled ? total.toFixed(2) : (scores[pid]?.score ?? '');
  };

  const handleSave = async (pid: number) => {
    setSavingId(pid);
    try {
      const s = scores[pid] ?? {};
      const criteria: Criterion[] = competition?.criteria ?? [];
      const weightedScore = calcWeightedScore(pid, criteria);

      const breakdown = criteria.length > 0
        ? criteria.map(c => ({ component: c.component, weight: c.weight, value: parseFloat(s.breakdown?.[c.component] ?? '0') || 0 }))
        : undefined;

      await juryApi.score(token, {
        participant_id: pid,
        rank: s.rank ? Number(s.rank) : undefined,
        score: weightedScore ? Number(weightedScore) : (s.score ? Number(s.score) : undefined),
        notes: s.notes || undefined,
        score_breakdown: breakdown,
      });
      setSavedIds(prev => new Set(prev).add(pid));
      const name = participants.find(p => p.id === pid)?.name ?? '';
      toast.success(`Nilai "${name}" tersimpan`, { icon: <CheckCircle2 size={14} className="text-green-600" /> });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Gagal menyimpan nilai');
    } finally {
      setSavingId(null);
    }
  };

  const handleLogout = () => { setState('login'); setToken(''); setCompetition(null); setParticipants([]); setScores({}); setSavedIds(new Set()); };

  const getRankEmoji = (r: number | undefined) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null;

  // ── Login screen ─────────────────────────────────────────────────────────

  if (state === 'login') return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Award className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Panel Juri</h1>
          <p className="text-slate-500 text-sm mt-1">LP Ma'arif NU Cilacap 2026</p>
        </div>

        <Card className="border-0 shadow-xl rounded-2xl">
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500">ID Cabang Lomba</Label>
                <Input
                  required
                  type="number"
                  value={competitionId}
                  onChange={e => setCompetitionId(e.target.value)}
                  placeholder="Contoh: 3"
                  className="h-11"
                />
                <p className="text-[10px] text-slate-400">ID diberikan oleh panitia</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500">PIN Juri</Label>
                <Input
                  required
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="PIN dari panitia..."
                  className="h-11"
                />
              </div>
              <Button type="submit" className="w-full h-11 bg-green-600 hover:bg-green-700 font-bold" disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin mr-2"/> : null} Masuk Panel Juri
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">
          Hubungi panitia untuk mendapatkan ID Lomba dan PIN Juri
        </p>
      </div>
    </div>
  );

  // ── Scoring panel ─────────────────────────────────────────────────────────

  const criteria: Criterion[] = competition?.criteria ?? [];
  const scoredCount = savedIds.size;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-emerald-600 text-white px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold opacity-70 uppercase tracking-wider">Panel Juri — LP Ma'arif NU</p>
            <h1 className="font-black text-lg truncate">{competition?.name}</h1>
            <p className="text-xs opacity-80">{competition?.event} {competition?.jenjang ? `· ${competition.jenjang}` : ''}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className="bg-white/20 text-white border-white/30 text-xs">
              {scoredCount}/{participants.length} dinilai
            </Badge>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 gap-1" onClick={() => loadParticipants(token)} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 gap-1" onClick={handleLogout}>
              <LogOut size={13}/> Keluar
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Criteria reference */}
        {criteria.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
            <p className="font-bold flex items-center gap-1.5 mb-2"><Info size={12}/>Kriteria Penilaian (Juknis)</p>
            <div className="flex flex-wrap gap-2">
              {criteria.map((c, i) => (
                <span key={i} className="bg-white border border-blue-100 rounded-lg px-2 py-1">
                  {c.component} <strong>({c.weight}%)</strong>
                </span>
              ))}
            </div>
            <p className="mt-2 text-blue-600">Skor akhir dihitung otomatis dari rata-rata tertimbang di atas.</p>
          </div>
        )}

        {/* Filter Jenjang */}
        <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <span className="text-sm font-bold text-slate-700">Filter Jenjang</span>
          </div>
          <Select value={filterJenjang} onValueChange={setFilterJenjang}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Semua Jenjang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Jenjang</SelectItem>
              <SelectItem value="MI/SD">MI / SD</SelectItem>
              <SelectItem value="MTs/SMP">MTs / SMP</SelectItem>
              <SelectItem value="MA/SMA/SMK">MA / SMA / SMK</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Participants */}
        {loading && participants.length === 0 ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-green-600 w-8 h-8" /></div>
        ) : participants.filter(p => filterJenjang === 'all' || p.jenjang === filterJenjang).length === 0 ? (
          <div className="text-center py-16 text-slate-400">Belum ada peserta {filterJenjang !== 'all' ? `untuk jenjang ${filterJenjang}` : ''}.</div>
        ) : (
          <div className="space-y-3">
            {participants.filter(p => filterJenjang === 'all' || p.jenjang === filterJenjang).map((p, idx) => {
              const s = scores[p.id] ?? { rank: '', score: '', notes: '', breakdown: {} };
              const isSaving = savingId === p.id;
              const isSaved = savedIds.has(p.id);
              const alreadyScored = p.result != null;
              const weightedScore = calcWeightedScore(p.id, criteria);
              const rankNum = s.rank ? Number(s.rank) : undefined;

              return (
                <Card key={p.id} className={`border-0 shadow-sm rounded-2xl transition-all ${isSaved ? 'ring-2 ring-green-300' : alreadyScored ? 'ring-1 ring-blue-200' : ''}`}>
                  <CardHeader className="pb-2 pt-4 px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-500">#{idx + 1}</span>
                          {rankNum && <span className="text-lg">{getRankEmoji(rankNum)}</span>}
                          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            {p.name}
                          </h3>
                          {p.gender_category && <Badge variant="outline" className="text-[9px] uppercase">{p.gender_category}</Badge>}
                        </div>
                        <p className="text-sm text-slate-500">
                          {p.institution} {p.jenjang && <span className="text-[10px] ml-1 bg-slate-100 px-1.5 rounded">{p.jenjang}</span>}
                        </p>
                        {p.video_url && (
                          <a href={p.video_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline mt-1 block">
                            🎬 Lihat Video Kiriman
                          </a>
                        )}
                        {p.documents && Object.keys(p.documents).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {Object.entries(p.documents).map(([name, url]) => (
                              <a key={name} href={url as string} target="_blank" rel="noreferrer" className="text-[10px] bg-slate-100 text-blue-600 px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-200 transition-colors">
                                📄 {name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isSaved && <Badge className="bg-green-100 text-green-700 text-[9px]">✓ Tersimpan</Badge>}
                        {alreadyScored && !isSaved && <Badge className="bg-blue-100 text-blue-700 text-[9px]">Ada nilai</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-4 space-y-3">
                    {/* Breakdown scores per criterion */}
                    {criteria.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {criteria.map(c => (
                          <div key={c.component} className="space-y-0.5">
                            <Label className="text-[10px] text-slate-500">{c.component} ({c.weight}%)</Label>
                            <Input
                              type="number" min="0" max="100" step="0.5"
                              value={s.breakdown?.[c.component] ?? ''}
                              onChange={e => setBreakdown(p.id, c.component, e.target.value)}
                              placeholder="0–100"
                              className="h-8 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-slate-500">
                          {criteria.length > 0 ? 'Skor Akhir (auto)' : 'Skor / Nilai'}
                        </Label>
                        <Input
                          type="number" min="0" max="100" step="0.01"
                          value={criteria.length > 0 ? weightedScore : s.score}
                          onChange={e => { if (criteria.length === 0) setScore(p.id, 'score', e.target.value); }}
                          readOnly={criteria.length > 0}
                          placeholder="—"
                          className={`h-8 text-sm font-bold ${criteria.length > 0 ? 'bg-slate-50 text-slate-600' : ''}`}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-slate-500">Juara ke-</Label>
                        <Select value={s.rank} onValueChange={v => setScore(p.id, 'rank', v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—"/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">🥇 Juara 1</SelectItem>
                            <SelectItem value="2">🥈 Juara 2</SelectItem>
                            <SelectItem value="3">🥉 Juara 3</SelectItem>
                            <SelectItem value="4">Harapan 1</SelectItem>
                            <SelectItem value="5">Harapan 2</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-slate-500">Catatan</Label>
                        <Input value={s.notes} onChange={e => setScore(p.id, 'notes', e.target.value)} placeholder="Catatan juri..." className="h-8 text-sm" />
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className={`w-full gap-1.5 ${isSaved ? 'bg-green-600 hover:bg-green-700' : ''}`}
                      onClick={() => handleSave(p.id)}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 size={13} className="animate-spin"/> : isSaved ? <CheckCircle2 size={13}/> : <Save size={13}/>}
                      {isSaved ? 'Tersimpan — Update Nilai' : 'Simpan Nilai'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="text-center text-xs text-slate-400 py-4 border-t">
          <p>LP Ma'arif NU PCNU Cilacap &bull; Panel Juri — Keputusan Dewan Juri bersifat mutlak</p>
        </div>
      </div>
    </div>
  );
}

// (Select imported at top of file)
