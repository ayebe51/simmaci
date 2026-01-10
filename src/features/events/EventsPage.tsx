import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, MapPin, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
        const data = await api.getEvents();
        setEvents(data);
    } catch (e) {
        console.error(e);
        toast.error("Gagal memuat event");
    } finally {
        setIsLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
      e.preventDefault(); // Prevent Link navigation
      if (!confirm("Hapus event ini?")) return;

      try {
          await api.deleteEvent(id);
          toast.success("Event dihapus");
          loadEvents();
      } catch (e) {
          toast.error("Gagal menghapus event");
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
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                      {event.category}
                    </span>
                    <CardTitle className="mt-2 text-lg">{event.name}</CardTitle>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    event.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {event.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    <span>{new Date(event.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    <span>{event.location}</span>
                  </div>
                  <p className="line-clamp-2 mt-2">{event.description}</p>
                </div>
              </CardContent>

              {/* Delete Button - Visible on Hover */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="h-8 w-8 rounded-full shadow-md"
                    onClick={(e) => handleDelete(e, event.id)}
                  >
                      <Trash2 className="h-4 w-4" />
                  </Button>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
