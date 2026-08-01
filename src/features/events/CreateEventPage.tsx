import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Trophy, Calendar, MapPin, Info } from 'lucide-react';
import { useMutation } from "@tanstack/react-query";
import { eventApi } from "@/lib/api";
import { toast } from "sonner";

// Pre-fill for Anugerah Pendidikan Harlah LP Ma'arif ke-97
const PRESET_ANUGERAH = {
  name: 'Anugerah Pendidikan & Festival Aswaja LP Ma\'arif NU Cilacap 2026',
  category: 'Anugerah Pendidikan',
  type: 'Individual',
  date: '2026-09-22',
  location: 'Inn ASTON Hotel Cilacap',
  description: 'Penyelenggaraan Anugerah Guru Berprestasi, Madrasah/Sekolah Berprestasi, dan Festival Aswaja Siswa dalam rangka Harlah LP Ma\'arif NU ke-97 Tahun 2026.',
  status: 'OPEN',
  registration_start: '2026-08-01',
  registration_end: '2026-09-07',
  video_deadline: '2026-09-11T23:59',
  announcement_date: '2026-09-22',
  announcement_place: 'Inn ASTON Hotel Cilacap',
  contact_name: 'Umar Fatoni',
  contact_phone: '082324900550',
};

export default function CreateEventPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', category: '', type: 'Individual', date: '', location: '',
    description: '', status: 'OPEN',
    registration_start: '', registration_end: '', video_deadline: '',
    announcement_date: '', announcement_place: '',
    contact_name: '', contact_phone: '',
  });

  const setF = (key: string, val: string) => setForm(p => ({...p, [key]: val}));

  const mutation = useMutation({
    mutationFn: (data: any) => eventApi.create(data),
    onSuccess: (res) => {
      toast.success('Event berhasil dibuat');
      navigate(`/dashboard/events/${res.id ?? res.data?.id}`);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Gagal membuat event'),
  });

  const handlePreset = () => setForm(PRESET_ANUGERAH);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Normalize datetime-local format (2026-09-11T23:59) to full datetime (2026-09-11 23:59:00)
    const normalizeDateTime = (val: string) => {
      if (!val) return null;
      return val.replace('T', ' ') + (val.length === 16 ? ':00' : '');
    };
    mutation.mutate({
      ...form,
      video_deadline:     normalizeDateTime(form.video_deadline),
      registration_start: form.registration_start || null,
      registration_end:   form.registration_end || null,
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl"><ArrowLeft size={16}/></Button>
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2"><Trophy size={20} className="text-amber-500"/> Buat Event Baru</h1>
          <p className="text-xs text-slate-500">Lomba, festival, atau anugerah pendidikan</p>
        </div>
      </div>

      {/* Preset button for Harlah */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-start gap-3">
        <Info size={16} className="text-green-600 flex-shrink-0 mt-0.5"/>
        <div className="flex-1">
          <p className="text-sm font-bold text-green-800">Preset: Anugerah Pendidikan Harlah LP Ma'arif NU ke-97</p>
          <p className="text-xs text-green-600 mt-0.5">Isi otomatis data sesuai Juknis resmi 2026</p>
        </div>
        <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-100 flex-shrink-0" onClick={handlePreset}>
          Gunakan Preset
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-sm font-bold uppercase text-slate-600">Informasi Utama</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Nama Event / Lomba *</Label>
              <Input required value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Anugerah Pendidikan Ma'arif NU Cilacap 2026" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Kategori *</Label>
                <Input required value={form.category} onChange={e => setF('category', e.target.value)} placeholder="Anugerah Pendidikan / Festival" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Status</Label>
                <Select value={form.status} onValueChange={v => setF('status', v)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">OPEN</SelectItem>
                    <SelectItem value="CLOSED">CLOSED</SelectItem>
                    <SelectItem value="FINISHED">FINISHED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1"><Calendar size={11}/>Tanggal Pelaksanaan *</Label>
                <Input type="date" required value={form.date} onChange={e => setF('date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1"><MapPin size={11}/>Lokasi</Label>
                <Input value={form.location} onChange={e => setF('location', e.target.value)} placeholder="Inn ASTON Hotel Cilacap" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Deskripsi</Label>
              <Textarea value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Keterangan event..." className="min-h-[80px]"/>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-2xl mt-4">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-sm font-bold uppercase text-slate-600">Jadwal & Kontak (Juknis)</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Mulai Pendaftaran</Label>
                <Input type="date" value={form.registration_start} onChange={e => setF('registration_start', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Tutup Pendaftaran</Label>
                <Input type="date" value={form.registration_end} onChange={e => setF('registration_end', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Batas Akhir Pengiriman Video</Label>
              <Input type="datetime-local" value={form.video_deadline} onChange={e => setF('video_deadline', e.target.value)} />
              <p className="text-[10px] text-slate-400">Festival Aswaja: Jum'at, 11 September 2026 pukul 23.59 WIB</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Tanggal Pengumuman</Label>
                <Input type="date" value={form.announcement_date} onChange={e => setF('announcement_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Tempat Pengumuman</Label>
                <Input value={form.announcement_place} onChange={e => setF('announcement_place', e.target.value)} placeholder="Inn ASTON Hotel" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Nama Kontak</Label>
                <Input value={form.contact_name} onChange={e => setF('contact_name', e.target.value)} placeholder="Umar Fatoni" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-500">No. HP Kontak</Label>
                <Input value={form.contact_phone} onChange={e => setF('contact_phone', e.target.value)} placeholder="082324900550" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Batal</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 size={14} className="animate-spin mr-1.5"/>}
            Buat Event
          </Button>
        </div>
      </form>
    </div>
  );
}
