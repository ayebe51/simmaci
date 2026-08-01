import React, { useEffect, useState } from 'react';
import { eventApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

export default function MedalTally({ eventId }: { eventId: number }) {
  const [tally, setTally] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await eventApi.tally(eventId);
      setTally(Array.isArray(data) ? data : []);
    } catch {
      setTally([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [eventId]);

  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
        <CardTitle className="text-base font-bold">Klasemen Perolehan Medali</CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : tally.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">Belum ada data perolehan medali.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="h-10 px-4 text-left text-xs font-bold text-slate-500 uppercase">No</th>
                <th className="h-10 px-4 text-left text-xs font-bold text-slate-500 uppercase">Lembaga</th>
                <th className="h-10 px-4 text-center text-xs font-bold text-amber-600 uppercase">🥇 Emas</th>
                <th className="h-10 px-4 text-center text-xs font-bold text-slate-500 uppercase">🥈 Perak</th>
                <th className="h-10 px-4 text-center text-xs font-bold text-orange-600 uppercase">🥉 Perunggu</th>
                <th className="h-10 px-4 text-center text-xs font-bold text-emerald-700 uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {tally.map((item, i) => (
                <tr key={i} className={`border-b last:border-0 ${i === 0 ? 'bg-amber-50/50' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-4 py-3 font-bold text-slate-500 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{item.institution}</td>
                  <td className="px-4 py-3 text-center font-black text-amber-600">{item.gold}</td>
                  <td className="px-4 py-3 text-center font-black text-slate-500">{item.silver}</td>
                  <td className="px-4 py-3 text-center font-black text-orange-500">{item.bronze}</td>
                  <td className="px-4 py-3 text-center font-black text-emerald-700">{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
