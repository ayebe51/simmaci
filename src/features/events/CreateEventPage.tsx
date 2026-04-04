import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { Loader2, Calendar, MapPin, Trophy, Layout, ShieldCheck, ArrowLeft, Sparkles, Zap } from 'lucide-react';
import { useMutation } from "@tanstack/react-query";
import { eventApi } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CreateEventPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    type: 'Individual',
    date: '',
    location: '',
    description: '',
  });

  const createEventMutation = useMutation({
    mutationFn: (data: any) => eventApi.create(data),
    onSuccess: () => {
        toast.success("Event successfully cataloged in systemic registry.");
        navigate('/dashboard/events');
    },
    onError: (error: any) => {
        toast.error(error.response?.data?.message || "Internal failure during event creation.");
        setLoading(false);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    createEventMutation.mutate(formData);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Premium Header */}
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-14 w-14 rounded-2xl bg-white shadow-sm border border-slate-50 hover:bg-slate-50">
                  <ArrowLeft className="h-5 w-5 text-slate-600" />
              </Button>
              <div className="flex flex-col gap-1">
                  <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic leading-none flex items-center gap-3">
                      <Trophy className="w-8 h-8 text-amber-500" /> Inisiasi Event Baru
                  </h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 italic">
                      <Sparkles className="w-3 h-3 text-blue-500" /> Digital competition node creation
                  </p>
              </div>
          </div>
          <div className="h-14 px-8 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-3 shadow-sm">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Protocol Secured</span>
          </div>
      </div>

      <Card className="border-0 shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-10 border-b bg-slate-50/50">
          <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest italic flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" /> Parameter Lomba / Acara
          </CardTitle>
          <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Definisikan spesifikasi teknis untuk node event ini.</CardDescription>
        </CardHeader>
        <CardContent className="p-10">
          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nama Event / Lomba</Label>
              <Input
                required
                className="h-14 rounded-2xl border-slate-100 bg-slate-50/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-slate-800 placeholder:text-slate-300 px-6"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: PORSENI MADRASAH KABUPATEN"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-2">
                    <Layout className="w-3 h-3" /> Kategori
                </Label>
                <Input 
                   required
                   className="h-14 rounded-2xl border-slate-100 bg-slate-50/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-slate-800 px-6"
                   value={formData.category}
                   onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                   placeholder="OLAH RAGA / SENI"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Tipe Peserta</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => setFormData({ ...formData, type: val })}
                >
                  <SelectTrigger className="h-14 rounded-2xl border-slate-100 bg-slate-50/30 focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-slate-800 px-6">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100 p-2">
                    <SelectItem value="Individual" className="rounded-xl py-3 font-bold text-xs uppercase">Individu / Perorangan</SelectItem>
                    <SelectItem value="Team" className="rounded-xl py-3 font-bold text-xs uppercase">Tim / Beregu Cluster</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Tanggal Pelaksanaan
                </Label>
                <Input
                  type="date"
                  required
                  className="h-14 rounded-2xl border-slate-100 bg-slate-50/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-slate-800 px-6"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-2">
                    <MapPin className="w-3 h-3" /> Alokasi Lokasi
                </Label>
                <Input
                  className="h-14 rounded-2xl border-slate-100 bg-slate-50/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-slate-800 px-6"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Titik infrastruktur pelaksanaan"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Narasi Deskripsi / Keterangan</Label>
              <Textarea
                className="min-h-[120px] rounded-[2rem] border-slate-100 bg-slate-50/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-slate-800 px-6 py-6"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Rincian tambahan mengenai node event ini..."
              />
            </div>

            <div className="flex justify-end gap-6 pt-6">
              <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="h-14 px-10 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400">
                Cancel System
              </Button>
              <Button type="submit" disabled={loading} className="h-14 px-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95">
                {loading ? <Loader2 className="animate-spin h-5 w-5 mr-3" /> : <Save className="h-5 w-5 mr-3" />}
                Dispatch Event Node
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <div className="p-8 bg-amber-600 rounded-[2.5rem] shadow-xl shadow-amber-100 text-white relative overflow-hidden group/alert">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/alert:rotate-12 transition-transform duration-700">
               <Trophy className="w-32 h-32 -mr-16 -mt-16" />
           </div>
           <h3 className="font-black uppercase italic tracking-tight mb-2 flex items-center gap-2">
               <ShieldCheck className="w-5 h-5 text-amber-200" /> Data Integrity Clause
           </h3>
           <p className="text-[10px] font-bold uppercase opacity-80 leading-relaxed max-w-xl">Semua data event yang dikirimkan akan diverifikasi oleh sistem pusat untuk memastikan sinkronisasi data antar sekolah tetap akurat dan konsisten.</p>
      </div>
    </div>
  );
}

function Save({ className }: { className?: string }) {
    return <Zap className={className} />
}
