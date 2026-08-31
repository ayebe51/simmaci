import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Users, BarChart3, FileVideo, QrCode, Copy, Check, Key, Trash2, FolderOpen, ExternalLink, Edit, Save, AlertCircle, Phone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ParticipantList from './components/ParticipantList';
import ResultInput from './components/ResultInput';
import VideoSubmissionList from './components/VideoSubmissionList';
import { eventApi, authApi, apiClient } from '@/lib/api';
import { toast } from 'sonner';

const JUKNIS_CRITERIA: Record<string, { component: string; weight: number }[]> = {
  mars_maarif: [
    { component: 'Teknik Vokal', weight: 35 },
    { component: 'Harmonisasi & Keselarasan', weight: 35 },
    { component: 'Penjiwaan & Ekspresi', weight: 30 },
  ],
  mtq_pa: [
    { component: 'Tajwid', weight: 45 },
    { component: 'Lagu & Irama', weight: 35 },
    { component: 'Adab & Penampilan', weight: 20 },
  ],
  mtq_pi: [
    { component: 'Tajwid', weight: 45 },
    { component: 'Lagu & Irama', weight: 35 },
    { component: 'Adab & Penampilan', weight: 20 },
  ],
  mtq: [
    { component: 'Tajwid', weight: 45 },
    { component: 'Lagu & Irama', weight: 35 },
    { component: 'Adab & Penampilan', weight: 20 },
  ],
  puji_pujian: [
    { component: 'Makhraj & Artikulasi Bahasa Jawa', weight: 35 },
    { component: 'Penjiwaan & Penghayatan', weight: 30 },
    { component: 'Harmonisasi Suara & Irama', weight: 25 },
    { component: 'Adab & Penampilan', weight: 10 },
  ],
  film_dokumenter: [
    { component: 'Kesesuaian Tema & Kedalaman Konten', weight: 35 },
    { component: 'Alur Cerita & Struktur Narasi', weight: 25 },
    { component: 'Sinematografi & Editing', weight: 25 },
    { component: 'Kreativitas & Estetika', weight: 15 },
  ],
  guru_berprestasi: [
    { component: 'Akumulasi Skor Kejuaraan / Prestasi', weight: 40 },
    { component: 'Naskah Praktik Baik / Karya Inovasi', weight: 30 },
    { component: 'Pemahaman & Pengamalan Nilai Aswaja', weight: 15 },
    { component: 'Presentasi, Wawancara, & Deep Interview', weight: 15 },
  ],
  madrasah_berprestasi: [
    { component: 'Akumulasi Skor Kejuaraan Lembaga', weight: 45 },
    { component: 'Tata Kelola Institusi & Penguatan Karakter Aswaja', weight: 25 },
    { component: 'Kemitraan, SIMNU & SIMMACI, & Kontribusi Sosial', weight: 15 },
    { component: 'Presentasi Kepala Madrasah & Visitasi', weight: 15 },
  ],
};

const IS_VIDEO_BASED = ['mars_maarif', 'mtq_pa', 'mtq_pi', 'mtq', 'puji_pujian', 'film_dokumenter'];
const IS_ANUGERAH   = ['guru_berprestasi', 'madrasah_berprestasi'];

