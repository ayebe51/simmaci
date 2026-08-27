import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventApi, mediaApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Trash2, Loader2, Upload, Calculator, Award, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';

const SCORING_MATRIX: Record<string, number[]> = {
  internasional: [100, 85, 70, 50],
  nasional:      [80, 65, 50, 35],
  provinsi:      [60, 45, 30, 20],
  kabupaten:     [40, 30, 20, 10],
  kecamatan:     [20, 15, 10, 5],
};

function calcScore(list: any[]) {
  return list.reduce((total, item) => {
    const scores = SCORING_MATRIX[item.tingkat] ?? [0, 0, 0, 0];
    const idx = Math.min(Math.max(Number(item.juara) - 1, 0), 3);
    const pts = scores[idx] ?? 0;
    return total + pts + (item.is_lp_maarif ? 5 : 0);
  }, 0);
}

interface PrestasiItem {
  nama: string;
  tingkat: string;
  juara: number;
  tahun_ajaran: string;
  is_lp_maarif: boolean;
}

export default function AnugerahRegistrationPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [prestasiList, setPrestasiList] = useState<PrestasiItem[]>([]);
  const [liveScore, setLiveScore] = useState(0);

  const [form, setForm] = useState({
    competition_id: '',
    category: 'guru',
    jenjang: '',
    applicant_name: '',
    applicant_nuptk: '',
    school_name: '',
    kecamatan: '',
    masa_bakti_tahun: '',
    mulai_bertugas: '',
    surat_keterangan_aktif_url: '',
    sertifikat_pkpnu_url: '',
    surat_rekomendasi_url: '',
    surat_keterangan_integritas_url: '',
    bukti_prestasi_url: '',
    esai_reflektif_url: '',
    karya_ilmiah_url: '',
    dokumen_pdca_url: '',
    portofolio_branding_url: '',
    rekap_prestasi_url: '',
    dokumen_admin_url: '',
  });

  useEffect(() => {
    if (!eventId) return;
    eventApi.get(Number(eventId)).then(data => {
      setEvent(data);
      const anugerahComps = (data.competitions ?? []).filter((c: any) =>
        ['guru_berprestasi', 'madrasah_berprestasi'].includes(c.lomba_type)
      );
      setCompetitions(anugerahComps);
    }).catch(() => toast.error('Gagal memuat data event'));
  }, [eventId]);

  useEffect(() => { setLiveScore(calcScore(prestasiList)); }, [prestasiList]);

  const setF = (key: string, val: string) => setForm(p => ({...p, [key]: val}));

  const addPrestasi = () =>
    setPrestasiList(p => [...p, { nama: '', tingkat: 'kabupaten', juara: 1, tahun_ajaran: '', is_lp_maarif: false }]);

  const setPrestasi = (i: number, key: string, val: any) =>
    setPrestasiList(p => p.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const removePrestasi = (i: number) =>
    setPrestasiList(p => p.filter((_, idx) => idx !== i));

  const handleUpload = async (field: string, file: File) => {
    setUploadingField(field);
    try {
      const res = await mediaApi.upload(file, 'anugerah');
      setF(field, res.url ?? res.path ?? '');
      toast.success('File berhasil diupload');
    } catch {
      toast.error('Gagal mengupload file');
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async (asDraft = true) => {
    if (!form.competition_id) { toast.error('Pilih kategori lomba terlebih dahulu'); return; }
    if (!form.applicant_name.trim()) { toast.error('Nama pendaftar wajib diisi'); return; }
    if (!form.school_name.trim()) { toast.error('Nama madrasah/sekolah wajib diisi'); return; }
    if (!form.jenjang) { toast.error('Pilih jenjang terlebih dahulu'); return; }
    setSaving(true);
    try {
      const reg = await eventApi.anugerah.create({
        event_id: Number(eventId),
        ...form,
        competition_id: Number(form.competition_id),
        masa_bakti_tahun: form.masa_bakti_tahun ? Number(form.masa_bakti_tahun) : undefined,
        prestasi_list: prestasiList,
        status: 'draft',
      });
      if (!asDraft) {
        await eventApi.anugerah.submit(reg.id);
        toast.success('Pendaftaran berhasil disubmit!');
      } else {
        toast.success('Pendaftaran disimpan sebagai draft.');
      }
      navigate(`/dashboard/anugerah-registrations/${reg.id}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Gagal menyimpan pendaftaran');
    } finally {
      setSaving(false);
    }
  };

  if (!event) return <div className="flex justify-center p-12"><Loader2 className="animate-spin"/></div>;

  const isGuru = form.category === 'guru';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
          <ArrowLeft size={14}/> Kembali
        </Button>
        <div>
          <h1 className="text-xl font-black text-slate-900">Formulir Pendaftaran Anugerah Pendidikan</h1>
          <p className="text-xs text-slate-500">{event.name}</p>
        </div>
      </div>

      <Tabs defaultValue="identitas">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="identitas">1. Identitas</TabsTrigger>
          <TabsTrigger value="prestasi">2. Rekap Prestasi</TabsTrigger>
          <TabsTrigger value="berkas">3. Berkas Dokumen</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Identitas ───────────────────────────────── */}
        <TabsContent value="identitas" className="mt-4">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold uppercase text-slate-700">Informasi Umum</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Kategori Anugerah *</Label>
                  <Select value={form.competition_id} onValueChange={v => {
                    const comp = competitions.find(c => String(c.id) === v);
                    setF('competition_id', v);
                    if (comp) setF('category', comp.lomba_type === 'guru_berprestasi' ? 'guru' : 'madrasah');
                  }}>
                    <SelectTrigger><SelectValue placeholder="Pilih kategori..."/></SelectTrigger>
                    <SelectContent>
                      {competitions.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Jenjang *</Label>
                  <Select value={form.jenjang} onValueChange={v => setF('jenjang', v)}>
                    <SelectTrigger><SelectValue placeholder="Pilih jenjang..."/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MI/SD">MI / SD</SelectItem>
                      <SelectItem value="MTs/SMP">MTs / SMP</SelectItem>
                      <SelectItem value="MA/SMA/SMK">MA / SMA / SMK</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">{isGuru ? 'Nama Guru *' : 'Nama Kepala Madrasah *'}</Label>
                  <Input value={form.applicant_name} onChange={e => setF('applicant_name', e.target.value)} placeholder="Nama lengkap..." />
                </div>
                {isGuru && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">NUPTK</Label>
                    <Input value={form.applicant_nuptk} onChange={e => setF('applicant_nuptk', e.target.value)} placeholder="—" />
                  </div>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Nama Madrasah/Sekolah *</Label>
                  <Input value={form.school_name} onChange={e => setF('school_name', e.target.value)} placeholder="MI/MTs/MA..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Kecamatan</Label>
                  <Input value={form.kecamatan} onChange={e => setF('kecamatan', e.target.value)} placeholder="Kecamatan..." />
                </div>
              </div>
              {isGuru && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Masa Bakti (Tahun)</Label>
                    <Input type="number" min="0" value={form.masa_bakti_tahun} onChange={e => setF('masa_bakti_tahun', e.target.value)} placeholder="Minimal 2 tahun..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Mulai Bertugas</Label>
                    <Input type="date" value={form.mulai_bertugas} onChange={e => setF('mulai_bertugas', e.target.value)} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 2: Rekap Prestasi ──────────────────────────── */}
        <TabsContent value="prestasi" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-700">Rekap Prestasi (3 Tahun Terakhir)</p>
              <p className="text-xs text-slate-500">TA 23/24, 24/25, 25/26 — Pribadi maupun pembimbingan siswa</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-slate-500">Estimasi Skor</p>
                <p className="text-2xl font-black text-emerald-600 flex items-center gap-1"><Calculator size={16}/>{liveScore}</p>
              </div>
              <Button size="sm" onClick={addPrestasi} className="gap-1.5"><Plus size={13}/>Tambah</Button>
            </div>
          </div>

          {/* Scoring matrix info */}
          <div className="p-3 bg-slate-50 rounded-xl border text-xs text-slate-600">
            <p className="font-bold mb-2">📊 Matriks Skor Kejuaraan (Juknis)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-[10px]">
                <thead><tr className="bg-slate-100">
                  <th className="p-1.5 text-left">Tingkat</th>
                  <th className="p-1.5 text-amber-600">Juara 1 / Emas</th>
                  <th className="p-1.5 text-slate-500">Juara 2 / Perak</th>
                  <th className="p-1.5 text-orange-500">Juara 3 / Perunggu</th>
                  <th className="p-1.5 text-slate-400">Harapan</th>
                </tr></thead>
                <tbody>
                  {Object.entries(SCORING_MATRIX).map(([lvl, s]) => (
                    <tr key={lvl} className="border-b">
                      <td className="p-1.5 text-left font-semibold capitalize">{lvl}</td>
                      {s.map((v, i) => <td key={i} className="p-1.5 font-bold">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-slate-500">* Lomba resmi LP Ma'arif NU (PORSEMA, Olympiade Ma'arif, dll.) mendapat Bonus +5 Poin</p>
          </div>

          {prestasiList.length === 0 ? (
            <div className="text-center py-10 text-slate-400 border-2 border-dashed rounded-2xl">
              <Award size={28} className="mx-auto mb-2 opacity-40"/>
              <p className="text-sm">Belum ada data prestasi. Klik "Tambah" untuk menambahkan.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {prestasiList.map((item, i) => (
                <Card key={i} className="border shadow-none rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-500 uppercase">Prestasi #{i + 1}</span>
                      <Button variant="ghost" size="sm" className="text-red-500 h-7 w-7 p-0" onClick={() => removePrestasi(i)}><Trash2 size={13}/></Button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Nama Lomba / Prestasi</Label>
                        <Input value={item.nama} onChange={e => setPrestasi(i, 'nama', e.target.value)} placeholder="Juara MTQ Tingkat Kabupaten..." className="h-8 text-sm"/>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Tingkat</Label>
                        <Select value={item.tingkat} onValueChange={v => setPrestasi(i, 'tingkat', v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="internasional">Internasional</SelectItem>
                            <SelectItem value="nasional">Nasional</SelectItem>
                            <SelectItem value="provinsi">Provinsi (PW NU / Dinas)</SelectItem>
                            <SelectItem value="kabupaten">Kabupaten/Kota (PC NU)</SelectItem>
                            <SelectItem value="kecamatan">Kecamatan / MWC NU</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Juara ke-</Label>
                        <Select value={String(item.juara)} onValueChange={v => setPrestasi(i, 'juara', Number(v))}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Juara 1 / Emas</SelectItem>
                            <SelectItem value="2">Juara 2 / Perak</SelectItem>
                            <SelectItem value="3">Juara 3 / Perunggu</SelectItem>
                            <SelectItem value="4">Harapan / Finalis</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Tahun Ajaran</Label>
                        <Select value={item.tahun_ajaran} onValueChange={v => setPrestasi(i, 'tahun_ajaran', v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Pilih TA..."/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2023/2024">2023/2024</SelectItem>
                            <SelectItem value="2024/2025">2024/2025</SelectItem>
                            <SelectItem value="2025/2026">2025/2026</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 flex items-end gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={item.is_lp_maarif} onChange={e => setPrestasi(i, 'is_lp_maarif', e.target.checked)} className="rounded" />
                          <span className="text-xs text-slate-600">Lomba resmi LP Ma'arif NU (+5 Poin)</span>
                        </label>
                      </div>
                    </div>
                    <div className="mt-2 text-right text-xs text-emerald-600 font-bold">
                      Skor item ini: {(SCORING_MATRIX[item.tingkat]?.[Math.min(item.juara - 1, 3)] ?? 0) + (item.is_lp_maarif ? 5 : 0)} poin
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Tab 3: Berkas ──────────────────────────────────── */}
        <TabsContent value="berkas" className="mt-4">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold uppercase text-slate-700">Upload Berkas Dokumen</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Template Download Box */}
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <Download size={14} className="text-emerald-700" />
                  <span>📥 Format & Template Berkas Resmi Juknis</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Unduh template resmi berikut untuk diisi sebelum diupload:
                </p>
                <div className="grid sm:grid-cols-3 gap-2 pt-1">
                  <a
                    href="/templates/anugerah/SURAT_KETERANGAN.docx"
                    download
                    className="flex items-center gap-2 p-2 bg-white rounded-lg border border-emerald-200 hover:border-emerald-400 hover:shadow-xs transition-all text-left group"
                  >
                    <FileText size={16} className="text-blue-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-800 leading-tight truncate">Surat Keterangan</p>
                      <p className="text-[9px] text-slate-500">Bebas Pelanggaran (.docx)</p>
                    </div>
                  </a>
                  <a
                    href="/templates/anugerah/DAFTAR_PUBLIKASI_DAN_KARYA_ILMIAH.xlsx"
                    download
                    className="flex items-center gap-2 p-2 bg-white rounded-lg border border-emerald-200 hover:border-emerald-400 hover:shadow-xs transition-all text-left group"
                  >
                    <FileSpreadsheet size={16} className="text-green-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-800 leading-tight truncate">Daftar Publikasi</p>
                      <p className="text-[9px] text-slate-500">Karya Ilmiah (.xlsx)</p>
                    </div>
                  </a>
                  <a
                    href="/templates/anugerah/REKAM_JEJAK_PRESTASI_AKADEMIK_NON_AKADEMIK.xlsx"
                    download
                    className="flex items-center gap-2 p-2 bg-white rounded-lg border border-emerald-200 hover:border-emerald-400 hover:shadow-xs transition-all text-left group"
                  >
                    <FileSpreadsheet size={16} className="text-emerald-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-800 leading-tight truncate">Rekam Jejak Prestasi</p>
                      <p className="text-[9px] text-slate-500">Akademik & Non-Akad (.xlsx)</p>
                    </div>
                  </a>
                </div>
              </div>

              {/* Common docs */}
              <FileUploadField label="Surat Keterangan Aktif Mengajar *" field="surat_keterangan_aktif_url" value={form.surat_keterangan_aktif_url} uploadingField={uploadingField} onUpload={handleUpload} onUrl={setF} />
              <FileUploadField label="Sertifikat PKPNU / PD-PKPNU *" field="sertifikat_pkpnu_url" value={form.sertifikat_pkpnu_url} uploadingField={uploadingField} onUpload={handleUpload} onUrl={setF} />
              <FileUploadField label="Surat Rekomendasi Kepala Madrasah *" field="surat_rekomendasi_url" value={form.surat_rekomendasi_url} uploadingField={uploadingField} onUpload={handleUpload} onUrl={setF} />
              <FileUploadField label="Surat Keterangan Integritas (Tdk melanggar hukum/kode etik) *" field="surat_keterangan_integritas_url" value={form.surat_keterangan_integritas_url} uploadingField={uploadingField} onUpload={handleUpload} onUrl={setF} templateUrl="/templates/anugerah/SURAT_KETERANGAN.docx" templateName="Unduh Surat Keterangan (.docx)" />
              <FileUploadField label="Bukti Prestasi (Sertifikat/Piagam 3 Tahun Terakhir)" field="bukti_prestasi_url" value={form.bukti_prestasi_url} uploadingField={uploadingField} onUpload={handleUpload} onUrl={setF} templateUrl="/templates/anugerah/REKAM_JEJAK_PRESTASI_AKADEMIK_NON_AKADEMIK.xlsx" templateName="Unduh Rekam Jejak (.xlsx)" />
              {isGuru && (
                <>
                  <FileUploadField label="Esai Reflektif (Maks. 3 halaman — DILARANG AI)" field="esai_reflektif_url" value={form.esai_reflektif_url} uploadingField={uploadingField} onUpload={handleUpload} onUrl={setF} hint="Tema: Strategi Guru Dalam Meningkatkan Prestasi Siswa Generasi Alpha Berbasis Nilai-Nilai Aswaja" />
                  <FileUploadField label="Publikasi / Karya Ilmiah (Opsional)" field="karya_ilmiah_url" value={form.karya_ilmiah_url} uploadingField={uploadingField} onUpload={handleUpload} onUrl={setF} hint="Artikel ilmiah, buku ber-ISBN, atau tulisan di media massa" templateUrl="/templates/anugerah/DAFTAR_PUBLIKASI_DAN_KARYA_ILMIAH.xlsx" templateName="Unduh Format Publikasi (.xlsx)" />
                </>
              )}
              {!isGuru && (
                <>
                  <FileUploadField label="Dokumen PDCA / Tata Kelola (RKJM, RKT, Evaluasi Internal)" field="dokumen_pdca_url" value={form.dokumen_pdca_url} uploadingField={uploadingField} onUpload={handleUpload} onUrl={setF} />
                  <FileUploadField label="Portofolio Branding & Keunggulan Madrasah" field="portofolio_branding_url" value={form.portofolio_branding_url} uploadingField={uploadingField} onUpload={handleUpload} onUrl={setF} />
                  <FileUploadField label="Rekap Prestasi Akademik & Non-Akademik" field="rekap_prestasi_url" value={form.rekap_prestasi_url} uploadingField={uploadingField} onUpload={handleUpload} onUrl={setF} templateUrl="/templates/anugerah/REKAM_JEJAK_PRESTASI_AKADEMIK_NON_AKADEMIK.xlsx" templateName="Unduh Format Rekap (.xlsx)" />
                  <FileUploadField label="Dokumen Administrasi & Kelengkapan SIMNU/SIMMACI" field="dokumen_admin_url" value={form.dokumen_admin_url} uploadingField={uploadingField} onUpload={handleUpload} onUrl={setF} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submit bar */}
      <div className="flex justify-between items-center pt-4 border-t gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)}>Batal</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1.5"/> : null} Simpan Draft
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1.5"/> : null} Submit Pendaftaran
          </Button>
        </div>
      </div>
    </div>
  );
}

function FileUploadField({ label, field, value, uploadingField, onUpload, onUrl, hint, templateUrl, templateName }: {
  label: string; field: string; value: string; uploadingField: string | null;
  onUpload: (f: string, file: File) => void; onUrl: (f: string, v: string) => void; hint?: string;
  templateUrl?: string; templateName?: string;
}) {
  const isUploading = uploadingField === field;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-xs font-semibold text-slate-700">{label}</Label>
        {templateUrl && (
          <a
            href={templateUrl}
            download
            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 transition-colors flex-shrink-0"
          >
            <Download size={11} />
            {templateName || 'Unduh Template'}
          </a>
        )}
      </div>
      {hint && <p className="text-[10px] text-slate-500 italic">{hint}</p>}
      <div className="flex gap-2">
        <Input value={value} onChange={e => onUrl(field, e.target.value)} placeholder="URL atau upload file..." className="h-8 text-sm flex-1" />
        <label className="cursor-pointer">
          <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(field, f); }} />
          <Button variant="outline" size="sm" className="h-8 gap-1 pointer-events-none" asChild>
            <span>{isUploading ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>} Upload</span>
          </Button>
        </label>
      </div>
      {value && (
        <a href={value} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 underline truncate block max-w-sm">{value}</a>
      )}
    </div>
  );
}
