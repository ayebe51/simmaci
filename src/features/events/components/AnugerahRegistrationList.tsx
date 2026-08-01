import React, { useEffect, useState } from 'react';
import { eventApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, CheckCircle, XCircle, Clock, Loader2, Award } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:        { label: 'Draft',       color: 'bg-slate-100 text-slate-600' },
  submitted:    { label: 'Disubmit',    color: 'bg-blue-100 text-blue-700' },
  under_review: { label: 'Direview',    color: 'bg-amber-100 text-amber-700' },
  finalis:      { label: 'Finalis',     color: 'bg-purple-100 text-purple-700' },
  winner:       { label: 'Pemenang',    color: 'bg-green-100 text-green-700' },
  rejected:     { label: 'Ditolak',     color: 'bg-red-100 text-red-700' },
};

interface Props {
  eventId: number;
  competitions: any[];
}

export default function AnugerahRegistrationList({ eventId, competitions }: Props) {
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await eventApi.anugerah.list({ event_id: eventId, per_page: 100 });
      setRegistrations(res.data ?? res);
    } catch {
      toast.error('Gagal memuat data pendaftaran');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [eventId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      {/* Info box from Juknis */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-sm text-blue-800 space-y-2">
        <p className="font-bold">📋 Anugerah Guru & Madrasah Berprestasi — Harlah LP Ma'arif NU ke-97</p>
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          <div>
            <p className="font-semibold text-blue-700">Syarat Guru Berprestasi:</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-600 mt-1">
              <li>Aktif mengajar minimal 2 tahun berturut-turut</li>
              <li>Memiliki Sertifikat PKPNU / PD-PKPNU</li>
              <li>Esai reflektif maks. 3 halaman (dilarang pakai AI)</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-blue-700">Syarat Madrasah Berprestasi:</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-600 mt-1">
              <li>Terdaftar di SIMMACI / LP Ma'arif NU</li>
              <li>Madrasah telah terakreditasi</li>
              <li>Dokumen PDCA & rekap prestasi siswa</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800">Daftar Pendaftar ({registrations.length})</h3>
        <Button size="sm" onClick={() => navigate(`/dashboard/events/${eventId}/anugerah/daftar`)}>
          <Plus size={14} className="mr-1.5"/> Daftar Baru
        </Button>
      </div>

      {registrations.length === 0 ? (
        <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-2xl">
          <Award size={32} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Belum ada pendaftaran.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {registrations.map((reg: any) => {
            const st = STATUS_MAP[reg.status] ?? STATUS_MAP.draft;
            return (
              <Card key={reg.id} className="border-0 shadow-sm rounded-xl">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{reg.applicant_name}</span>
                      <Badge className={`text-[9px] font-bold uppercase ${st.color} hover:${st.color}`}>{st.label}</Badge>
                      <Badge variant="outline" className="text-[9px] uppercase">{reg.category === 'guru' ? 'Guru' : 'Madrasah'}</Badge>
                      <Badge variant="outline" className="text-[9px] uppercase">{reg.jenjang}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{reg.school_name} {reg.kecamatan ? `• ${reg.kecamatan}` : ''}</p>
                    {reg.total_score !== null && reg.total_score !== undefined && (
                      <p className="text-xs text-emerald-700 font-semibold mt-0.5">Skor: {reg.total_score} poin</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/anugerah-registrations/${reg.id}`)}>
                    <Eye size={14} className="mr-1.5"/> Detail
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