export default function CompetitionDetailPage() {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const user = authApi.getStoredUser();
  const isSuperAdmin = ["super_admin", "admin_yayasan", "admin"].includes(user?.role);
  const [competition, setCompetition] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!competitionId) return;
    setLoading(true);
    try {
      const data = await eventApi.competitions.get(Number(competitionId));
      setCompetition(data);
    } catch {
      toast.error('Gagal memuat data lomba');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [competitionId]);

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin w-8 h-8 text-slate-400" /></div>;
  if (!competition) return <div className="p-8 text-center text-slate-500">Lomba tidak ditemukan.</div>;

  const criteria   = JUKNIS_CRITERIA[competition.lomba_type] ?? [];
  const isVideo    = IS_VIDEO_BASED.includes(competition.lomba_type);
  const isAnugerah = IS_ANUGERAH.includes(competition.lomba_type);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
        <ArrowLeft size={14}/> Kembali
      </Button>

      {/* Header */}
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <Badge variant="secondary" className="text-[9px] font-bold uppercase">{competition.category}</Badge>
                {competition.lomba_type && (
                  <Badge className="text-[9px] font-bold uppercase bg-green-100 text-green-800 hover:bg-green-100">
                    {competition.lomba_type.replace(/_/g,' ')}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[9px] uppercase">{competition.type}</Badge>
                {competition.jenjang && (
                  <Badge variant="outline" className="text-[9px] uppercase">{competition.jenjang}</Badge>
                )}
              </div>
              <CardTitle className="text-xl font-black text-slate-900">{competition.name}</CardTitle>
              <p className="text-sm text-slate-500 mt-1">{competition.event?.name}</p>
            </div>
            <div className="text-right text-xs text-slate-500 space-y-1">
              {competition.date && <p>{new Date(competition.date).toLocaleDateString('id-ID',{dateStyle:'full'})}</p>}
              {competition.location && <p>{competition.location}</p>}
              {competition.deadline && (
                <p className="text-amber-600 font-semibold">Batas: {new Date(competition.deadline).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</p>
              )}
            </div>
          </div>

          {/* Juknis criteria panel */}
          {criteria.length > 0 && (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border">
              <p className="text-xs font-bold text-slate-600 uppercase mb-2">Kriteria Penilaian (Juknis)</p>
              <div className="flex flex-wrap gap-2">
                {criteria.map((c, i) => (
                  <span key={i} className="text-xs bg-white border rounded-lg px-2 py-1 text-slate-700">
                    <span className="font-semibold">{c.component}</span>
                    <span className="text-slate-400 ml-1">({c.weight}%)</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue={isAnugerah ? 'pendaftar' : 'participants'}>
        <TabsList>
          {!isAnugerah && <TabsTrigger value="participants" className="gap-1.5"><Users size={13}/>Peserta ({competition.participants?.length ?? 0})</TabsTrigger>}
          {isVideo && <TabsTrigger value="video" className="gap-1.5"><FileVideo size={13}/>Kiriman Video</TabsTrigger>}
          <TabsTrigger value="results" className="gap-1.5"><BarChart3 size={13}/>Hasil / Nilai</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="jury" className="gap-1.5"><Key size={13}/>Akses Juri</TabsTrigger>}
          {isAnugerah && <TabsTrigger value="pendaftar" className="gap-1.5"><Users size={13}/>Pendaftar ({competition.anugerah_registrations?.length ?? 0})</TabsTrigger>}
        </TabsList>

        {!isAnugerah && (
          <TabsContent value="participants" className="pt-4">
            <ParticipantList
              competitionId={competition.id}
              isVideoType={isVideo}
              participants={competition.participants ?? []}
              onRefresh={load}
            />
          </TabsContent>
        )}

        {isVideo && (
          <TabsContent value="video" className="pt-4">
            <VideoSubmissionList
              participants={competition.participants ?? []}
              competitionId={competition.id}
              lombaType={competition.lomba_type}
              onRefresh={load}
            />
          </TabsContent>
        )}

        <TabsContent value="results" className="pt-4">
          <ResultInput
            competitionId={String(competition.id)}
            participants={
              isAnugerah
                ? (competition.anugerah_registrations ?? []).map((r: any) => ({
                    id: 'reg_' + r.id,
                    name: r.applicant_name,
                    institution: r.school_name,
                    jenjang: r.jenjang,
                    result: r.rank ? { rank: r.rank, score: r.total_score, notes: r.reviewer_notes } : null,
                  }))
                : (competition.participants ?? [])
            }
            results={competition.results ?? []}
            criteria={criteria}
          />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="jury" className="pt-4">
            <JuryAccessPanel competition={competition} />
          </TabsContent>
        )}

        {isAnugerah && competition.anugerah_registrations?.length >= 0 && (
          <TabsContent value="pendaftar" className="pt-4">
            <AnnugerahRegistrantList registrations={competition.anugerah_registrations ?? []} onReload={load} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ── JuryAccessPanel ───────────────────────────────────────────────────────────

function JuryAccessPanel({ competition }: { competition: any }) {
  const [pin, setPin] = useState('');
  const [savedPin, setSavedPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const juryUrl      = `${window.location.origin}/juri`;
  const eventSlug    = competition.event?.slug ?? competition.event?.id ?? '';
  const daftarUrl    = `${window.location.origin}/daftar/${eventSlug}`;
  const scoreboardUrl = `${window.location.origin}/papan-skor/${competition.event?.id ?? ''}/${competition.id}`;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // Load existing PIN
  useEffect(() => {
    eventApi.juryPin.get(competition.id)
      .then((res: any) => {
        const val = res?.pin ?? '';
        setSavedPin(val);
        setPin(val);
      })
      .catch(() => { /* not set yet */ })
      .finally(() => setLoading(false));
  }, [competition.id]);

  const handleSavePin = async () => {
    if (!pin.trim()) { toast.error('PIN tidak boleh kosong'); return; }
    setSaving(true);
    try {
      await eventApi.juryPin.set(competition.id, pin);
      setSavedPin(pin);
      toast.success('PIN Juri berhasil disimpan (berlaku untuk semua lomba di event ini)');
    } catch {
      toast.error('Gagal menyimpan PIN');
    } finally {
      setSaving(false);
    }
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 flex-shrink-0"
      onClick={() => copy(text, id)}
    >
      {copied === id ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
      {copied === id ? 'Disalin' : 'Salin'}
    </Button>
  );

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      {/* PIN Management */}
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-bold uppercase text-slate-700 flex items-center gap-2">
            <Key size={14} /> PIN Dewan Juri
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            PIN ini diberikan kepada Dewan Juri untuk mengakses panel penilaian.
            Juri tidak perlu memiliki akun SIMMACI — cukup buka link juri dan masukkan PIN. 
            <br/><span className="text-amber-600 font-semibold">Catatan: PIN ini berlaku untuk semua cabang lomba pada Event ini.</span>
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-500">
                PIN Dewan Juri (Global Event)
              </Label>
              <Input
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Contoh: maarif2026"
                className="h-9 font-mono"
              />
            </div>
            <Button onClick={handleSavePin} disabled={saving} size="sm" className="h-9 gap-1.5">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Simpan PIN
            </Button>
          </div>
          {savedPin && (
            <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
              <Check size={12} className="flex-shrink-0" />
              PIN aktif: <strong className="font-mono ml-1">{savedPin}</strong>
              <span className="text-green-600 ml-1">· ID Lomba: <strong>{competition.id}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Links */}
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-bold uppercase text-slate-700 flex items-center gap-2">
            <QrCode size={14} /> Link Publik
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {/* Jury link */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase text-slate-500">🏛️ Link Panel Juri</Label>
            <div className="flex gap-2 items-center">
              <code className="flex-1 text-xs bg-slate-100 rounded-lg px-3 py-2 text-slate-700 truncate border">
                {juryUrl}
              </code>
              <CopyButton text={juryUrl} id="jury" />
            </div>
            <p className="text-[10px] text-slate-400">
              Bagikan ke Dewan Juri bersama ID Lomba (<strong>{competition.id}</strong>) dan PIN yang sudah diset di atas.
            </p>
          </div>

          {/* Registration link */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase text-slate-500">📝 Link Pendaftaran Publik</Label>
            <div className="flex gap-2 items-center">
              <code className="flex-1 text-xs bg-slate-100 rounded-lg px-3 py-2 text-slate-700 truncate border">
                {daftarUrl}
              </code>
              <CopyButton text={daftarUrl} id="daftar" />
            </div>
            <p className="text-[10px] text-slate-400">
              Link untuk sekolah/guru mendaftar lomba — tidak perlu login SIMMACI.
            </p>
          </div>

          {/* Scoreboard link */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase text-slate-500">🏆 Link Papan Skor Publik</Label>
            <div className="flex gap-2 items-center">
              <code className="flex-1 text-xs bg-slate-100 rounded-lg px-3 py-2 text-slate-700 truncate border">
                {scoreboardUrl}
              </code>
              <CopyButton text={scoreboardUrl} id="scoreboard" />
            </div>
            <p className="text-[10px] text-slate-400">
              Tampilkan hasil juara secara publik setelah penilaian selesai.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Briefing for panitia */}
      <Card className="border border-amber-200 bg-amber-50/60 rounded-2xl shadow-none">
        <CardContent className="p-4 text-xs text-amber-800 space-y-2">
          <p className="font-bold">📋 Panduan Distribusi ke Dewan Juri</p>
          <ol className="list-decimal list-inside space-y-1 leading-relaxed">
            <li>Set PIN Juri di atas (satu PIN per cabang lomba)</li>
            <li>Bagikan link panel juri: <strong>{juryUrl}</strong></li>
            <li>Sampaikan ke juri: <strong>ID Lomba = {competition.id}</strong> dan PIN yang sudah diset</li>
            <li>Juri buka link, masukkan ID + PIN → langsung bisa menilai</li>
            <li>Nilai langsung tersimpan ke database SIMMACI secara real-time</li>
            <li>Setelah selesai, hasil dapat dilihat di tab <em>Hasil / Nilai</em> dan papan skor publik</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

// ── AnnugerahRegistrantList ───────────────────────────────────────────────────

function countAttachedDocs(reg: any): number {
  const fields = [
    reg.surat_keterangan_aktif_url,
    reg.sertifikat_pkpnu_url,
    reg.surat_rekomendasi_url,
    reg.surat_keterangan_integritas_url,
    reg.bukti_prestasi_url,
    reg.esai_reflektif_url,
    reg.karya_ilmiah_url,
    reg.dokumen_pdca_url,
    reg.portofolio_branding_url,
    reg.rekap_prestasi_url,
    reg.dokumen_admin_url,
  ];
  return fields.filter(Boolean).length;
}

function AnnugerahRegistrantList({ registrations, onReload }: { registrations: any[], onReload: () => void }) {
  const [selectedReg, setSelectedReg] = useState<any | null>(null);
  const [savingDocs, setSavingDocs] = useState(false);
  const [docForm, setDocForm] = useState<Record<string, string>>({});

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    draft:        { label: 'Draft',       color: 'bg-slate-100 text-slate-600' },
    submitted:    { label: 'Disubmit',    color: 'bg-blue-100 text-blue-700' },
    under_review: { label: 'Direview',    color: 'bg-amber-100 text-amber-700' },
    finalis:      { label: 'Finalis',     color: 'bg-purple-100 text-purple-700' },
    winner:       { label: 'Pemenang',    color: 'bg-green-100 text-green-700' },
    rejected:     { label: 'Ditolak',     color: 'bg-red-100 text-red-700' },
  };

  const openEditModal = (reg: any) => {
    setSelectedReg(reg);
    setDocForm({
      contact_phone: reg.contact_phone || '',
      surat_keterangan_aktif_url: reg.surat_keterangan_aktif_url || '',
      sertifikat_pkpnu_url: reg.sertifikat_pkpnu_url || '',
      surat_rekomendasi_url: reg.surat_rekomendasi_url || '',
      surat_keterangan_integritas_url: reg.surat_keterangan_integritas_url || '',
      bukti_prestasi_url: reg.bukti_prestasi_url || '',
      esai_reflektif_url: reg.esai_reflektif_url || '',
      karya_ilmiah_url: reg.karya_ilmiah_url || '',
      dokumen_pdca_url: reg.dokumen_pdca_url || '',
      portofolio_branding_url: reg.portofolio_branding_url || '',
      rekap_prestasi_url: reg.rekap_prestasi_url || '',
      dokumen_admin_url: reg.dokumen_admin_url || '',
    });
  };

  const handleSaveDocs = async () => {
    if (!selectedReg) return;
    setSavingDocs(true);
    try {
      await apiClient.put(`/anugerah-registrations/${selectedReg.id}`, docForm);
      toast.success(`Data & berkas untuk "${selectedReg.applicant_name}" berhasil diperbarui!`);
      setSelectedReg(null);
      onReload();
    } catch (e: any) {
      toast.error('Gagal memperbarui berkas: ' + (e.response?.data?.message || e.message));
    } finally {
      setSavingDocs(false);
    }
  };

  if (registrations.length === 0) return (
    <div className="text-center py-16 text-slate-400 border-2 border-dashed rounded-2xl">
      Belum ada pendaftar.
    </div>
  );

  return (
    <>
      <div className="space-y-2">
        {registrations.map((reg: any, i: number) => {
          const st = STATUS_MAP[reg.status] ?? STATUS_MAP.draft;
          const docCount = countAttachedDocs(reg);
          return (
            <div key={reg.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border shadow-sm group hover:border-emerald-200 transition-colors">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 flex-shrink-0">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 text-sm">{reg.applicant_name}</span>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                  <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase">{reg.jenjang}</span>
                  {docCount > 0 ? (
                    <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <FolderOpen size={10} /> {docCount} Berkas Terlampir
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle size={10} /> Belum Ada Link Berkas
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                  <span>{reg.school_name}{reg.kecamatan ? ` · ${reg.kecamatan}` : ''}</span>
                  {reg.contact_phone && (
                    <a
                      href={`https://wa.me/${reg.contact_phone.replace(/^0/, '62').replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 font-mono font-medium"
                    >
                      <Phone size={11} /> {reg.contact_phone}
                    </a>
                  )}
                </div>
              </div>

              {reg.total_score != null && (
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-emerald-600">{reg.total_score} poin</p>
                  {reg.rank && <p className="text-xs text-slate-400">Juara {reg.rank}</p>}
                </div>
              )}

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 gap-1.5 text-xs text-slate-700 hover:text-emerald-700 hover:border-emerald-300"
                  onClick={() => openEditModal(reg)}
                >
                  <Edit size={13} /> Kelola Link G-Drive
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2"
                  onClick={async () => {
                    if (confirm(`Yakin ingin menghapus peserta ${reg.applicant_name}?`)) {
                      try {
                        await apiClient.delete(`/anugerah-registrations/${reg.id}`);
                        toast.success('Peserta berhasil dihapus');
                        onReload();
                      } catch (e: any) {
                        toast.error('Gagal menghapus: ' + (e.response?.data?.message || e.message));
                      }
                    }
                  }}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Kelola Tautan Berkas / Google Drive */}
      <Dialog open={!!selectedReg} onOpenChange={open => !open && setSelectedReg(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <FolderOpen className="text-emerald-600" size={20} />
              Kelola Data & Tautan Berkas Google Drive Peserta
            </DialogTitle>
            {selectedReg && (
              <p className="text-xs text-slate-500">
                Peserta: <strong className="text-slate-800">{selectedReg.applicant_name}</strong> ({selectedReg.school_name} · {selectedReg.jenjang})
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
              <p className="font-bold mb-0.5">ℹ️ Petunjuk Input Link Google Drive</p>
              <p>Paste link Google Drive untuk masing-masing dokumen di bawah ini. Pastikan link Google Drive diatur ke <em>"Siapa saja yang memiliki link dapat melihat"</em>. Link yang disimpan di sini akan langsung tampil pada Panel Juri.</p>
            </div>

            {/* Kontak Peserta */}
            <div className="p-3 bg-slate-50 border rounded-xl space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Phone size={12} className="text-emerald-600" /> No. HP / WhatsApp Kontak
              </Label>
              <Input
                value={docForm.contact_phone || ''}
                onChange={e => setDocForm(p => ({ ...p, contact_phone: e.target.value }))}
                placeholder="08xxxxxxxxxx"
                className="h-8 text-xs font-mono"
              />
            </div>

            {selectedReg?.category === 'guru' ? (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase text-slate-600">Berkas Guru Berprestasi</p>
                <DocInputRow
                  label="Surat Keterangan Aktif Mengajar"
                  field="surat_keterangan_aktif_url"
                  value={docForm.surat_keterangan_aktif_url || ''}
                  onChange={(f, v) => setDocForm(p => ({ ...p, [f]: v }))}
                />
                <DocInputRow
                  label="Sertifikat PKPNU / PD-PKPNU"
                  field="sertifikat_pkpnu_url"
                  value={docForm.sertifikat_pkpnu_url || ''}
                  onChange={(f, v) => setDocForm(p => ({ ...p, [f]: v }))}
                />
                <DocInputRow
                  label="Surat Rekomendasi Kepala Madrasah"
                  field="surat_rekomendasi_url"
                  value={docForm.surat_rekomendasi_url || ''}
                  onChange={(f, v) => setDocForm(p => ({ ...p, [f]: v }))}
                />
                <DocInputRow
                  label="Surat Keterangan Integritas"
                  field="surat_keterangan_integritas_url"
                  value={docForm.surat_keterangan_integritas_url || ''}
                  onChange={(f, v) => setDocForm(p => ({ ...p, [f]: v }))}
                />
                <DocInputRow
                  label="Bukti Prestasi / Sertifikat 3 Tahun Terakhir"
                  field="bukti_prestasi_url"
                  value={docForm.bukti_prestasi_url || ''}
                  onChange={(f, v) => setDocForm(p => ({ ...p, [f]: v }))}
                />
                <DocInputRow
                  label="Esai Reflektif"
                  field="esai_reflektif_url"
                  value={docForm.esai_reflektif_url || ''}
                  onChange={(f, v) => setDocForm(p => ({ ...p, [f]: v }))}
                />
                <DocInputRow
                  label="Publikasi / Karya Ilmiah"
                  field="karya_ilmiah_url"
                  value={docForm.karya_ilmiah_url || ''}
                  onChange={(f, v) => setDocForm(p => ({ ...p, [f]: v }))}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase text-slate-600">Berkas Madrasah Berprestasi</p>
                <DocInputRow
                  label="Dokumen PDCA / Tata Kelola"
                  field="dokumen_pdca_url"
                  value={docForm.dokumen_pdca_url || ''}
                  onChange={(f, v) => setDocForm(p => ({ ...p, [f]: v }))}
                />
                <DocInputRow
                  label="Portofolio Branding & Keunggulan"
                  field="portofolio_branding_url"
                  value={docForm.portofolio_branding_url || ''}
                  onChange={(f, v) => setDocForm(p => ({ ...p, [f]: v }))}
                />
                <DocInputRow
                  label="Rekap Prestasi Akademik & Non-Akademik"
                  field="rekap_prestasi_url"
                  value={docForm.rekap_prestasi_url || ''}
                  onChange={(f, v) => setDocForm(p => ({ ...p, [f]: v }))}
                />
                <DocInputRow
                  label="Dokumen Administrasi & SDM"
                  field="dokumen_admin_url"
                  value={docForm.dokumen_admin_url || ''}
                  onChange={(f, v) => setDocForm(p => ({ ...p, [f]: v }))}
                />
                <DocInputRow
                  label="Surat Keterangan Integritas"
                  field="surat_keterangan_integritas_url"
                  value={docForm.surat_keterangan_integritas_url || ''}
                  onChange={(f, v) => setDocForm(p => ({ ...p, [f]: v }))}
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-3">
            <Button variant="ghost" onClick={() => setSelectedReg(null)} disabled={savingDocs}>
              Batal
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 font-bold gap-1.5" onClick={handleSaveDocs} disabled={savingDocs}>
              {savingDocs ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Tautan Berkas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DocInputRow({ label, field, value, onChange }: { label: string; field: string; value: string; onChange: (f: string, v: string) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-slate-700">{label}</Label>
        {value && (
          <a href={value} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline flex items-center gap-1">
            <span>Buka Link</span> <ExternalLink size={10} />
          </a>
        )}
      </div>
      <Input
        value={value}
        onChange={e => onChange(field, e.target.value)}
        placeholder="https://drive.google.com/..."
        className="h-8 text-xs font-mono"
      />
    </div>
  );
}
