import React, { useEffect, useState } from 'react';
import { eventApi } from '@/lib/api';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Trophy, Calendar, MapPin, ChevronRight, Loader2,
  Users, Video, Award, Edit, ClipboardList,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import MedalTally from './components/MedalTally';
import AnugerahRegistrationList from './components/AnugerahRegistrationList';

const LOMBA_TYPES = [
  { value: 'mars_maarif',         label: 'Mars Ma\'arif NU', jenjang: 'MTs/SMP,MA/SMA/SMK' },
  { value: 'mtq_pa',              label: 'MTQ Putra',        jenjang: 'MI/SD,MTs/SMP,MA/SMA/SMK' },
  { value: 'mtq_pi',              label: 'MTQ Putri',        jenjang: 'MI/SD,MTs/SMP,MA/SMA/SMK' },
  { value: 'puji_pujian',         label: 'Puji-Pujian Jawa', jenjang: 'MI/SD' },
  { value: 'film_dokumenter',     label: 'Film Dokumenter NU', jenjang: 'MTs/SMP,MA/SMA/SMK' },
  { value: 'guru_berprestasi',    label: 'Guru Berprestasi', jenjang: 'MI/SD,MTs/SMP,MA/SMA/SMK' },
  { value: 'madrasah_berprestasi',label: 'Madrasah/Sekolah Berprestasi', jenjang: 'MI/SD,MTs/SMP,MA/SMA/SMK' },
  { value: 'oskanu',              label: 'OSKANU Lolos Provinsi', jenjang: 'MI/SD,MTs/SMP,MA/SMA/SMK' },
  { value: 'lainnya',             label: 'Lainnya / Umum',   jenjang: '' },
];

