import React, { useEffect, useState } from 'react';
import { eventApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle, Trash2, Calendar, MapPin, Plus, Trophy, Users, Video, Award } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  OPEN:     'bg-emerald-100 text-emerald-800 border-emerald-200',
  CLOSED:   'bg-slate-100 text-slate-700 border-slate-200',
  FINISHED: 'bg-blue-100 text-blue-800 border-blue-200',
};

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<{id: number, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    try {
      const data = await eventApi.list();
      setEvents(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      toast.error("Gagal memuat event");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: number, name: string) => {
    e.preventDefault();
    setEventToDelete({ id, name });
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;
    try {
      setIsDeleting(true);
      await eventApi.delete(eventToDelete.id);
      toast.success(`Event "${eventToDelete.name}" berhasil dihapus`);
      setIsDeleteDialogOpen(false);
      setEventToDelete(null);
      loadEvents();
    } catch {
      toast.error("Gagal menghapus event");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Manajemen Lomba / Event</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola Anugerah Pendidikan & Festival Aswaja LP Ma'arif NU</p>
        </div>
        <Link to="/dashboard/events/new">
          <Button className="flex items-center gap-2">
            <Plus size={16} /> Buat Event Baru
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-52 bg-slate-100 rounded-2xl animate-pulse"/>)}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 text-slate-400 border-2 border-dashed rounded-2xl">
          <Trophy size={40} className="mx-auto mb-3 opacity-30"/>
          <p className="font-medium">Belum ada event.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const compCount    = event.competitions?.length ?? 0;
            const hasFestival  = event.competitions?.some((c: any) => ['mars_maarif','mtq_pa','mtq_pi','puji_pujian','film_dokumenter'].includes(c.lomba_type));
            const hasAnugerah  = event.competitions?.some((c: any) => ['guru_berprestasi','madrasah_berprestasi'].includes(c.lomba_type));
            return (
              <Link to={`/dashboard/events/${event.id}`} key={event.id} className="block group">
                <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer h-full relative border-0 shadow-sm bg-white/80 backdrop-blur-sm overflow-hidden rounded-2xl hover:-translate-y-0.5">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">{event.category}</span>
                          <Badge className={`text-[9px] font-bold uppercase border ${STATUS_COLORS[event.status] ?? STATUS_COLORS.OPEN} hover:${STATUS_COLORS[event.status]}`}>
                            {event.status ?? 'OPEN'}
                          </Badge>
                        </div>
                        <CardTitle className="text-base font-bold text-slate-800 leading-snug">{event.name}</CardTitle>
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0 ml-1"
                        onClick={(e) => handleDelete(e, event.id, event.name)}
                      >
                        <Trash2 size={13}/>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2.5">
                    <div className="space-y-1.5 text-xs text-slate-600">
                      {event.date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-blue-500 flex-shrink-0"/>
                          {new Date(event.date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})}
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} className="text-amber-500 flex-shrink-0"/>
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Juknis dates */}
                    {event.registration_end && (
                      <div className="text-[10px] bg-green-50 border border-green-100 rounded-lg px-2 py-1 text-green-700">
                        <span className="font-bold">Daftar s.d.</span> {new Date(event.registration_end).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}
                      </div>
                    )}

                    {/* Cabang lomba pills */}
                    {compCount > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                          <Trophy size={10}/> {compCount} cabang
                        </span>
                        {hasFestival && (
                          <span className="flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 rounded-full px-2 py-0.5">
                            <Video size={10}/> Festival
                          </span>
                        )}
                        {hasAnugerah && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                            <Award size={10}/> Anugerah
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3 text-red-600 mb-2">
              <div className="p-2 bg-red-50 rounded-full"><Trash2 className="h-5 w-5" /></div>
              <DialogTitle className="text-lg font-bold">Hapus Event</DialogTitle>
            </div>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-slate-600">Apakah Anda yakin ingin menghapus event: <strong>{eventToDelete?.name}</strong>?</p>
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-xs text-red-700 flex items-center gap-1.5"><AlertTriangle size={12}/> Seluruh data cabang lomba, peserta, dan hasil akan dihapus permanen.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 border-t pt-4">
            <Button variant="ghost" size="sm" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Batal</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? "Menghapus..." : "Ya, Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
