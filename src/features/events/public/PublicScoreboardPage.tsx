import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const api = {
  scoreboard: (eventId: string, competitionId: string) =>
    axios.get(`${API_URL}/public/events/${eventId}/scoreboard/${competitionId}`)
      .then(r => r.data?.data ?? r.data),
};

const RANK_STYLES: Record<number, { bg: string; text: string; emoji: string; ring: string }> = {
  1: { bg: 'bg-amber-50',   text: 'text-amber-700',  emoji: '🥇', ring: 'ring-2 ring-amber-300' },
  2: { bg: 'bg-slate-50',   text: 'text-slate-600',  emoji: '🥈', ring: 'ring-1 ring-slate-200' },
  3: { bg: 'bg-orange-50',  text: 'text-orange-700', emoji: '🥉', ring: 'ring-1 ring-orange-200' },
};

export default function PublicScoreboardPage() {
  const { eventId, competitionId } = useParams<{ eventId: string; competitionId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async () => {
    if (!eventId || !competitionId) return;
    setLoading(true);
    try {
      const res = await api.scoreboard(eventId, competitionId);
      setData(res);
      setLastUpdated(new Date());
    } catch {
      toast.error('Gagal memuat papan skor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Auto-refresh every 30 seconds
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [eventId, competitionId]);

  const results: any[] = data?.results ?? [];
  const winners = results.filter(r => r.rank <= 3).sort((a, b) => a.rank - b.rank);
  const others  = results.filter(r => r.rank > 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-emerald-800 text-white">
      {/* Header */}
      <div className="text-center py-10 px-4 space-y-3">
        <div className="flex items-center justify-center gap-2 opacity-70 text-sm mb-4">
          <img src="/logo-maarif.png" alt="" className="h-8 w-8 object-contain" onError={e => (e.currentTarget.style.display='none')} />
          <span className="font-bold uppercase tracking-widest text-xs">LP Ma'arif NU Cilacap</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight drop-shadow-lg">
          🏆 Papan Skor
        </h1>
        {data && (
          <>
            <p className="text-xl font-bold opacity-90">{data.competition}</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Badge className="bg-white/20 text-white border-white/30 text-xs">{data.event}</Badge>
              {data.jenjang && <Badge className="bg-white/20 text-white border-white/30 text-xs">{data.jenjang}</Badge>}
            </div>
          </>
        )}
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 gap-1.5"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          {lastUpdated && (
            <span className="text-xs text-white/50">
              Update: {lastUpdated.toLocaleTimeString('id-ID', { timeStyle: 'short' })}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-16 space-y-6">
        {loading && !data ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin w-10 h-10 text-white/60" />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-20 text-white/50 space-y-3">
            <Trophy size={48} className="mx-auto opacity-30" />
            <p className="font-medium">Penilaian sedang berlangsung...</p>
            <p className="text-sm">Halaman ini akan diperbarui otomatis setiap 30 detik.</p>
          </div>
        ) : (
          <>
            {/* Winners podium */}
            {winners.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-white/60 text-center">Pemenang</p>
                {winners.map(r => {
                  const style = RANK_STYLES[r.rank] ?? {};
                  return (
                    <div
                      key={r.rank}
                      className={`${style.bg} ${style.ring} rounded-2xl p-5 flex items-center gap-4 shadow-xl shadow-black/20`}
                    >
                      <div className="text-4xl">{style.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-black text-lg ${style.text} leading-tight`}>{r.name}</p>
                        <p className="text-slate-500 text-sm truncate">{r.institution}</p>
                        {r.notes && <p className="text-slate-400 text-xs mt-0.5 italic">"{r.notes}"</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-2xl font-black ${style.text}`}>
                          {r.score != null ? Number(r.score).toFixed(1) : '—'}
                        </p>
                        <p className="text-xs text-slate-400">Skor</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Others (harapan etc.) */}
            {others.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-white/60 text-center">Peserta Lainnya</p>
                {others.map(r => (
                  <div key={r.rank} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {r.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">{r.name}</p>
                      <p className="text-white/60 text-xs truncate">{r.institution}</p>
                    </div>
                    {r.score != null && (
                      <p className="text-white font-bold flex-shrink-0">{Number(r.score).toFixed(1)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-white/40 pt-6 border-t border-white/10 space-y-1">
          <p>LP Ma'arif NU PCNU Cilacap</p>
          <p>Merawat Jagad Membangun Peradaban</p>
          <p className="font-mono">simmaci.com</p>
        </div>
      </div>
    </div>
  );
}