const STATUS_COLORS: Record<string, string> = {
  OPEN:     'bg-emerald-100 text-emerald-800 border-emerald-200',
  CLOSED:   'bg-slate-100 text-slate-700 border-slate-200',
  FINISHED: 'bg-blue-100 text-blue-800 border-blue-200',
};

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newComp, setNewComp] = useState({
    name: '', category: 'Keagamaan', type: 'Individual',
    jenjang: '', lomba_type: '', date: '', location: '',
    deadline: '', max_per_school: '',
  });

  const fetchEvent = async () => {
    setLoading(true);
    try {
      const data = await eventApi.get(Number(id));
      setEvent(data);
    } catch {
      toast.error('Gagal memuat data event');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvent(); }, [id]);

  const handleLombaTypeChange = (val: string) => {
    const found = LOMBA_TYPES.find(l => l.value === val);
    setNewComp(p => ({
      ...p,
      lomba_type: val,
      name: found ? found.label : p.name,
      jenjang: found ? found.jenjang : p.jenjang,
      category: val.startsWith('mtq') || val === 'mars_maarif' || val === 'puji_pujian' || val === 'film_dokumenter'
        ? 'Keagamaan'
        : val === 'guru_berprestasi' || val === 'madrasah_berprestasi'
          ? 'Akademik'
          : p.category,
      type: val === 'mars_maarif' || val === 'puji_pujian' || val === 'film_dokumenter' || val === 'madrasah_berprestasi'
        ? 'Beregu'
        : 'Individual',
    }));
  };

  const handleCreate = async () => {
    if (!newComp.name.trim()) { toast.error('Nama lomba wajib diisi'); return; }
    setSaving(true);
    try {
      await eventApi.competitions.create(Number(id), {
        ...newComp,
        date: newComp.date || null,
        deadline: newComp.deadline || null,
        max_per_school: newComp.max_per_school ? Number(newComp.max_per_school) : null,
      });
      toast.success('Cabang lomba berhasil ditambahkan');
      setIsCreateOpen(false);
      setNewComp({ name: '', category: 'Keagamaan', type: 'Individual', jenjang: '', lomba_type: '', date: '', location: '', deadline: '', max_per_school: '' });
      fetchEvent();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Gagal menambah cabang lomba');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-slate-400" /></div>;
  if (!event)  return <div className="p-8 text-center text-slate-500">Event tidak ditemukan.</div>;

  const hasFestival  = event.competitions?.some((c: any) => ['mars_maarif','mtq_pa','mtq_pi','puji_pujian','film_dokumenter'].includes(c.lomba_type));
  const hasAnugerah  = event.competitions?.some((c: any) => ['guru_berprestasi','madrasah_berprestasi'].includes(c.lomba_type));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge className={`text-[10px] font-bold uppercase ${STATUS_COLORS[event.status] ?? STATUS_COLORS.OPEN}`}>
              {event.status}
            </Badge>
            <span className="text-xs font-bold text-slate-400 uppercase">{event.category}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">{event.name}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500">
            {event.date && <span className="flex items-center gap-1"><Calendar size={14}/>{new Date(event.date).toLocaleDateString('id-ID',{dateStyle:'full'})}</span>}
            {event.location && <span className="flex items-center gap-1"><MapPin size={14}/>{event.location}</span>}
          </div>
          {event.description && <p className="mt-2 text-sm text-slate-600 max-w-2xl">{event.description}</p>}
          {/* Juknis dates */}
          <div className="flex flex-wrap gap-3 mt-3">
            {event.registration_start && (
              <div className="text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                <span className="font-bold text-green-700">Pendaftaran:</span>
                <span className="ml-1 text-green-600">
                  {new Date(event.registration_start).toLocaleDateString('id-ID',{day:'numeric',month:'short'})} – {event.registration_end ? new Date(event.registration_end).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : '?'}
                </span>
              </div>
            )}
            {event.video_deadline && (
              <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <span className="font-bold text-amber-700">Batas Video:</span>
                <span className="ml-1 text-amber-600">{new Date(event.video_deadline).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</span>
              </div>
            )}
            {event.announcement_date && (
              <div className="text-xs bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
                <span className="font-bold text-purple-700">Pengumuman:</span>
                <span className="ml-1 text-purple-600">{new Date(event.announcement_date).toLocaleDateString('id-ID',{dateStyle:'medium'})} {event.announcement_place ? `di ${event.announcement_place}` : ''}</span>
              </div>
            )}
            {event.contact_name && (
              <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <span className="font-bold text-slate-700">Kontak:</span>
                <span className="ml-1 text-slate-600">{event.contact_name} {event.contact_phone ? `(${event.contact_phone})` : ''}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/events/${id}/edit`)}>
            <Edit size={14} className="mr-1.5"/> Edit Event
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus size={14} className="mr-1.5"/> Tambah Cabang Lomba</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Tambah Cabang Lomba</DialogTitle></DialogHeader>
              <AddCompetitionForm comp={newComp} setComp={setNewComp} onLombaTypeChange={handleLombaTypeChange} onSave={handleCreate} saving={saving} onCancel={() => setIsCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="competitions">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="competitions" className="gap-1.5"><Trophy size={14}/>Cabang Lomba ({event.competitions?.length ?? 0})</TabsTrigger>
          {hasFestival  && <TabsTrigger value="festival"  className="gap-1.5"><Video size={14}/>Festival Aswaja</TabsTrigger>}
          {hasAnugerah  && <TabsTrigger value="anugerah"  className="gap-1.5"><Award size={14}/>Anugerah Pendidikan</TabsTrigger>}
          <TabsTrigger value="medals" className="gap-1.5"><Award size={14}/>Perolehan Medali</TabsTrigger>
        </TabsList>

        <TabsContent value="competitions" className="mt-4">
          <CompetitionGrid competitions={event.competitions ?? []} />
        </TabsContent>

        {hasFestival && (
          <TabsContent value="festival" className="mt-4">
            <FestivalGrid competitions={(event.competitions ?? []).filter((c: any) =>
              ['mars_maarif','mtq_pa','mtq_pi','puji_pujian','film_dokumenter'].includes(c.lomba_type)
            )} />
          </TabsContent>
        )}

        {hasAnugerah && (
          <TabsContent value="anugerah" className="mt-4">
            <AnugerahRegistrationList eventId={Number(id)} competitions={(event.competitions ?? []).filter((c: any) =>
              ['guru_berprestasi','madrasah_berprestasi'].includes(c.lomba_type)
            )} />
          </TabsContent>
        )}

        <TabsContent value="medals" className="mt-4">
          <MedalTally eventId={Number(id)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CompetitionGrid({ competitions }: { competitions: any[] }) {
  if (competitions.length === 0)
    return (
      <div className="text-center py-16 text-slate-400 border-2 border-dashed rounded-2xl">
        <Trophy size={32} className="mx-auto mb-3 opacity-40" />
        <p className="font-medium">Belum ada cabang lomba.</p>
        <p className="text-sm mt-1">Klik "Tambah Cabang Lomba" untuk memulai.</p>
      </div>
    );

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {competitions.map((comp: any) => (
        <Link to={`/dashboard/competitions/${comp.id}`} key={comp.id}>
          <Card className="hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer rounded-2xl border-0 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex flex-wrap gap-1 mb-1">
                  <Badge variant="secondary" className="text-[9px] font-bold uppercase">{comp.category}</Badge>
                  {comp.lomba_type && <Badge className="text-[9px] font-bold uppercase bg-green-100 text-green-800 hover:bg-green-100">{comp.lomba_type.replace(/_/g,' ')}</Badge>}
                </div>
                <ChevronRight size={16} className="text-slate-300 mt-1 flex-shrink-0"/>
              </div>
              <CardTitle className="text-base font-bold text-slate-800 leading-tight">{comp.name}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Users size={12}/>{comp.participants_count ?? 0} peserta</span>
                {comp.jenjang && <span className="bg-slate-100 px-2 py-0.5 rounded-full">{comp.jenjang}</span>}
              </div>
              {comp.deadline && (
                <p className="mt-2 text-[10px] text-amber-600 font-semibold">
                  Batas: {new Date(comp.deadline).toLocaleString('id-ID',{dateStyle:'short',timeStyle:'short'})}
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function FestivalGrid({ competitions }: { competitions: any[] }) {
  const FESTIVAL_INFO: Record<string, { icon: string; desc: string }> = {
    mars_maarif:     { icon: '🎼', desc: 'Paduan Suara 8–15 orang, backing track karaoke, Batik Ma\'arif NU' },
    mtq_pa:          { icon: '📖', desc: 'Perorangan Putra, maqra\' bebas, live record' },
    mtq_pi:          { icon: '📖', desc: 'Perorangan Putri, maqra\' bebas, live record' },
    puji_pujian:     { icon: '🕌', desc: 'Kelompok 3–5 anak MI/SD, syi\'iran Jawa tradisi pesantren' },
    film_dokumenter: { icon: '🎬', desc: 'Tim maks 5 orang, full HD 1080p, tema tokoh/tradisi NU' },
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-800">
        <p className="font-bold mb-1">📋 Ketentuan Umum Festival Aswaja</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Video harus baru, orisinal, belum dipublikasikan/dilombakan sebelumnya</li>
          <li>Pengambilan video: live record, tanpa lip sync, tanpa auto-tune</li>
          <li>Kirim link Google Drive (akses publik) via formulir: <strong>s.id/Harlah97MaarifCilacap</strong></li>
        </ul>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {competitions.map((comp: any) => {
          const info = FESTIVAL_INFO[comp.lomba_type] ?? { icon: '🏆', desc: '' };
          return (
            <Link to={`/dashboard/competitions/${comp.id}`} key={comp.id}>
              <Card className="hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer rounded-2xl border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-2xl mb-1">{info.icon}</div>
                  <CardTitle className="text-base font-bold text-slate-800">{comp.name}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <p className="text-xs text-slate-500 leading-relaxed">{info.desc}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 text-slate-500"><Users size={12}/>{comp.participants_count ?? 0} peserta</span>
                    {comp.jenjang && <Badge variant="outline" className="text-[9px] py-0">{comp.jenjang}</Badge>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function AddCompetitionForm({ comp, setComp, onLombaTypeChange, onSave, saving, onCancel }: any) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase text-slate-500">Tipe Lomba (Preset)</Label>
        <Select value={comp.lomba_type} onValueChange={onLombaTypeChange}>
          <SelectTrigger><SelectValue placeholder="Pilih preset atau isi manual..."/></SelectTrigger>
          <SelectContent>
            {LOMBA_TYPES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase text-slate-500">Nama Lomba *</Label>
        <Input value={comp.name} onChange={e => setComp((p: any) => ({...p, name: e.target.value}))} placeholder="Nama cabang lomba..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase text-slate-500">Kategori</Label>
          <Select value={comp.category} onValueChange={v => setComp((p: any) => ({...p, category: v}))}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="Keagamaan">Keagamaan</SelectItem>
              <SelectItem value="Akademik">Akademik</SelectItem>
              <SelectItem value="Seni">Seni</SelectItem>
              <SelectItem value="Olahraga">Olahraga</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase text-slate-500">Tipe</Label>
          <Select value={comp.type} onValueChange={v => setComp((p: any) => ({...p, type: v}))}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="Individual">Individual</SelectItem>
              <SelectItem value="Beregu">Beregu / Tim</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase text-slate-500">Jenjang</Label>
        <Input value={comp.jenjang} onChange={e => setComp((p: any) => ({...p, jenjang: e.target.value}))} placeholder="MI/SD, MTs/SMP, MA/SMA/SMK" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase text-slate-500">Batas Pendaftaran</Label>
          <Input type="datetime-local" value={comp.deadline} onChange={e => setComp((p: any) => ({...p, deadline: e.target.value}))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase text-slate-500">Maks. Peserta/Sekolah</Label>
          <Input type="number" min="1" value={comp.max_per_school} onChange={e => setComp((p: any) => ({...p, max_per_school: e.target.value}))} placeholder="—" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} className="flex-1">Batal</Button>
        <Button onClick={onSave} disabled={saving} className="flex-1">
          {saving ? <Loader2 size={14} className="animate-spin mr-2"/> : null} Simpan
        </Button>
      </div>
    </div>
  );
}
