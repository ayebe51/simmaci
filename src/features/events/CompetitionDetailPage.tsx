
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ExcelImportModal from "../master-data/components/ExcelImportModal";
import { ArrowLeft, Loader2, Download } from 'lucide-react';
import ParticipantList from './components/ParticipantList';
import ResultInput from './components/ResultInput';

import { API_URL } from '@/lib/api';

export default function CompetitionDetailPage() {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const [competition, setCompetition] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (competitionId) {
      setLoading(true);
      setError(null);
      fetch(`${API_URL}/events/competitions/${competitionId}`)
        .then(async (res) => {
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Error ${res.status}: ${text}`);
            }
            return res.json();
        })
        .then((data) => setCompetition(data))
        .catch((err) => {
            console.error(err);
            setError(err.message);
        })
        .finally(() => setLoading(false));
    }
  }, [competitionId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (error) {
      return (
          <div className="p-8 text-center">
              <h3 className="text-lg font-semibold text-red-600">Terjadi Kesalahan</h3>
              <p className="text-gray-500">{error}</p>
              <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
                <ArrowLeft size={16} className="mr-2" /> Kembali
              </Button>
          </div>
      )
  }

  if (!competition) {
    return <div className="p-8">Kompetisi tidak ditemukan.</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <Button variant="outline" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft size={16} className="mr-2" /> Kembali
      </Button>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl">{competition.name}</CardTitle>
              <p className="text-gray-500 mt-2">
                {competition.event?.name} | {competition.category} | {competition.type}
              </p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>
                {competition.date && !isNaN(new Date(competition.date).getTime()) 
                  ? new Date(competition.date).toLocaleDateString('id-ID', { dateStyle: 'full' }) 
                  : '-'}
              </p>
              <p>{competition.location || '-'}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="participants">
        <TabsList>
          <TabsTrigger value="participants">Peserta ({competition.participants?.length || 0})</TabsTrigger>
          <TabsTrigger value="results">Hasil / Nilai</TabsTrigger>
          <TabsTrigger value="certificates">Sertifikat</TabsTrigger>
        </TabsList>

        <TabsContent value="participants">
          <ParticipantList competitionId={competition.id} participants={competition.participants || []} />
        </TabsContent>

        <TabsContent value="results" className="pt-4">
             <div className="flex justify-end mb-4">
                <ExcelImportModal 
                    title="Import Hasil Kompetisi"
                    description="Upload file Excel (.xlsx). Format: Juara, Nama, Lembaga, Nilai."
                    triggerLabel="Import Hasil (Excel)"
                    onFileImport={async (file) => {
                        if(!competitionId) return;
                        await api.importCompetitionResults(competitionId, file)
                        window.location.reload()
                    }}
                />
            </div>
            <ResultInput competitionId={competitionId!} />
        </TabsContent>

        <TabsContent value="certificates">
          <Card>
            <CardContent className="p-6">
                <div className="mb-6 p-4 border rounded bg-gray-50">
                    <h4 className="font-semibold mb-2">Template Sertifikat Custom</h4>
                    <p className="text-sm text-gray-500 mb-2">Upload gambar (JPG/PNG) untuk dijadikan background sertifikat.</p>
                    <div className="flex items-center gap-2">
                        <Input 
                            type="file" 
                            accept="image/*"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                
                                const formData = new FormData();
                                formData.append('file', file);
                                
                                try {
                                    setLoading(true);
                                    const res = await fetch(`${API_URL}/events/competitions/${competition.id}/template`, {
                                        method: 'POST',
                                        body: formData,
                                    });
                                    if (res.ok) {
                                        alert('Template berhasil diupload!');
                                        // Refresh competition data
                                        const updated = await res.json();
                                        setCompetition(updated); 
                                    } else {
                                        alert('Gagal upload template');
                                    }
                                } catch (err) {
                                    console.error(err);
                                    alert('Terjadi kesalahan saat upload');
                                } finally {
                                    setLoading(false);
                                }
                            }}
                        />
                    </div>
                    {competition.certificateTemplate && (
                        <p className="text-xs text-green-600 mt-2">✓ Template custom aktif</p>
                    )}
                </div>

              <h3 className="text-lg font-semibold mb-4">Download Sertifikat</h3>
              <div className="grid gap-2">
                {competition.participants?.length === 0 && <p className="text-gray-500">Belum ada peserta.</p>}
                {competition.participants?.map((p: any) => {
                  const result = competition.results?.find((r: any) => r.participantId === p.id || r.participant?.id === p.id);
                  return (
                    <div key={p.id} className="flex justify-between items-center p-3 border rounded hover:bg-gray-50">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.institution}</div>
                        {result && (
                            <div className="text-xs text-blue-600 mt-1 font-medium">
                                {result.rank ? `Juara ${result.rank}` : 'Peserta'} 
                                {result.score ? ` (Nilai: ${result.score})` : ''}
                            </div>
                        )}
                      </div>
                      <a
                        href={`${API_URL}/events/competitions/${competition.id}/certificates/${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <Download size={14} className="mr-2" /> Download
                        </Button>
                      </a>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
