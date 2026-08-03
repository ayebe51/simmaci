import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Trophy, Calendar, MapPin, Phone, Users, Video, Award, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const api = {
  getEvent: (idOrSlug: string) => {
    // Try by slug first if not numeric
    const isNumeric = /^\d+$/.test(idOrSlug);
    const url = isNumeric
      ? `${API_URL}/public/events/${idOrSlug}`
      : `${API_URL}/public/events/by-slug/${idOrSlug}`;
    return axios.get(url).then(r => r.data?.data ?? r.data);
  },
  register: (idOrSlug: string, data: any) => axios.post(`${API_URL}/public/events/${idOrSlug}/daftar`, data).then(r => r.data),
};

const LOMBA_ICONS: Record<string, string> = {
  mars_maarif: '🎼', mtq_pa: '📖', mtq_pi: '📖',
  puji_pujian: '🕌', film_dokumenter: '🎬',
  guru_berprestasi: '👨‍🏫', madrasah_berprestasi: '🏫', oskanu: '🏆',
};

type Step = 'pilih_lomba' | 'isi_form' | 'sukses';

export default function PublicEventRegistrationPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('pilih_lomba');
  const [selected, setSelected] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [form, setForm] = useState({
    name: '', institution: '', gender_category: '',
    group_name: '', member_count: '', contact_person: '',
    contact_phone: '', video_url: '',
    // anugerah fields
    category: '', jenjang: '', applicant_name: '', applicant_nuptk: '',
    school_name: '', kecamatan: '', masa_bakti_tahun: '',
  });

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!eventId) return;
    api.getEvent(eventId)
      .then(setEvent)
      .catch(() => toast.error('Gagal memuat data event'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleSelect = (comp: any) => {
    setSelected(comp);
    const isAnugerah = ['guru_berprestasi', 'madrasah_berprestasi'].includes(comp.lomba_type);
    setForm(p => ({
      ...p,
      category: comp.lomba_type === 'guru_berprestasi' ? 'guru' : comp.lomba_type === 'madrasah_berprestasi' ? 'madrasah' : '',
    }));
    setStep('isi_form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !eventId) return;
    setSubmitting(true);
    try {
      const isAnugerah = ['guru_berprestasi', 'madrasah_berprestasi'].includes(selected.lomba_type);
      const payload = isAnugerah
        ? { competition_id: selected.id, ...form }
        : { competition_id: selected.id, name: form.name, institution: form.institution, gender_category: form.gender_category || undefined, group_name: form.group_name || undefined, member_count: form.member_count ? Number(form.member_count) : undefined, contact_person: form.contact_person || undefined, contact_phone: form.contact_phone || undefined, video_url: form.video_url || undefined };

      const res = await api.register(eventId, payload);
      setResult(res.data ?? res);
      setStep('sukses');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Pendaftaran gagal. Periksa kembali data Anda.');
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
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      Event tidak ditemukan.
    </div>
  );

  const isAnugerah = selected && ['guru_berprestasi', 'madrasah_berprestasi'].includes(selected.lomba_type);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-emerald-600 text-white py-10 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src="/logo-maarif.png" alt="LP Ma'arif NU" className="h-12 w-12 object-contain" onError={e => (e.currentTarget.style.display='none')} />
            <div className="text-left">
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest">LP Ma'arif NU Cilacap</p>
              <p className="text-[10px] opacity-60">Pengurus Cabang Nahdlatul Ulama Cilacap</p>
            </div>
          </div>
          <h1 className="text-2xl font-black">{event.name}</h1>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm opacity-90 mt-2">
            {event.date && <span className="flex items-center gap-1"><Calendar size={14}/>{new Date(event.date).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</span>}
            {event.location && <span className="flex items-center gap-1"><MapPin size={14}/>{event.location}</span>}
          </div>
          {event.registration_end && (
            <div className="inline-block mt-2 bg-white/20 rounded-full px-4 py-1 text-sm font-semibold">
              Pendaftaran sampai: {new Date(event.registration_end).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Step: Pilih lomba */}
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
                      {comp.deadline && (
                        <p className="text-[10px] text-amber-600 mt-1 font-semibold">
                          Batas: {new Date(comp.deadline).toLocaleString('id-ID',{dateStyle:'short',timeStyle:'short'})}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-green-500 flex-shrink-0"/>
                  </button>
                ))}
              </div>
            )}

            {/* Event info */}
            {event.description && (
              <div className="p-4 bg-slate-50 rounded-2xl text-sm text-slate-600 border">
                <p className="font-bold text-slate-700 mb-1">Tentang Event</p>
                <p className="leading-relaxed">{event.description}</p>
              </div>
            )}
            {event.contact_name && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-center gap-2">
                <Phone size={14}/>
                <span>Info & Pendaftaran: <strong>{event.contact_name}</strong> ({event.contact_phone})</span>
              </div>
            )}
          </div>
        )}

        {/* Step: Isi form */}
        {step === 'isi_form' && selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('pilih_lomba')} className="text-slate-500 hover:text-slate-700">
                ← Kembali
              </button>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {LOMBA_ICONS[selected.lomba_type] ?? '🏆'} Daftar: {selected.name}
                </h2>
                {selected.jenjang && <p className="text-xs text-slate-500">Jenjang: {selected.jenjang}</p>}
              </div>
            </div>

            {/* Video info for Festival Aswaja */}
            {['mars_maarif','mtq_pa','mtq_pi','puji_pujian','film_dokumenter'].includes(selected.lomba_type) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5"><Video size={12}/>Ketentuan Video</p>
                <p>Video harus baru, orisinal, live record tanpa lip sync/auto-tune.</p>
                <p>Upload ke Google Drive (akses publik), kirim link di bawah.</p>
                {event.video_deadline && (
                  <p className="font-semibold">Batas pengiriman: {new Date(event.video_deadline).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})} WIB</p>
                )}
                <p>Kirim via formulir resmi: <a href="https://s.id/Harlah97MaarifCilacap" target="_blank" rel="noreferrer" className="underline font-bold">s.id/Harlah97MaarifCilacap</a></p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <Card className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-6 space-y-4">
                  {!isAnugerah ? (
                    // Festival Aswaja form
                    <>
                      <div className="space-y-1.5">
                        <Label>Nama Peserta / Nama Grup *</Label>
                        <Input required value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Ahmad / Grup Nada Pesantren" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Asal Madrasah/Sekolah *</Label>
                        <Input required value={form.institution} onChange={e => setF('institution', e.target.value)} placeholder="MTs Ma'arif 1 Cilacap" />
                      </div>
                      {['mtq_pa','mtq_pi'].includes(selected.lomba_type) && (
                        <div className="space-y-1.5">
                          <Label>Jenis Kelamin</Label>
                          <Select value={form.gender_category} onValueChange={v => setF('gender_category', v)}>
                            <SelectTrigger><SelectValue placeholder="Pilih..."/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pa">Putra (Pa)</SelectItem>
                              <SelectItem value="pi">Putri (Pi)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {['mars_maarif','puji_pujian','film_dokumenter'].includes(selected.lomba_type) && (
                        <>
                          <div className="space-y-1.5">
                            <Label>Nama Grup / Tim</Label>
                            <Input value={form.group_name} onChange={e => setF('group_name', e.target.value)} placeholder="Nama grup..." />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Jumlah Anggota</Label>
                            <Input type="number" min="1" value={form.member_count} onChange={e => setF('member_count', e.target.value)} placeholder="—" />
                          </div>
                        </>
                      )}
                      <div className="space-y-1.5">
                        <Label>Nama Guru Pendamping / Kontak</Label>
                        <Input value={form.contact_person} onChange={e => setF('contact_person', e.target.value)} placeholder="Nama pendamping..." />
                      </div>
                      <div className="space-y-1.5">
                        <Label>No. HP Kontak</Label>
                        <Input type="tel" value={form.contact_phone} onChange={e => setF('contact_phone', e.target.value)} placeholder="08xx..." />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Link Google Drive Video (jika sudah ada)</Label>
                        <Input type="url" value={form.video_url} onChange={e => setF('video_url', e.target.value)} placeholder="https://drive.google.com/..." />
                        <p className="text-[10px] text-slate-400">Bisa dilengkapi kemudian</p>
                      </div>
                    </>
                  ) : (
                    // Anugerah Guru / Madrasah form
                    <>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 space-y-1">
                        <p className="font-bold">📋 Persyaratan {form.category === 'guru' ? 'Guru Berprestasi' : 'Madrasah Berprestasi'}</p>
                        {form.category === 'guru' ? (
                          <ul className="list-disc list-inside space-y-0.5">
                            <li>Aktif mengajar minimal 2 tahun berturut-turut</li>
                            <li>Memiliki Sertifikat PKPNU / PD-PKPNU</li>
                            <li>Lengkapi berkas via SIMMACI setelah mendaftar</li>
                          </ul>
                        ) : (
                          <ul className="list-disc list-inside space-y-0.5">
                            <li>Terdaftar di SIMMACI / LP Ma'arif NU Cilacap</li>
                            <li>Madrasah telah terakreditasi</li>
                            <li>Lengkapi berkas PDCA & rekap prestasi via SIMMACI</li>
                          </ul>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Jenjang *</Label>
                        <Select required value={form.jenjang} onValueChange={v => setF('jenjang', v)}>
                          <SelectTrigger><SelectValue placeholder="Pilih jenjang..."/></SelectTrigger>
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
                          <Label>NUPTK</Label>
                          <Input value={form.applicant_nuptk} onChange={e => setF('applicant_nuptk', e.target.value)} placeholder="—" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label>Nama Madrasah/Sekolah *</Label>
                        <Input required value={form.school_name} onChange={e => setF('school_name', e.target.value)} placeholder="MI/MTs/MA..." />
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
                        <Label>No. HP Kontak</Label>
                        <Input type="tel" value={form.contact_phone} onChange={e => setF('contact_phone', e.target.value)} placeholder="08xx..." />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Button type="submit" className="w-full mt-4 h-12 text-base font-bold bg-green-600 hover:bg-green-700" disabled={submitting}>
                {submitting ? <><Loader2 size={16} className="animate-spin mr-2"/>Mendaftarkan...</> : '✅ Kirim Pendaftaran'}
              </Button>
            </form>
          </div>
        )}

        {/* Step: Sukses */}
        {step === 'sukses' && result && (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Pendaftaran Berhasil! 🎉</h2>
              <p className="text-slate-500 mt-2">Nomor Registrasi Anda: <strong className="text-green-700 text-lg">#{result.id}</strong></p>
            </div>
            <Card className="border-0 shadow-sm rounded-2xl text-left">
              <CardContent className="p-5 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Nama</span><span className="font-semibold">{result.name ?? result.applicant_name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Lembaga</span><span className="font-semibold">{result.institution ?? result.school_name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Cabang Lomba</span><span className="font-semibold">{result.competition ?? selected?.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Event</span><span className="font-semibold">{result.event ?? event.name}</span></div>
              </CardContent>
            </Card>
            {isAnugerah && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
                <p className="font-bold mb-1">⚠️ Langkah Selanjutnya</p>
                <p>Pendaftaran Anda tercatat sebagai <strong>draft</strong>. Lengkapi berkas dokumen (sertifikat PKPNU, esai reflektif, dll.) melalui sistem SIMMACI atau hubungi panitia.</p>
              </div>
            )}
            {event.contact_name && (
              <p className="text-sm text-slate-500">Info lebih lanjut hubungi: <strong>{event.contact_name}</strong> ({event.contact_phone})</p>
            )}
            <Button variant="outline" onClick={() => { setStep('pilih_lomba'); setSelected(null); setResult(null); }}>
              Daftar Lomba Lain
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 pt-4 border-t">
          <p>LP Ma'arif NU PCNU Cilacap &bull; Merawat Jagad Membangun Peradaban</p>
          <p className="mt-0.5">simmaci.com</p>
        </div>
      </div>
    </div>
  );
}
