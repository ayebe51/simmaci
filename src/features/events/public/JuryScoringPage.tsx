import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, CheckCircle2, Save, LogOut, Award, Info, RefreshCw, Filter, 
  ExternalLink, FileText, Video, FolderOpen, AlertCircle, UserCheck, Sparkles, Lock 
} from 'lucide-react';
import { toast } from 'sonner';

const juryApi = {
  getExistingJuries: (competitionId: number | string) => 
    axios.get(`${API_URL}/public/jury/competitions/${competitionId}/existing-juries`).then(r => r.data?.data ?? r.data),
  verifyPin: (data: any) => 
    axios.post(`${API_URL}/public/jury/verify-pin`, data).then(r => r.data?.data ?? r.data),
  participants: (token: string, phase: number = 1) => 
    axios.get(`${API_URL}/public/jury/${token}/participants`, { params: { phase } }).then(r => r.data?.data ?? r.data),
  score: (token: string, data: any) => 
    axios.post(`${API_URL}/public/jury/${token}/score`, data).then(r => r.data?.data ?? r.data),
};

type JuryState = 'login' | 'scoring';

interface Criterion { 
  component: string; 
  weight: number; 
}

export default function JuryScoringPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<JuryState>('login');
  const [token, setToken] = useState('');
  const [competitionId, setCompetitionId] = useState('');
  const [pin, setPin] = useState('');
  const [juryName, setJuryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingJuries, setExistingJuries] = useState<string[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<number>(1);
  const [competition, setCompetition] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string | number, { rank: string; score: string; notes: string; breakdown: Record<string, string> }>>({});
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string | number>>(new Set());
  const [filterJenjang, setFilterJenjang] = useState<string>('all');

  // Auto-restore session from sessionStorage on reload / tab refresh
  useEffect(() => {
    const raw = sessionStorage.getItem('jury_session');
    if (raw) {
      try {
        const sess = JSON.parse(raw);
        if (sess?.token && sess?.competitionId) {
          setToken(sess.token);
          setCompetitionId(String(sess.competitionId));
          setJuryName(sess.juryName || '');
          const phase = sess.selectedPhase || 1;
          setSelectedPhase(phase);
          setState('scoring');
          loadParticipants(sess.token, phase);
        }
      } catch {
        sessionStorage.removeItem('jury_session');
      }
    }
  }, []);

  // Pre-fill competition ID from URL if present
  useEffect(() => {
    const cid = searchParams.get('competition') || searchParams.get('competition_id');
    if (cid && !competitionId) {
      setCompetitionId(cid);
    }
  }, [searchParams]);

  // Load existing juries when competition ID changes
  useEffect(() => {
    if (!competitionId || state !== 'login') return;
    const cid = Number(competitionId);
    if (!cid || isNaN(cid)) {
      setExistingJuries([]);
      return;
    }
    let isMounted = true;
    juryApi.getExistingJuries(cid)
      .then(res => {
        if (isMounted && res?.existing_juries) {
          setExistingJuries(res.existing_juries);
        }
      })
      .catch(() => {
        if (isMounted) setExistingJuries([]);
      });
    return () => { isMounted = false; };
  }, [competitionId, state]);

  // Reload participants (refresh scores & auto-rank from server)
  const loadParticipants = async (t: string, phase: number = selectedPhase) => {
    setLoading(true);
    try {
      const data = await juryApi.participants(t, phase);
      setCompetition(data.competition);
      setParticipants(data.participants);
      if (data.jury_name && !juryName) {
        setJuryName(data.jury_name);
      }
      // Pre-fill existing scores
      const init: typeof scores = {};
      (data.participants as any[]).forEach(p => {
        if (p.result) {
          const bd: Record<string, string> = {};
          const raw = p.result.score_breakdown;
          if (Array.isArray(raw)) {
            raw.forEach((b: any) => { bd[b.component] = String(b.value ?? ''); });
          } else if (raw && typeof raw === 'object') {
            Object.entries(raw).forEach(([k, v]) => { bd[k] = String(v ?? ''); });
          }
          init[p.id] = {
            rank: p.result.rank != null ? String(p.result.rank) : '',
            score: p.result.score != null ? String(p.result.score) : '',
            notes: p.result.notes ?? '',
            breakdown: bd,
          };
        }
      });
      setScores(init);
    } catch (e: any) {
      if (e.response?.status === 401 || e.response?.status === 403) {
        sessionStorage.removeItem('jury_session');
        setState('login');
      }
      toast.error('Gagal memuat data peserta');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competitionId.trim() || !pin.trim() || !juryName.trim()) {
      toast.error('ID Lomba, PIN, dan Nama Dewan Juri wajib diisi');
      return;
    }
    setLoading(true);
    try {
      const data = await juryApi.verifyPin({
        competition_id: Number(competitionId),
        pin: pin.trim(),
        jury_name: juryName.trim(),
      });
      const t = data.token;
      const finalJuryName = data.jury_name || juryName.trim();
      setToken(t);
      if (data.jury_name) {
        setJuryName(data.jury_name);
      }
      if (data.matched_existing && data.original_input && data.jury_name.toLowerCase() !== data.original_input.toLowerCase()) {
        toast.info(`Nama Anda otomatis dicocokkan sebagai "${data.jury_name}".`);
      }
      sessionStorage.setItem('jury_session', JSON.stringify({
        token: t,
        competitionId: Number(competitionId),
        juryName: finalJuryName,
        selectedPhase,
      }));
      setState('scoring');
      await loadParticipants(t, selectedPhase);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'PIN tidak valid');
    } finally {
      setLoading(false);
    }
  };

  const handlePhaseChange = async (phase: number) => {
    setSelectedPhase(phase);
    const raw = sessionStorage.getItem('jury_session');
    if (raw) {
      try {
        const sess = JSON.parse(raw);
        sess.selectedPhase = phase;
        sessionStorage.setItem('jury_session', JSON.stringify(sess));
      } catch {}
    }
    await loadParticipants(token, phase);
  };

  const setScore = (pid: string | number, field: string, val: string) =>
    setScores(p => ({ ...p, [pid]: { rank: '', score: '', notes: '', breakdown: {}, ...p[pid], [field]: val } }));

  const setBreakdown = (pid: string | number, component: string, val: string) =>
    setScores(p => ({
      ...p,
      [pid]: {
        rank: p[pid]?.rank ?? '',
        score: p[pid]?.score ?? '',
        notes: p[pid]?.notes ?? '',
        ...p[pid],
        breakdown: { ...(p[pid]?.breakdown ?? {}), [component]: val },
      },
    }));

  // Get active criteria based on competition type and phase
  const isTwoPhase = Boolean(competition?.is_two_phase);
  const isLocked = Boolean(competition?.is_locked);
  const isFreezeSubmitted = Boolean(competition?.freeze_submitted_scores);
  const isPhase1Locked = Boolean(isTwoPhase && selectedPhase === 1 && (competition?.is_phase1_locked || competition?.has_finalists));
  const activeCriteria: Criterion[] = isTwoPhase
    ? (selectedPhase === 1 ? (competition?.phase1_criteria ?? []) : (competition?.phase2_criteria ?? []))
    : (competition?.criteria ?? []);

  // Calculate current active component subtotal
  const calcActiveSubtotal = (pid: string | number): number => {
    if (!activeCriteria.length) return parseFloat(scores[pid]?.score ?? '0') || 0;
    const bd = scores[pid]?.breakdown ?? {};
    let sum = 0;
    activeCriteria.forEach(c => {
      const v = parseFloat(bd[c.component] ?? '');
      if (!isNaN(v)) {
        sum += (v * c.weight) / 100;
      }
    });
    // Fallback if breakdown wasn't parsed but overall score exists
    if (sum === 0 && scores[pid]?.score) {
      const rawScore = parseFloat(scores[pid]?.score);
      if (!isNaN(rawScore) && rawScore > 0) return rawScore;
    }
    return sum;
  };

  const handleSave = async (pid: string | number) => {
    const pObj = participants.find(p => p.id === pid);
    const isAlreadyScored = Boolean(pObj?.result?.is_scored_by_me || savedIds.has(pid));
    if (isLocked || isPhase1Locked || (isFreezeSubmitted && isAlreadyScored)) {
      if (isPhase1Locked) {
        toast.error('Penilaian seleksi berkas (Fase 1) telah selesai dan dikunci permanen.');
      } else {
        toast.error('Nilai untuk peserta ini sudah pernah disimpan dan telah dikunci.');
      }
      return;
    }
    setSavingId(pid);
    try {
      const s = scores[pid] ?? {};
      const activeSubtotal = calcActiveSubtotal(pid);

      const breakdown = activeCriteria.length > 0
        ? activeCriteria.map(c => ({
            component: c.component,
            weight: c.weight,
            value: parseFloat(s.breakdown?.[c.component] ?? '0') || 0
          }))
        : undefined;

      // In Phase 2, saveScore combines Phase 1 score + Phase 2 subtotal
      let saveScore = Number(activeSubtotal.toFixed(2));
      if (isTwoPhase && selectedPhase === 2) {
        const pObj = participants.find(p => p.id === pid);
        const p1 = Number(pObj?.result?.phase1_effective_score ?? pObj?.result?.phase1_avg_score ?? pObj?.result?.phase1_score ?? 0);
        saveScore = Number((p1 + activeSubtotal).toFixed(2));
      }

      await juryApi.score(token, {
        participant_id: pid,
        rank: s.rank ? Number(s.rank) : undefined,
        score: saveScore,
        notes: s.notes || undefined,
        score_breakdown: breakdown,
        phase: isTwoPhase ? selectedPhase : undefined,
      });

      setSavedIds(prev => new Set(prev).add(pid));
      const name = participants.find(p => p.id === pid)?.name ?? '';
      toast.success(`Nilai "${name}" tersimpan & ranking otomatis diperbarui`, {
        icon: <CheckCircle2 size={14} className="text-green-600" />
      });

      // Automatically refresh participants to update ranks in real-time
      await loadParticipants(token, selectedPhase);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Gagal menyimpan nilai');
    } finally {
      setSavingId(null);
    }
  };

  const handleLogout = () => { 
    sessionStorage.removeItem('jury_session');
    setState('login'); 
    setToken(''); 
    setCompetition(null); 
    setParticipants([]); 
    setScores({}); 
    setSavedIds(new Set()); 
  };

  const getRankEmoji = (r: number | undefined) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null;

  // ── Login screen ─────────────────────────────────────────────────────────

  if (state === 'login') return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Award className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Panel Juri</h1>
          <p className="text-slate-500 text-sm mt-1">LP Ma'arif NU PCNU Cilacap 2026</p>
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
                <p className="text-[10px] text-slate-400">ID diberikan oleh panitia atau terisi otomatis lewat QR</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500">Nama Dewan Juri</Label>
                <Input
                  required
                  type="text"
                  value={juryName}
                  onChange={e => setJuryName(e.target.value)}
                  placeholder="Ketik Nama Lengkap Anda (cth: Drs. H. Ahmad Subhan, M.Pd)..."
                  className="h-11"
                />
                <p className="text-[10px] text-slate-400">Identitas juri untuk lembar penilaian Anda</p>

                {/* Quick-Pick for Existing Juries */}
                {existingJuries.length > 0 && (
                  <div className="pt-2 space-y-1.5 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/80">
                    <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                      <UserCheck size={13} className="text-emerald-600" />
                      Pilih nama Anda jika sudah pernah menilai di lomba ini:
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {existingJuries.map((name, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setJuryName(name)}
                          className={`px-2.5 py-1 text-xs rounded-full border transition-all cursor-pointer ${
                            juryName === name
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-bold'
                              : 'bg-white hover:bg-emerald-100 text-slate-700 border-slate-200 hover:border-emerald-300'
                          }`}
                        >
                          👤 {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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

              <Button type="submit" className="w-full h-11 bg-green-600 hover:bg-green-700 font-bold cursor-pointer" disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin mr-2"/> : null} Masuk Panel Juri
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-2 text-center text-xs text-slate-400">
          <p>Hubungi panitia untuk mendapatkan ID Lomba dan PIN Juri</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 bg-white/90 hover:bg-white px-3 py-1.5 rounded-full border border-emerald-200 transition-all cursor-pointer shadow-2xs"
            title="Muat ulang halaman untuk mengambil versi terbaru"
          >
            <RefreshCw size={12} />
            <span>Segarkan Tampilan (Jika Ada Perubahan)</span>
          </button>
        </div>
      </div>
    </div>
  );

  // ── Scoring panel ─────────────────────────────────────────────────────────

  const scoredCount = savedIds.size;
  const phase1Max = competition?.phase1_max_score ?? (competition?.lomba_type === 'guru_berprestasi' ? 70 : 85);
  const phase2Max = competition?.phase2_max_score ?? (competition?.lomba_type === 'guru_berprestasi' ? 30 : 15);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-emerald-600 text-white px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-bold opacity-80 uppercase tracking-wider">Panel Juri — LP Ma'arif NU</span>
              {juryName && (
                <span className="inline-flex items-center gap-1 bg-black/25 backdrop-blur-xs px-2 py-0.5 rounded-full text-[11px] font-medium text-emerald-200 border border-white/20">
                  <UserCheck size={11} className="text-emerald-300" />
                  <span>{juryName}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg truncate">{competition?.name}</h1>
              {isLocked && (
                <Badge className="bg-amber-400 text-amber-950 font-black text-[10px] uppercase gap-1 hover:bg-amber-400 flex-shrink-0">
                  <Lock size={10} /> Terkunci (Final)
                </Badge>
              )}
            </div>
            <p className="text-xs opacity-80">{competition?.event} {competition?.jenjang ? `· ${competition.jenjang}` : ''}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className="bg-white/20 text-white border-white/30 text-xs">
              {scoredCount}/{participants.length} dinilai
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/25 text-xs font-semibold gap-1.5 cursor-pointer"
              onClick={() => {
                loadParticipants(token, selectedPhase);
                toast.info('Data dan ranking diperbarui', { duration: 1500 });
              }}
              disabled={loading}
              title="Perbarui daftar dan peringkat peserta"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Perbarui</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 gap-1 cursor-pointer" onClick={handleLogout}>
              <LogOut size={13}/> Keluar
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Banner Penilaian Terkunci */}
        {isLocked && (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 text-amber-950 rounded-2xl flex items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 bg-amber-200/80 rounded-xl text-amber-900 mt-0.5 sm:mt-0 flex-shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-amber-950 flex items-center gap-2">
                  Penilaian Telah Dikunci & Final
                </h4>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Penginputan dan perubahan nilai untuk cabang lomba ini telah ditutup oleh panitia. Anda berada dalam mode <strong>Hanya-Baca (Read-Only)</strong>.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-amber-200 text-amber-900 border border-amber-300 flex-shrink-0">
              🔒 Final / Read-Only
            </span>
          </div>
        )}

        {/* Banner Kunci Nilai Terisi */}
        {!isLocked && isFreezeSubmitted && (
          <div className="p-4 bg-blue-50 border-2 border-blue-200 text-blue-950 rounded-2xl flex items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 bg-blue-200/80 rounded-xl text-blue-900 mt-0.5 sm:mt-0 flex-shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-blue-950 flex items-center gap-2">
                  Mode Kunci Nilai Terisi (Immutability)
                </h4>
                <p className="text-xs text-blue-800 mt-0.5 leading-relaxed">
                  Nilai untuk peserta yang <strong>sudah Anda simpan</strong> telah dikunci permanen. Anda masih dapat menilai <strong>peserta yang belum dinilai</strong> hingga selesai.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-blue-200 text-blue-900 border border-blue-300 flex-shrink-0">
              🔒 Terkunci Saat Disimpan
            </span>
          </div>
        )}

        {/* Banner Penilaian Fase 1 Terkunci Permanen */}
        {!isLocked && isPhase1Locked && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-300 text-emerald-950 rounded-2xl flex items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 bg-emerald-200/80 rounded-xl text-emerald-900 mt-0.5 sm:mt-0 flex-shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-emerald-950 flex items-center gap-2">
                  Tahap 1 (Seleksi Berkas) Telah Selesai & Terkunci
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                  Tahap seleksi berkas resmi ditutup karena 3 besar finalis telah ditetapkan untuk melaju ke <strong>Fase 2 (Wawancara & Visitasi)</strong>. Nilai berkas berada dalam mode <strong>Hanya-Baca (Read-Only)</strong> dan tidak dapat diubah lagi.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-200 text-emerald-900 border border-emerald-300 flex-shrink-0">
              🔒 Berkas Terkunci
            </span>
          </div>
        )}

        {/* Phase Tabs for Anugerah Competitions */}
        {isTwoPhase && (
          <div className="bg-white p-2 rounded-2xl shadow-sm border flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePhaseChange(1)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                selectedPhase === 1
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <FileText size={15} />
              <span>Fase 1: Seleksi Berkas {competition?.is_phase1_locked || competition?.has_finalists ? '🔒 (Terkunci)' : '(Semua Peserta)'}</span>
            </button>
            <button
              type="button"
              onClick={() => handlePhaseChange(2)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                selectedPhase === 2
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Sparkles size={15} />
              <span>Fase 2: Wawancara & Visitasi (3 Besar Finalis)</span>
            </button>
          </div>
        )}

        {/* Active Criteria reference */}
        {activeCriteria.length > 0 && (
          <div className={`p-3.5 border rounded-xl text-xs ${
            isTwoPhase && selectedPhase === 2 
              ? 'bg-purple-50 border-purple-200 text-purple-900' 
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <p className="font-bold flex items-center gap-1.5 mb-2">
              <Info size={13}/>
              {isTwoPhase 
                ? (selectedPhase === 1 ? 'Kriteria Penilaian Fase 1 (Seleksi Berkas)' : 'Kriteria Penilaian Fase 2 (Wawancara & Visitasi)')
                : 'Kriteria Penilaian (Juknis)'}
            </p>
            <div className="flex flex-wrap gap-2">
              {activeCriteria.map((c, i) => (
                <span key={i} className="bg-white border border-slate-200/80 rounded-lg px-2.5 py-1 font-medium shadow-2xs">
                  {c.component} <strong>({c.weight}%)</strong>
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] opacity-85">
              {isTwoPhase 
                ? (selectedPhase === 1 
                    ? `Hanya komponen berkas Fase 1 yang dinilai (Bobot maksimal: ${phase1Max}%).` 
                    : `Hanya komponen wawancara Fase 2 yang dinilai (Bobot maksimal: ${phase2Max}%). Nilai berkas Fase 1 terakumulasi otomatis.`)
                : 'Skor akhir dihitung otomatis dari rata-rata tertimbang di atas.'}
            </p>
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
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 p-8 space-y-2">
            <Award className="w-10 h-10 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600">
              {isTwoPhase && selectedPhase === 2
                ? 'Belum ada Finalis 3 Besar yang ditetapkan oleh Panitia/Admin.'
                : `Belum ada peserta ${filterJenjang !== 'all' ? `untuk jenjang ${filterJenjang}` : ''}.`}
            </p>
            {isTwoPhase && selectedPhase === 2 && (
              <p className="text-xs text-slate-400">
                Setelah seleksi berkas Fase 1 selesai, panitia akan menetapkan 3 besar per jenjang untuk masuk ke Fase 2.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {participants.filter(p => filterJenjang === 'all' || p.jenjang === filterJenjang).map((p, idx) => {
              const s = scores[p.id] ?? { rank: '', score: '', notes: '', breakdown: {} };
              const isSaving = savingId === p.id;
              const isSaved = savedIds.has(p.id);
              const alreadyScored = p.result?.is_scored_by_me;
              const isParticipantLocked = isLocked || isPhase1Locked || (isFreezeSubmitted && (alreadyScored || isSaved));
              const activeSubtotal = calcActiveSubtotal(p.id);
              const rankNum = s.rank ? Number(s.rank) : undefined;
              const p1Saved = Number(p.result?.phase1_effective_score ?? p.result?.phase1_avg_score ?? p.result?.phase1_score ?? 0);
              const totalCombined = isTwoPhase && selectedPhase === 2 ? Number((p1Saved + activeSubtotal).toFixed(2)) : activeSubtotal;

              return (
                <Card key={p.id} className={`border-0 shadow-sm rounded-2xl transition-all ${
                  isSaved ? 'ring-2 ring-green-400' : alreadyScored ? 'ring-1 ring-blue-200' : ''
                }`}>
                  <CardHeader className="pb-2 pt-4 px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-500">#{idx + 1}</span>
                          {rankNum && <span className="text-lg">{getRankEmoji(rankNum)}</span>}
                          <h3 className="font-bold text-slate-800 text-lg">
                            {p.name}
                          </h3>
                          {p.is_finalis && (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] font-bold">
                              ✨ Finalis Fase 2
                            </Badge>
                          )}
                          {p.gender_category && <Badge variant="outline" className="text-[9px] uppercase">{p.gender_category}</Badge>}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {p.institution} {p.jenjang && <span className="text-[10px] ml-1 bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-slate-600">{p.jenjang}</span>}
                        </p>

                        {/* Berkas & Dokumen Google Drive */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100">
                          {p.video_url && (
                            <div className="mb-2">
                              <a
                                href={p.video_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg border border-blue-200 transition-colors shadow-xs"
                              >
                                <Video size={13} className="text-blue-600" />
                                <span>🎬 Tonton Video Kiriman</span>
                                <ExternalLink size={11} className="opacity-60" />
                              </a>
                            </div>
                          )}

                          {p.documents && Object.keys(p.documents).length > 0 ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                                <FolderOpen size={13} className="text-emerald-600" />
                                <span>Berkas / Link Google Drive Peserta ({Object.keys(p.documents).length}):</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(p.documents).map(([name, url]) => (
                                  <a
                                    key={name}
                                    href={url as string}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-medium rounded-lg border border-slate-200 hover:border-emerald-300 transition-all shadow-xs group"
                                  >
                                    <FileText size={12} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                                    <span>{name}</span>
                                    <ExternalLink size={10} className="text-slate-400 group-hover:text-emerald-600" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          ) : !p.video_url ? (
                            <div className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-md">
                              <AlertCircle size={12} className="text-amber-500 flex-shrink-0" />
                              <span>Belum ada tautan berkas / Google Drive yang dilampirkan</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          {isSaved || p.result?.is_scored_by_me ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-semibold flex items-center gap-1">
                              <CheckCircle2 size={11} className="text-emerald-600" /> Nilai Anda Tersimpan
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[10px]">
                              Belum Anda Nilai
                            </Badge>
                          )}
                        </div>
                        {p.result?.juries_count > 0 && (
                          <span
                            className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md cursor-help border border-slate-200/60"
                            title={p.result.all_jury_scores?.map((j: any) => `${j.jury_name}: ${j.score}`).join(' | ')}
                          >
                            👥 {p.result.juries_count} juri menilai (Rata-rata: <strong>{p.result.final_score}</strong>)
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-4 space-y-3">
                    {/* In Phase 2: Show read-only summary card of Phase 1 score */}
                    {isTwoPhase && selectedPhase === 2 && (
                      <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600" />
                          <div>
                            <span className="font-bold text-emerald-950 block">Skor Seleksi Berkas (Fase 1)</span>
                            <span className="text-[11px] text-emerald-700">Skor portofolio & seleksi berkas resmi Fase 1</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black text-emerald-800">
                            {p1Saved.toFixed(2)}
                          </span>
                          <span className="text-xs text-emerald-600 font-semibold"> / {phase1Max}</span>
                        </div>
                      </div>
                    )}

                    {/* Breakdown scores for active criteria ONLY */}
                    {activeCriteria.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
                          <span>
                            {isTwoPhase 
                              ? (selectedPhase === 1 ? 'Kriteria Berkas (Fase 1)' : 'Kriteria Wawancara / Visitasi (Fase 2)') 
                              : 'Kriteria Penilaian'}
                          </span>
                          <span className="text-[11px] text-emerald-700 lowercase font-medium">skor 0 – 100</span>
                        </div>
                        <div className={`grid ${activeCriteria.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2.5`}>
                          {activeCriteria.map(c => (
                            <div key={c.component} className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                              <Label className="text-[11px] font-semibold text-slate-700 block leading-tight">
                                {c.component} <span className="text-emerald-600 font-bold">({c.weight}%)</span>
                              </Label>
                              <Input
                                type="number" min="0" max="100" step="0.5"
                                value={s.breakdown?.[c.component] ?? ''}
                                onChange={e => setBreakdown(p.id, c.component, e.target.value)}
                                placeholder="0–100"
                                disabled={isParticipantLocked}
                                className={`h-9 text-sm font-bold disabled:opacity-100 disabled:text-slate-900 ${isParticipantLocked ? 'bg-slate-100/90 text-slate-900 cursor-not-allowed' : 'bg-white'}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Real-time Subtotal / Total Calculation Pill */}
                    {isTwoPhase && selectedPhase === 2 ? (
                      <div className="p-3 bg-purple-50/90 border border-purple-200 rounded-xl flex items-center justify-between text-xs shadow-2xs">
                        <div>
                          <span className="font-bold text-purple-950 block">Akumulasi Nilai Akhir (Fase 1 + Fase 2)</span>
                          <span className="text-[11px] text-purple-700">
                            Berkas ({p1Saved.toFixed(1)}) + Wawancara ({activeSubtotal.toFixed(1)})
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-purple-800">{totalCombined.toFixed(2)}</span>
                          <span className="text-xs text-purple-600 font-semibold"> / 100</span>
                        </div>
                      </div>
                    ) : isTwoPhase && selectedPhase === 1 ? (
                      <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-950">Subtotal Nilai Berkas (Fase 1)</span>
                        <div className="text-right">
                          <span className="text-base font-black text-emerald-800">{activeSubtotal.toFixed(2)}</span>
                          <span className="text-xs text-emerald-600 font-semibold"> / {phase1Max}</span>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-slate-500">
                          {isTwoPhase ? (selectedPhase === 1 ? 'Skor Berkas (Fase 1)' : 'Total Akhir (Fase 1+2)') : (activeCriteria.length > 0 ? 'Skor Akhir (auto)' : 'Skor / Nilai')}
                        </Label>
                        <Input
                          type="number" min="0" max="100" step="0.01"
                          value={isTwoPhase ? (selectedPhase === 2 ? totalCombined : activeSubtotal) : (activeCriteria.length > 0 ? activeSubtotal.toFixed(2) : s.score)}
                          onChange={e => { if (activeCriteria.length === 0 && !isParticipantLocked) setScore(p.id, 'score', e.target.value); }}
                          readOnly={activeCriteria.length > 0 || isParticipantLocked}
                          disabled={isParticipantLocked}
                          placeholder="—"
                          className="h-8 text-sm font-bold bg-slate-100 text-slate-900 disabled:opacity-100 disabled:text-slate-900"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-slate-500">Juara (Otomatis)</Label>
                        <Select value={s.rank} onValueChange={v => setScore(p.id, 'rank', v)} disabled={isParticipantLocked}>
                          <SelectTrigger className="h-8 text-sm font-semibold disabled:opacity-100 disabled:text-slate-900 disabled:bg-slate-100/90" disabled={isParticipantLocked}><SelectValue placeholder="—"/></SelectTrigger>
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
                        <Input value={s.notes} onChange={e => setScore(p.id, 'notes', e.target.value)} placeholder="Catatan juri..." disabled={isParticipantLocked} className="h-8 text-sm disabled:opacity-100 disabled:text-slate-800 disabled:bg-slate-100/90 disabled:cursor-not-allowed" />
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className={`w-full gap-1.5 font-bold ${
                        isParticipantLocked
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed hover:bg-slate-100'
                          : isTwoPhase && selectedPhase === 2
                          ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                          : isSaved ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' : 'cursor-pointer'
                      }`}
                      onClick={() => handleSave(p.id)}
                      disabled={isSaving || isParticipantLocked}
                    >
                      {isParticipantLocked ? (
                        <>
                          <Lock size={13} />
                          <span>{isPhase1Locked ? 'Fase 1 Selesai & Terkunci (Read-Only)' : 'Nilai Tersimpan (Terkunci)'}</span>
                        </>
                      ) : isSaving ? (
                        <Loader2 size={13} className="animate-spin"/>
                      ) : isSaved ? (
                        <CheckCircle2 size={13}/>
                      ) : (
                        <Save size={13}/>
                      )}
                      {!isParticipantLocked && (
                        isTwoPhase 
                          ? (selectedPhase === 1 
                              ? (isSaved ? 'Tersimpan — Perbarui Nilai Berkas' : 'Simpan Nilai Berkas (Fase 1)') 
                              : (isSaved ? 'Tersimpan — Perbarui Nilai Wawancara' : 'Simpan Nilai Wawancara (Fase 2)'))
                          : (isSaved ? 'Tersimpan — Update Nilai' : 'Simpan Nilai')
                      )}
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
