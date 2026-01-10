import React, { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trophy, Calendar, MapPin, ChevronRight, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function EventDetailPage() {
  const { id } = useParams();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCompetition, setNewCompetition] = useState({
      name: '',
      category: 'Olahraga',
      type: 'Individual',
      date: '',
      location: ''
  });

  const fetchEvent = () => {
      setLoading(true);
      fetch(`${API_URL}/events/${id}`)
        .then(res => res.json())
        .then(data => setEvent(data))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [isBulk, setIsBulk] = useState(false);
  const [bulkNames, setBulkNames] = useState('');
  const [saving, setSaving] = useState(false);

  // ... (useEffect remains same)

  const handleCreateCompetition = async () => {
      setSaving(true);
      try {
          if (isBulk) {
              const names = bulkNames.split('\n').filter(n => n.trim().length > 0);
              const promises = names.map(name => 
                  fetch(`${API_URL}/events/${id}/competitions`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          ...newCompetition,
                          name: name.trim(),
                          date: newCompetition.date || null, // Sanitize empty string to null
                          location: newCompetition.location || null
                      })
                  })
              );
              await Promise.all(promises);
          } else {
              await fetch(`${API_URL}/events/${id}/competitions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      ...newCompetition,
                      date: newCompetition.date || null, // Sanitize empty string to null
                      location: newCompetition.location || null
                  })
              });
          }
          
          setIsCreateOpen(false);
          setNewCompetition({ name: '', category: 'Olahraga', type: 'Individual', date: '', location: '' });
          setBulkNames('');
          setIsBulk(false);
          fetchEvent();
      } catch (error) {
          console.error(error);
      } finally {
          setSaving(false);
      }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  if (!event) return <div>Event tidak ditemukan.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{event.name}</h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
             <Calendar size={14} /> {event.date && !isNaN(new Date(event.date).getTime()) ? new Date(event.date).toLocaleDateString('id-ID', { dateStyle: 'full' }) : '-'}
             <span className="mx-2">•</span>
             <MapPin size={14} /> {event.location}
          </p>
          <p className="text-gray-600 mt-2">{event.description}</p>
        </div>
        <div className="flex gap-2">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus size={16} className="mr-2" /> Tambah Cabang Lomba
                  </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tambah Cabang Lomba</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex items-center space-x-2 pb-2 border-b">
                            <input 
                                type="checkbox" 
                                id="bulkMode" 
                                className="rounded border-gray-300"
                                checked={isBulk}
                                onChange={e => setIsBulk(e.target.checked)}
                            />
                            <label htmlFor="bulkMode" className="text-sm cursor-pointer select-none">
                                Mode Input Banyak (Bulk Insert)
                            </label>
                        </div>

                        {isBulk ? (
                             <div className="space-y-2">
                                <label className="text-sm font-medium">Daftar Nama Lomba (Satu per baris)</label>
                                <textarea 
                                    className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={bulkNames}
                                    onChange={e => setBulkNames(e.target.value)}
                                    placeholder={`Lari 100m Putri\nLari 100m Putra\nPidato Bahasa Arab\nPidato Bahasa Inggris`}
                                />
                                <p className="text-xs text-muted-foreground">Setiap baris akan menjadi satu cabang lomba dengan pengaturan yang sama di bawah ini.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nama Lomba</label>
                                <Input 
                                    value={newCompetition.name} 
                                    onChange={e => setNewCompetition({...newCompetition, name: e.target.value})}
                                    placeholder="Contoh: Lari 100m Putri"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Kategori</label>
                                <Select 
                                    value={newCompetition.category} 
                                    onValueChange={v => setNewCompetition({...newCompetition, category: v})}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Olahraga">Olahraga</SelectItem>
                                        <SelectItem value="Seni">Seni</SelectItem>
                                        <SelectItem value="Akademik">Akademik</SelectItem>
                                        <SelectItem value="Keagamaan">Keagamaan</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Jenis</label>
                                <Select 
                                    value={newCompetition.type} 
                                    onValueChange={v => setNewCompetition({...newCompetition, type: v})}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Individual">Individual</SelectItem>
                                        <SelectItem value="Beregu">Beregu</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                         <div className="space-y-2">
                            <label className="text-sm font-medium">Jadwal (Opsional)</label>
                            <Input 
                                type="datetime-local"
                                value={newCompetition.date} 
                                onChange={e => setNewCompetition({...newCompetition, date: e.target.value})}
                            />
                        </div>
                         <div className="space-y-2">
                            <label className="text-sm font-medium">Lokasi (Opsional)</label>
                            <Input 
                                value={newCompetition.location} 
                                onChange={e => setNewCompetition({...newCompetition, location: e.target.value})}
                                placeholder="Contoh: Lapangan Utama"
                            />
                        </div>
                        <Button onClick={handleCreateCompetition} className="w-full" disabled={saving}>
                            {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                            Simpan {isBulk ? 'Semua' : ''}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <Tabs defaultValue="competitions" className="space-y-4">
          <TabsList>
              <TabsTrigger value="competitions">Daftar Cabang Lomba</TabsTrigger>
              <TabsTrigger value="medals">Perolehan Medali</TabsTrigger>
          </TabsList>

          <TabsContent value="competitions" className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Trophy size={20} className="text-blue-500" /> Daftar Cabang Lomba
              </h2>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {event.competitions?.length === 0 && (
                      <div className="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                          Belum ada cabang lomba. Silakan tambahkan lomba baru.
                      </div>
                  )}
                  {event.competitions?.map((comp: any) => (
                      <Link to={`/dashboard/competitions/${comp.id}`} key={comp.id}>
                        <Card className="hover:border-blue-500 transition-colors cursor-pointer">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex justify-between">
                                    {comp.name}
                                    <ChevronRight size={16} className="text-gray-400" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2 text-xs text-gray-500 mb-4">
                                    <span className="px-2 py-1 bg-gray-100 rounded">{comp.category}</span>
                                    <span className="px-2 py-1 bg-gray-100 rounded">{comp.type}</span>
                                </div>
                                <div className="space-y-1 text-sm text-gray-600">
                                    <p className="flex items-center gap-2">
                                        <Calendar size={12} /> 
                                        {comp.date && !isNaN(new Date(comp.date).getTime())
                                            ? new Date(comp.date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) 
                                            : 'Jadwal belum diatur'}
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <MapPin size={12} />
                                        {comp.location || 'Lokasi belum diatur'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                      </Link>
                  ))}
              </div>
          </TabsContent>

          <TabsContent value="medals">
              <MedalTally eventId={id!} />
          </TabsContent>
      </Tabs>
    </div>
  );
}

function MedalTally({ eventId }: { eventId: string }) {
    const [tally, setTally] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTally = () => {
        setLoading(true);
        fetch(`${API_URL}/events/${eventId}/tally`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch');
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setTally(data);
                } else {
                    console.error("Invalid tally data", data);
                    setTally([]);
                }
            })
            .catch(err => {
                console.error(err);
                setTally([]);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchTally();
    }, [eventId]);

    if (loading) return <div className="py-8 text-center text-gray-500"><Loader2 className="animate-spin inline mr-2" /> Memuat data medali...</div>;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Klasemen Perolehan Medali</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchTally}>
                    🔄 Refresh
                </Button>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="h-12 px-4 text-left font-medium text-gray-500">Peringkat</th>
                                <th className="h-12 px-4 text-left font-medium text-gray-500">Lembaga / Sekolah</th>
                                <th className="h-12 px-4 text-center font-medium text-yellow-600">Emas</th>
                                <th className="h-12 px-4 text-center font-medium text-gray-600">Perak</th>
                                <th className="h-12 px-4 text-center font-medium text-orange-600">Perunggu</th>
                                <th className="h-12 px-4 text-center font-medium text-gray-900">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tally.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="h-24 text-center text-gray-500">Belum ada data perolehan medali.</td>
                                </tr>
                            ) : (
                                tally.map((item, index) => (
                                    <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                                        <td className="p-4 font-medium">{index + 1}</td>
                                        <td className="p-4">{item.institution}</td>
                                        <td className="p-4 text-center font-bold text-yellow-600">{item.gold}</td>
                                        <td className="p-4 text-center font-bold text-gray-600">{item.silver}</td>
                                        <td className="p-4 text-center font-bold text-orange-600">{item.bronze}</td>
                                        <td className="p-4 text-center font-bold">{item.total}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
