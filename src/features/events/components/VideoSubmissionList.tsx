import { useState } from 'react';
import { eventApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExternalLink, Save, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

const FILENAME_FORMAT: Record<string, string> = {
  mars_maarif:      'MARS_[JENJANG]_[NAMA MADRASAH]',
  mtq:              'MTQ_[JENJANG]_[NAMA PESERTA]_[NAMA MADRASAH]',
  puji_pujian:      'PUJI_[NAMA GRUP]_[NAMA MI]',
  film_dokumenter:  'DOKUMENTER_[JENJANG]_[JUDUL FILM]_[NAMA MADRASAH]',
};

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-slate-100 text-slate-600',
  submitted: 'bg-blue-100 text-blue-700',
  reviewed:  'bg-green-100 text-green-700',
};

interface Props {
  participants: any[];
  competitionId: number;
  lombaType: string;
  onRefresh: () => void;
}

export default function VideoSubmissionList({ participants, competitionId, lombaType, onRefresh }: Props) {
  const [saving, setSaving] = useState<number | null>(null);
  const [videoInputs, setVideoInputs] = useState<Record<number, { url: string; filename: string }>>({});

  const getInput = (id: number) => videoInputs[id] ?? { url: participants.find(p => p.id === id)?.video_url ?? '', filename: participants.find(p => p.id === id)?.video_filename ?? '' };

  const handleSave = async (participantId: number) => {
    const input = getInput(participantId);
    if (!input.url.trim()) { toast.error('URL video wajib diisi'); return; }
    setSaving(participantId);
    try {
      await eventApi.participants.update(participantId, {
        video_url: input.url,
        video_filename: input.filename,
        video_status: 'submitted',
      });
      toast.success('Link video disimpan');
      onRefresh();
    } catch {
      toast.error('Gagal menyimpan link video');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {/* Info box */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1.5">
          <p className="font-bold flex items-center gap-1.5"><Info size={12}/> Format Pengiriman Video (Juknis)</p>
          <p>Upload ke Google Drive, atur akses: <strong>"Siapa saja yang memiliki link dapat melihat"</strong></p>
          <p>Format nama file: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">{FILENAME_FORMAT[lombaType] ?? '—'}</code></p>
          {lombaType === 'film_dokumenter' && (
            <p>⚠️ Khusus Film Dokumenter: wajib lampirkan file Sinopsis (PDF) di folder Google Drive yang dikirim.</p>
          )}
          <p className="font-semibold">Kirim melalui: <a href="https://s.id/Harlah97MaarifCilacap" target="_blank" rel="noreferrer" className="underline">s.id/Harlah97MaarifCilacap</a></p>
        </div>

        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Peserta / Grup</TableHead>
                <TableHead>Lembaga</TableHead>
                <TableHead className="min-w-[280px]">Link Google Drive</TableHead>
                <TableHead className="min-w-[220px]">Nama File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                    Tambahkan peserta terlebih dahulu.
                  </TableCell>
                </TableRow>
              ) : participants.map((p) => {
                const inp = getInput(p.id);
                const isSaving = saving === p.id;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.name}</TableCell>
                    <TableCell className="text-xs text-slate-500">{p.institution}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          value={inp.url}
                          onChange={e => setVideoInputs(prev => ({ ...prev, [p.id]: { ...getInput(p.id), url: e.target.value } }))}
                          placeholder="https://drive.google.com/..."
                          className="h-8 text-xs"
                        />
                        {inp.url && (
                          <a href={inp.url} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <ExternalLink size={12}/>
                            </Button>
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={inp.filename}
                        onChange={e => setVideoInputs(prev => ({ ...prev, [p.id]: { ...getInput(p.id), filename: e.target.value } }))}
                        placeholder={FILENAME_FORMAT[lombaType] ?? ''}
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[9px] font-bold uppercase ${STATUS_COLORS[p.video_status ?? 'pending'] ?? STATUS_COLORS.pending} hover:${STATUS_COLORS[p.video_status ?? 'pending']}`}>
                        {p.video_status ?? 'pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => handleSave(p.id)} disabled={isSaving}>
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
