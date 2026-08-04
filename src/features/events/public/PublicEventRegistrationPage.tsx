import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Calendar, MapPin, Phone, Video, ChevronRight, Plus, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const api = {
  getEvent: (idOrSlug: string) => {
    const isNumeric = /^\d+$/.test(idOrSlug);
    const url = isNumeric
      ? `${API_URL}/public/events/${idOrSlug}`
      : `${API_URL}/public/events/by-slug/${idOrSlug}`;
    return axios.get(url).then(r => r.data?.data ?? r.data);
  },
  register: (idOrSlug: string, data: any) =>
    axios.post(`${API_URL}/public/events/${idOrSlug}/daftar`, data).then(r => r.data),
};

const LOMBA_ICONS: Record<string, string> = {
  mars_maarif: '🎼', mtq_pa: '📖', mtq_pi: '📖', mtq: '📖',
  puji_pujian: '🕌', film_dokumenter: '🎬',
  guru_berprestasi: '👨‍🏫', madrasah_berprestasi: '🏫', oskanu: '🏆',
};
const IS_BEREGU  = ['mars_maarif', 'puji_pujian', 'film_dokumenter'];
const IS_FESTIVAL = ['mars_maarif', 'mtq', 'puji_pujian', 'film_dokumenter'];
const IS_ANUGERAH = ['guru_berprestasi', 'madrasah_berprestasi'];
// MTQ types that show gender dropdown
const IS_MTQ = ['mtq'];

type Step = 'pilih_lomba' | 'isi_form' | 'sukses';
interface Member { name: string; nim: string; }

