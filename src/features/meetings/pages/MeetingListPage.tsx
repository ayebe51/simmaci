import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { CalendarDays, Plus, Search, Eye, Users, MapPin, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMeetings, useDeleteMeeting } from '../hooks/useMeetings';
import { Meeting, MeetingStatus, MeetingListParams } from '../types/meeting.types';

const statusLabel: Record<MeetingStatus, string> = {
  upcoming: 'Akan Datang',
  ongoing: 'Berlangsung',
  completed: 'Selesai',
};

const statusVariant: Record<MeetingStatus, 'default' | 'secondary' | 'outline'> = {
  upcoming: 'default',
  ongoing: 'secondary',
  completed: 'outline',
};

const statusColor: Record<MeetingStatus, string> = {
  upcoming: 'bg-blue-100 text-blue-700 border-blue-200',
  ongoing: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function MeetingListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MeetingStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user_data') || '{}'); } catch { return {}; }
  })();
  const isAdmin = ['super_admin', 'admin_yayasan'].includes(user?.role);

  const params: MeetingListParams = {
    search: search || undefined,
    status: status === 'all' ? undefined : status,
    page,
    per_page: 20,
  };

  const { data, isLoading, isError } = useMeetings(params);
  const deleteMutation = useDeleteMeeting();
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);

  const meetings = data?.data ?? [];
  const lastPage = data?.last_page ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-emerald-600" />
            Rapat Yayasan
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola rapat dan absensi peserta LP Ma'arif NU Cilacap
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => navigate('/dashboard/meetings/create')}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Buat Rapat
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari judul rapat..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => { setStatus(v as MeetingStatus | 'all'); setPage(1); }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="upcoming">Akan Datang</SelectItem>
                <SelectItem value="ongoing">Berlangsung</SelectItem>
                <SelectItem value="completed">Selesai</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6 space-y-3">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-center text-red-500">
            Gagal memuat daftar rapat. Silakan coba lagi.
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && meetings.length === 0 && (
        <Card>
          <CardContent className="pt-10 pb-10 text-center text-slate-500">
            <CalendarDays className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Belum ada rapat</p>
            {isAdmin && (
              <p className="text-sm mt-1">
                Klik "Buat Rapat" untuk membuat rapat pertama.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && meetings.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meetings.map((meeting) => (
            <Card
              key={meeting.id}
              className="hover:shadow-md transition-shadow cursor-pointer border-slate-200"
              onClick={() => navigate(`/dashboard/meetings/${meeting.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold text-slate-800 leading-snug line-clamp-2">
                    {meeting.title}
                  </CardTitle>
                  <span
                    className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusColor[meeting.status]}`}
                  >
                    {statusLabel[meeting.status]}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>
                    {format(new Date(meeting.started_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{meeting.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>
                    {meeting.attendance_stats?.present ?? 0} / {meeting.attendance_stats?.total ?? 0} hadir
                    {meeting.attendance_stats?.total > 0 && (
                      <span className="ml-1 text-emerald-600 font-medium">
                        ({meeting.attendance_stats.percentage}%)
                      </span>
                    )}
                  </span>
                </div>
                <div className="pt-1 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/dashboard/meetings/${meeting.id}`);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    Lihat Detail
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(meeting);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Sebelumnya
          </Button>
          <span className="flex items-center text-sm text-slate-600 px-3">
            Halaman {page} dari {lastPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Rapat</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus rapat{' '}
              <strong>"{deleteTarget?.title}"</strong>? Semua data peserta dan
              absensi akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
