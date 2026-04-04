import React, { useEffect, useState } from 'react';
import { eventApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle, Trash2, Calendar, MapPin, Plus } from "lucide-react"

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Custom Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
        const data = await eventApi.list();
        setEvents(data);
    } catch (e) {
        console.error(e);
        toast.error("Gagal memuat event");
    } finally {
        setIsLoading(false);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
      e.preventDefault();
      setEventToDelete({ id, name });
      setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
      if (!eventToDelete) return;
      try {
          setIsDeleting(true);
          await eventApi.delete(eventToDelete.id as any);
          toast.success(`Event "${eventToDelete.name}" berhasil dihapus`);
          setIsDeleteDialogOpen(false);
          setEventToDelete(null);
          loadEvents();
      } catch (e) {
          toast.error("Gagal menghapus event");
      } finally {
          setIsDeleting(false);
      }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manajemen Lomba / Event</h1>
        <Link to="/dashboard/events/new">
          <Button className="flex items-center gap-2">
            <Plus size={16} />
            Buat Event Baru
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <Link to={`/dashboard/events/${event.id}`} key={event.id} className="block group">
            <Card className="hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 cursor-pointer h-full relative border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl overflow-hidden rounded-2xl z-10 hover:-translate-y-1">
              <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[60%] bg-blue-400/10 blur-[50px] pointer-events-none rounded-full" />
              <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[60%] bg-indigo-400/10 blur-[50px] pointer-events-none rounded-full" />
              <CardHeader className="relative z-10 pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 bg-blue-100/50 text-blue-800 rounded-full backdrop-blur-sm">
                      {event.category}
                    </span>
                    <CardTitle className="mt-3 text-lg font-bold text-slate-800">{event.name}</CardTitle>
                  </div>
                  <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full backdrop-blur-sm shadow-sm ${
                    event.status === 'OPEN' ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-200/50' : 'bg-slate-100/80 text-slate-700 border border-slate-200/50'
                  }`}>
                    {event.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 pt-2">
                <div className="space-y-2.5 text-sm text-slate-600">
                  <div className="flex items-center gap-2 bg-white/40 p-1.5 rounded-lg w-fit pr-3">
                    <div className="bg-blue-100/50 p-1 rounded-md">
                        <Calendar size={14} className="text-blue-600" />
                    </div>
                    <span className="font-medium text-xs">{new Date(event.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/40 p-1.5 rounded-lg w-fit pr-3">
                    <div className="bg-amber-100/50 p-1 rounded-md">
                        <MapPin size={14} className="text-amber-600" />
                    </div>
                    <span className="font-medium text-xs truncate max-w-[200px]">{event.location}</span>
                  </div>
                  <p className="line-clamp-2 mt-3 text-xs leading-relaxed text-slate-500 bg-white/30 p-3 rounded-xl border border-white/50">{event.description}</p>
                </div>
              </CardContent>

              {/* Delete Button - Visible on Hover */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="h-8 w-8 rounded-full shadow-lg hover:bg-red-700 hover:scale-110 active:scale-95 transition-all"
                    onClick={(e) => handleDelete(e, event.id, event.name)}
                  >
                      <Trash2 className="h-4 w-4" />
                  </Button>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3 text-red-600 mb-2">
                <div className="p-2 bg-red-50 rounded-full">
                    <Trash2 className="h-6 w-6" />
                </div>
                <DialogTitle className="text-xl font-bold">Hapus Event</DialogTitle>
            </div>
          </DialogHeader>
          <div className="py-2">
            <p className="text-muted-foreground text-sm leading-relaxed">
              Apakah Anda yakin ingin menghapus event:
            </p>
            <p className="font-bold text-lg mt-1 text-slate-800">
              {eventToDelete?.name}
            </p>
            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-xs text-red-800 font-bold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> PERHATIAN
                </p>
                <p className="text-[11px] text-red-700 mt-1 leading-normal">
                   Menghapus event akan menghapus seluruh data kompetisi dan peserta di dalamnya secara permanen.
                </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 shadow-sm"
            >
              {isDeleting ? "Menghapus..." : "Ya, Hapus Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