// ── Reusable DriveField ───────────────────────────────────────────────────────
function DriveField({ label, hint, value, onChange, required: req }: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-slate-700">
        {label}{req && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {hint && <p className="text-[10px] text-slate-400 italic">{hint}</p>}
      <div className="flex gap-1.5">
        <Input value={value} onChange={e => onChange(e.target.value)}
          placeholder="https://drive.google.com/..." className="h-8 text-sm flex-1" />
        {value && (
          <a href={value} target="_blank" rel="noreferrer">
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
              <ExternalLink size={12} />
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

export default function PublicEventRegistrationPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep]       = useState<Step>('pilih_lomba');
  const [selected, setSelected] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]   = useState<any>(null);

  const [form, setForm] = useState({
    // festival / individual
    name: '', institution: '', gender_category: '',
    group_name: '', contact_person: '', contact_phone: '', video_url: '',
    // anugerah
    category: '', jenjang: '', applicant_name: '', applicant_nim: '',
    school_name: '', kecamatan: '', masa_bakti_tahun: '',
    // berkas dokumen (link Google Drive)
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
  const [members, setMembers] = useState<Member[]>([{ name: '', nim: '' }]);

  const setF         = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const addMember    = () => setMembers(m => [...m, { name: '', nim: '' }]);
  const removeMember = (i: number) => setMembers(m => m.filter((_, idx) => idx !== i));
  const setMember    = (i: number, k: keyof Member, v: string) =>
    setMembers(m => m.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  useEffect(() => {
    if (!eventId) return;
    api.getEvent(eventId)
      .then(setEvent)
      .catch(() => toast.error('Gagal memuat data event'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleSelect = (comp: any) => {
    setSelected(comp);
    setForm(p => ({
      ...p,
      category: comp.lomba_type === 'guru_berprestasi' ? 'guru'
        : comp.lomba_type === 'madrasah_berprestasi' ? 'madrasah' : '',
    }));
    if (IS_BEREGU.includes(comp.lomba_type)) setMembers([{ name: '', nim: '' }]);
    setStep('isi_form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !eventId) return;
    setSubmitting(true);
    try {
      const isAnugerah = IS_ANUGERAH.includes(selected.lomba_type);
      const isBeregu   = IS_BEREGU.includes(selected.lomba_type);
      let payload: any = { competition_id: selected.id };

      if (isAnugerah) {
        payload = {
          ...payload,
          category: form.category,
          jenjang: form.jenjang,
          applicant_name: form.applicant_name,
          applicant_nuptk: form.applicant_nim,
          school_name: form.school_name,
          kecamatan: form.kecamatan || undefined,
          masa_bakti_tahun: form.masa_bakti_tahun ? Number(form.masa_bakti_tahun) : undefined,
          contact_phone: form.contact_phone || undefined,
          surat_keterangan_aktif_url:     form.surat_keterangan_aktif_url || undefined,
          sertifikat_pkpnu_url:           form.sertifikat_pkpnu_url || undefined,
          surat_rekomendasi_url:          form.surat_rekomendasi_url || undefined,
          surat_keterangan_integritas_url: form.surat_keterangan_integritas_url || undefined,
          bukti_prestasi_url:             form.bukti_prestasi_url || undefined,
          esai_reflektif_url:             form.esai_reflektif_url || undefined,
          karya_ilmiah_url:               form.karya_ilmiah_url || undefined,
          dokumen_pdca_url:               form.dokumen_pdca_url || undefined,
          portofolio_branding_url:        form.portofolio_branding_url || undefined,
          rekap_prestasi_url:             form.rekap_prestasi_url || undefined,
          dokumen_admin_url:              form.dokumen_admin_url || undefined,
        };
      } else {
        payload = {
          ...payload,
          name: form.name,
          institution: form.institution,
          gender_category: form.gender_category || undefined,
          group_name: form.group_name || undefined,
          member_count: isBeregu ? members.length : undefined,
          members: isBeregu ? members.filter(m => m.name.trim()) : undefined,
          contact_person: form.contact_person || undefined,
          contact_phone: form.contact_phone || undefined,
          video_url: form.video_url || undefined,
        };
      }

      const res = await api.register(eventId, payload);
      setResult(res.data ?? res);
      setStep('sukses');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Pendaftaran gagal. Periksa kembali data Anda.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
      <Loader2 className="animate-spin w-8 h-8 text-green-600" />
    </div>
  );
  if (!event) return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">Event tidak ditemukan.</div>
  );

  const isAnugerahSelected = selected && IS_ANUGERAH.includes(selected.lomba_type);
  const isBereguSelected   = selected && IS_BEREGU.includes(selected.lomba_type);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-emerald-600 text-white py-10 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src="/logo-maarif.png" alt="" className="h-12 w-12 object-contain"
              onError={e => (e.currentTarget.style.display = 'none')} />
            <div className="text-left">
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest">LP Ma'arif NU Cilacap</p>
              <p className="text-[10px] opacity-60">Pengurus Cabang Nahdlatul Ulama Cilacap</p>
            </div>
          </div>
          <h1 className="text-2xl font-black">{event.name}</h1>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm opacity-90 mt-2">
            {event.date && <span className="flex items-center gap-1"><Calendar size={14} />{new Date(event.date).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</span>}
            {event.location && <span className="flex items-center gap-1"><MapPin size={14} />{event.location}</span>}
          </div>
          {event.registration_end && (
            <div className="inline-block mt-2 bg-white/20 rounded-full px-4 py-1 text-sm font-semibold">
              Pendaftaran s.d. {new Date(event.registration_end).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* ── Step 1: Pilih Lomba ─────────────────────────────────────── */}
        {step === 'pilih_lomba' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Pilih Cabang Lomba</h2>
            {(event.competitions ?? []).length === 0 ? (
              <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-2xl">Belum ada cabang lomba yang dibuka.</div>
            ) : (
              <div className="grid gap-3">
                {event.competitions.map((comp: any) => (
                  <button key={comp.id} onClick={() => handleSelect(comp)}
                    className="w-full text-left p-4 bg-white rounded-2xl border border-slate-200 hover:border-green-400 hover:shadow-md transition-all flex items-center gap-4 group">
                    <div className="text-3xl">{LOMBA_ICONS[comp.lomba_type] ?? '🏆'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 group-hover:text-green-700">{comp.name}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-[9px] uppercase">{comp.category}</Badge>
                        {comp.jenjang && <Badge variant="outline" className="text-[9px] uppercase">{comp.jenjang}</Badge>}
                        <Badge variant="outline" className="text-[9px] uppercase">{comp.type}</Badge>
                        <span className="text-[10px] text-slate-400">{comp.participants_count ?? 0} pendaftar</span>
                      </div>
                      {comp.deadline && <p className="text-[10px] text-amber-600 mt-1 font-semibold">Batas: {new Date(comp.deadline).toLocaleString('id-ID',{dateStyle:'short',timeStyle:'short'})}</p>}
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-green-500 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {event.description && (
              <div className="p-4 bg-slate-50 rounded-2xl text-sm text-slate-600 border">
                <p className="font-bold text-slate-700 mb-1">Tentang Event</p>
                <p className="leading-relaxed">{event.description}</p>
              </div>
            )}
            {event.contact_name && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-center gap-2">
                <Phone size={14} />
                <span>Info: <strong>{event.contact_name}</strong> ({event.contact_phone})</span>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Isi Form ────────────────────────────────────────── */}
        {step === 'isi_form' && selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('pilih_lomba')} className="text-slate-500 hover:text-slate-700 text-sm">← Kembali</button>
              <div>
                <h2 className="text-lg font-bold text-slate-800">{LOMBA_ICONS[selected.lomba_type] ?? '🏆'} {selected.name}</h2>
                {selected.jenjang && <p className="text-xs text-slate-500">Jenjang: {selected.jenjang}</p>}
              </div>
            </div>

            {IS_FESTIVAL.includes(selected.lomba_type) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5"><Video size={12} />Ketentuan Video</p>
                <p>Video harus baru, orisinal, live record — tanpa lip sync/auto-tune. Upload ke Google Drive (akses publik).</p>
                {event.video_deadline && <p className="font-semibold">Batas: {new Date(event.video_deadline).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})} WIB</p>}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <Card className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-6 space-y-4">

                  {/* ── Festival / Individual ────────────────────────── */}
                  {!isAnugerahSelected && (
                    <>
                      <div className="space-y-1.5">
                        <Label>{isBereguSelected ? 'Nama Grup / Tim *' : 'Nama Peserta *'}</Label>
                        <Input required value={form.name} onChange={e => setF('name', e.target.value)}
                          placeholder={isBereguSelected ? 'Nama Grup Vokal / Tim Film...' : 'Nama lengkap peserta...'} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Asal Madrasah/Sekolah *</Label>
                        <Input required value={form.institution} onChange={e => setF('institution', e.target.value)} placeholder="MTs Ma'arif 1 Cilacap" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Jenjang *</Label>
                        <Select required value={form.jenjang} onValueChange={v => setF('jenjang', v)}>
                          <SelectTrigger><SelectValue placeholder="Pilih jenjang..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MI/SD">MI / SD</SelectItem>
                            <SelectItem value="MTs/SMP">MTs / SMP</SelectItem>
                            <SelectItem value="MA/SMA/SMK">MA / SMA / SMK</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {['mtq_pa','mtq_pi','mtq'].includes(selected.lomba_type) && (
                        <div className="space-y-1.5">
                          <Label>Jenis Kelamin *</Label>
                          <Select required value={form.gender_category} onValueChange={v => setF('gender_category', v)}>
                            <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pa">Putra (Pa)</SelectItem>
                              <SelectItem value="pi">Putri (Pi)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {/* Anggota Beregu */}
                      {isBereguSelected && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-sm font-bold">Daftar Anggota ({members.length} orang)</Label>
                              <p className="text-[10px] text-slate-400">Untuk keperluan sertifikat masing-masing peserta</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={addMember} className="gap-1 h-7 text-xs">
                              <Plus size={11} /> Tambah
                            </Button>
                          </div>
                          {members.map((m, i) => (
                            <div key={i} className="flex gap-2 items-end p-3 bg-slate-50 rounded-xl border">
                              <div className="flex-1 space-y-1">
                                <Label className="text-[10px] text-slate-500">Nama Anggota {i + 1} *</Label>
                                <Input value={m.name} onChange={e => setMember(i,'name',e.target.value)} placeholder="Nama lengkap..." className="h-8 text-sm" />
                              </div>
                              <div className="w-36 space-y-1">
                                <Label className="text-[10px] text-slate-500">NIM / No. Induk</Label>
                                <Input value={m.nim} onChange={e => setMember(i,'nim',e.target.value)} placeholder="—" className="h-8 text-sm" />
                              </div>
                              {members.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600" onClick={() => removeMember(i)}>
                                  <Trash2 size={13} />
                                </Button>
                              )}
                            </div>
                          ))}
                          <p className="text-[10px] text-slate-400">
                            {selected.lomba_type === 'mars_maarif' && '8–15 orang termasuk Dirigen'}
                            {selected.lomba_type === 'puji_pujian' && '3–5 anak'}
                            {selected.lomba_type === 'film_dokumenter' && 'Maksimal 5 orang'}
                          </p>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label>Nama Guru Pendamping / Kontak</Label>
                        <Input value={form.contact_person} onChange={e => setF('contact_person', e.target.value)} placeholder="Nama pendamping..." />
                      </div>
                      <div className="space-y-1.5">
                        <Label>No. HP Kontak *</Label>
                        <Input required type="tel" value={form.contact_phone} onChange={e => setF('contact_phone', e.target.value)} placeholder="08xx..." />
                      </div>
                      {IS_FESTIVAL.includes(selected.lomba_type) && (
                        <div className="space-y-1.5">
                          <Label>Link Google Drive Video *</Label>
                          <Input required type="url" value={form.video_url} onChange={e => setF('video_url', e.target.value)} placeholder="https://drive.google.com/..." />
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Anugerah Guru / Madrasah ──────────────────────── */}
                  {isAnugerahSelected && (
                    <>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 space-y-1">
                        <p className="font-bold">📋 Persyaratan {form.category === 'guru' ? 'Guru Berprestasi' : 'Madrasah Berprestasi'}</p>
                        {form.category === 'guru' ? (
                          <ul className="list-disc list-inside space-y-0.5">
                            <li>Aktif mengajar minimal 2 tahun berturut-turut</li>
                            <li>Memiliki Sertifikat PKPNU / PD-PKPNU</li>
                            <li>Surat rekomendasi Kepala Madrasah</li>
                            <li>Esai reflektif maks. 3 halaman — <strong>DILARANG pakai AI</strong></li>
                          </ul>
                        ) : (
                          <ul className="list-disc list-inside space-y-0.5">
                            <li>Terdaftar di SIMMACI / LP Ma'arif NU Cilacap</li>
                            <li>Madrasah telah terakreditasi</li>
                            <li>Dokumen PDCA, rekap prestasi, administrasi SDM</li>
                          </ul>
                        )}
                      </div>

                      {/* Data Diri */}
                      <div className="space-y-1.5">
                        <Label>Jenjang *</Label>
                        <Select required value={form.jenjang} onValueChange={v => setF('jenjang', v)}>
                          <SelectTrigger><SelectValue placeholder="Pilih jenjang..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MI/SD">MI / SD</SelectItem>
                            <SelectItem value="MTs/SMP">MTs / SMP</SelectItem>
                            <SelectItem value="MA/SMA/SMK">MA / SMA / SMK</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>{form.category === 'guru' ? 'Nama Guru *' : 'Nama Kepala Madrasah *'}</Label>
                        <Input required value={form.applicant_name} onChange={e => setF('applicant_name', e.target.value)} placeholder="Nama lengkap..." />
                      </div>
                      {form.category === 'guru' && (
                        <div className="space-y-1.5">
                          <Label>NIM (Nomor Induk Ma'arif)</Label>
                          <Input value={form.applicant_nim} onChange={e => setF('applicant_nim', e.target.value)} placeholder="—" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label>Nama Madrasah/Sekolah *</Label>
                        <Input required value={form.school_name} onChange={e => setF('school_name', e.target.value)} placeholder="MI / MTs / MA..." />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Kecamatan</Label>
                        <Input value={form.kecamatan} onChange={e => setF('kecamatan', e.target.value)} placeholder="Kecamatan..." />
                      </div>
                      {form.category === 'guru' && (
                        <div className="space-y-1.5">
                          <Label>Masa Bakti (Tahun)</Label>
                          <Input type="number" min="0" value={form.masa_bakti_tahun} onChange={e => setF('masa_bakti_tahun', e.target.value)} placeholder="Minimal 2 tahun..." />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label>No. HP Kontak *</Label>
                        <Input required type="tel" value={form.contact_phone} onChange={e => setF('contact_phone', e.target.value)} placeholder="08xx..." />
                      </div>

                      {/* Berkas Dokumen */}
                      <div className="pt-3 border-t space-y-4">
                        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800">
                          <p className="font-bold mb-1">📎 Upload Berkas via Google Drive</p>
                          <p>Upload masing-masing dokumen ke Google Drive Anda, atur akses <strong>"Siapa saja yang memiliki link dapat melihat"</strong>, lalu paste link di bawah.</p>
                        </div>

                        {form.category === 'guru' && (
                          <div className="space-y-3">
                            <p className="text-xs font-bold text-slate-600 uppercase">Berkas Wajib Guru Berprestasi</p>
                            <DriveField required label="Surat Keterangan Aktif Mengajar"
                              hint="dari Kepala Madrasah — min. 2 tahun berturut-turut"
                              value={form.surat_keterangan_aktif_url}
                              onChange={v => setF('surat_keterangan_aktif_url', v)} />
                            <DriveField required label="Sertifikat PKPNU / PD-PKPNU"
                              hint="atau Surat Keterangan dari Ranting NU setempat"
                              value={form.sertifikat_pkpnu_url}
                              onChange={v => setF('sertifikat_pkpnu_url', v)} />
                            <DriveField required label="Surat Rekomendasi Kepala Madrasah"
                              value={form.surat_rekomendasi_url}
                              onChange={v => setF('surat_rekomendasi_url', v)} />
                            <DriveField required label="Surat Keterangan Integritas"
                              hint="tidak pernah melanggar hukum / kode etik guru"
                              value={form.surat_keterangan_integritas_url}
                              onChange={v => setF('surat_keterangan_integritas_url', v)} />
                            <DriveField required label="Bukti Prestasi (sertifikat/piagam 3 tahun terakhir)"
                              hint="TA 23/24, 24/25, 25/26 — sebagai juara, pemakalah, atau pembina"
                              value={form.bukti_prestasi_url}
                              onChange={v => setF('bukti_prestasi_url', v)} />
                            <DriveField required label="Esai Reflektif (maks. 3 halaman — DILARANG AI)"
                              hint={'Tema: "Strategi Guru Meningkatkan Prestasi Siswa Generasi Alpha Berbasis Nilai-Nilai Aswaja"'}
                              value={form.esai_reflektif_url}
                              onChange={v => setF('esai_reflektif_url', v)} />
                            <DriveField label="Publikasi / Karya Ilmiah (opsional)"
                              hint="artikel ilmiah, buku ber-ISBN, atau tulisan di media massa"
                              value={form.karya_ilmiah_url}
                              onChange={v => setF('karya_ilmiah_url', v)} />
                          </div>
                        )}

                        {form.category === 'madrasah' && (
                          <div className="space-y-3">
                            <p className="text-xs font-bold text-slate-600 uppercase">Berkas Wajib Madrasah Berprestasi</p>
                            <DriveField required label="Dokumen PDCA / Tata Kelola Madrasah"
                              hint="RKJM, RKT, instrumen evaluasi internal (BP3MNU, Pengawas Madrasah, dll)"
                              value={form.dokumen_pdca_url}
                              onChange={v => setF('dokumen_pdca_url', v)} />
                            <DriveField required label="Portofolio Branding & Keunggulan Madrasah"
                              hint="profil keunggulan komparatif"
                              value={form.portofolio_branding_url}
                              onChange={v => setF('portofolio_branding_url', v)} />
                            <DriveField required label="Rekap Prestasi Akademik & Non-Akademik"
                              hint="TA 23/24, 24/25, 25/26 — tingkat Kecamatan s.d. Nasional"
                              value={form.rekap_prestasi_url}
                              onChange={v => setF('rekap_prestasi_url', v)} />
                            <DriveField required label="Dokumen Administrasi & SDM"
                              hint="kelengkapan administrasi guru & pengisian di SIMNU/SIMMACI"
                              value={form.dokumen_admin_url}
                              onChange={v => setF('dokumen_admin_url', v)} />
                            <DriveField label="Surat Keterangan Integritas (Kepala Madrasah)"
                              value={form.surat_keterangan_integritas_url}
                              onChange={v => setF('surat_keterangan_integritas_url', v)} />
                            <DriveField label="Bukti Prestasi Siswa/Guru (sertifikat/piagam)"
                              hint="3 tahun terakhir — TA 23/24, 24/25, 25/26"
                              value={form.bukti_prestasi_url}
                              onChange={v => setF('bukti_prestasi_url', v)} />
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400">* Berkas wajib. Berkas yang belum siap dapat dilengkapi kemudian dengan menghubungi panitia.</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Button type="submit" className="w-full mt-4 h-12 text-base font-bold bg-green-600 hover:bg-green-700" disabled={submitting}>
                {submitting ? <><Loader2 size={16} className="animate-spin mr-2" />Mendaftarkan...</> : '✅ Kirim Pendaftaran'}
              </Button>
            </form>
          </div>
        )}

        {/* ── Step 3: Sukses ─────────────────────────────────────────── */}
        {step === 'sukses' && result && (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Pendaftaran Berhasil! 🎉</h2>
              <p className="text-slate-500 mt-2">Nomor Registrasi: <strong className="text-green-700 text-lg">#{result.id}</strong></p>
            </div>
            <Card className="border-0 shadow-sm rounded-2xl text-left">
              <CardContent className="p-5 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Nama</span><span className="font-semibold">{result.name ?? result.applicant_name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Lembaga</span><span className="font-semibold">{result.institution ?? result.school_name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Lomba</span><span className="font-semibold">{selected?.name}</span></div>
              </CardContent>
            </Card>
            {isAnugerahSelected && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
                <p className="font-bold mb-1">⚠️ Langkah Selanjutnya</p>
                <p>Pendaftaran tercatat sebagai <strong>draft</strong>. Panitia akan memverifikasi berkas yang Anda kirimkan. Simpan nomor registrasi Anda.</p>
              </div>
            )}
            {event.contact_name && (
              <p className="text-sm text-slate-500">Info lebih lanjut: <strong>{event.contact_name}</strong> ({event.contact_phone})</p>
            )}
            <Button variant="outline" onClick={() => { setStep('pilih_lomba'); setSelected(null); setResult(null); }}>
              Daftar Lomba Lain
            </Button>
          </div>
        )}

        <div className="text-center text-xs text-slate-400 pt-4 border-t">
          <p>LP Ma'arif NU PCNU Cilacap &bull; Merawat Jagad Membangun Peradaban</p>
          <p className="mt-0.5">simmaci.com</p>
        </div>
      </div>
    </div>
  );
}
