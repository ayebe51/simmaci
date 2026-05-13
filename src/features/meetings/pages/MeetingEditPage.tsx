import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, Plus, Trash2, ArrowLeft, Loader2, Search, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { useMeeting } from '../hooks/useMeeting';
import { useUpdateMeeting } from '../hooks/useMeetings';
import { schoolApi, apiClient } from '@/lib/api';
import { UpdateMeetingPayload, ParticipantInput } from '../types/meeting.types';
import { toast } from 'sonner';

/**
 * Convert a datetime-local string to ISO 8601 with timezone offset.
 * Hardcodes WIB (+07:00) since this app is for Indonesia.
 */
function toBackendDatetime(datetimeLocal: string): string {
  if (!datetimeLocal) return datetimeLocal;
  const withSeconds = datetimeLocal.length === 16 ? `${datetimeLocal}:00` : datetimeLocal;
  return `${withSeconds}+07:00`;
}

/**
 * Convert ISO 8601 datetime to datetime-local input format (YYYY-MM-DDTHH:mm).
 */
function toDatetimeLocal(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

const participantSchema = z.object({
  id: z.number().optional(),
  participant_type: z.enum(['teacher', 'headmaster', 'external']),
  participant_id: z.number().nullable(),
  name: z.string().min(1, 'Nama wajib diisi'),
  jabatan: z.string().min(1, 'Jabatan wajib diisi'),
  instansi: z.string().min(1, 'Instansi wajib diisi'),
  phone_number: z.string().min(9, 'Nomor WA tidak valid'),
});

const schema = z.object({
  title: z.string().min(1, 'Judul rapat wajib diisi'),
  agenda: z.string().optional(),
  location: z.string().min(1, 'Lokasi wajib diisi'),
  started_at: z.string().min(1, 'Waktu mulai wajib diisi'),
  ended_at: z.string().min(1, 'Waktu selesai wajib diisi'),
  school_ids: z.array(z.number()),
  geolocation_enabled: z.boolean(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  geolocation_radius_meters: z.string().optional(),
  send_reminder_wa: z.boolean(),
  reminder_timing: z.enum(['H-1', '2_hours', 'custom']).optional(),
  reminder_custom_at: z.string().optional(),
  send_invitation_wa: z.boolean(),
  participants: z.array(participantSchema).min(1, 'Minimal 1 peserta'),
}).refine(
  (data) => {
    if (!data.started_at || !data.ended_at) return true;
    return new Date(data.ended_at) > new Date(data.started_at);
  },
  { message: 'Waktu selesai harus setelah waktu mulai', path: ['ended_at'] }
);

type FormValues = z.infer<typeof schema>;

export default function MeetingEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const meetingId = Number(id);
  const updateMutation = useUpdateMeeting();
  const [schoolSearch, setSchoolSearch] = useState('');

  const { data: meeting, isLoading: meetingLoading, isError } = useMeeting(meetingId);
  const { data: schools = [], isLoading: schoolsLoading } = useQuery({
    queryKey: ['schools-autocomplete'],
    queryFn: () => schoolApi.list(),
    staleTime: 60_000,
  });

  const isDateLocked = meeting ? new Date() >= new Date(meeting.started_at) : false;

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: meeting
      ? {
          title: meeting.title,
          agenda: meeting.agenda ?? '',
          location: meeting.location,
          started_at: toDatetimeLocal(meeting.started_at),
          ended_at: toDatetimeLocal(meeting.ended_at),
          school_ids: meeting.schools?.map((s) => s.id) ?? [],
          geolocation_enabled: meeting.geolocation_enabled,
          latitude: meeting.latitude?.toString() ?? '',
          longitude: meeting.longitude?.toString() ?? '',
          geolocation_radius_meters: meeting.geolocation_radius_meters?.toString() ?? '',
          send_reminder_wa: !!meeting.reminder_scheduled_at,
          reminder_timing: 'H-1',
          reminder_custom_at: '',
          send_invitation_wa: false,
          participants: meeting.participants?.map((p) => ({
            id: p.id,
            participant_type: p.participant_type,
            participant_id: p.participant_id,
            name: p.name,
            jabatan: p.jabatan,
            instansi: p.instansi,
            phone_number: p.phone_number,
          })) ?? [],
        }
      : undefined,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'participants' });
  const geoEnabled = watch('geolocation_enabled');
  const sendReminder = watch('send_reminder_wa');
  const reminderTiming = watch('reminder_timing');
  const watchedSchoolIds = watch('school_ids');

  const [importingParticipants, setImportingParticipants] = useState(false);

  const handleImportFromSchools = async () => {
    if (!watchedSchoolIds || watchedSchoolIds.length === 0) {
      toast.error('Pilih sekolah terlebih dahulu');
      return;
    }
    setImportingParticipants(true);
    try {
      const { data } = await apiClient.post('/meetings/participants-from-schools', {
        school_ids: watchedSchoolIds,
      });
      const imported = Array.isArray(data) ? data : (data?.participants ?? []);
      const skipped = data?.skipped_count ?? 0;
      if (imported.length === 0) {
        toast.warning('Tidak ada data kepala sekolah yang ditemukan. Pastikan data kepala madrasah sudah diisi di master data sekolah (menu Kelola Sekolah → edit sekolah).');
        return;
      }
      imported.forEach((p: any) => {
        append({
          participant_type: p.participant_type,
          participant_id: p.participant_id,
          name: p.name,
          jabatan: p.jabatan,
          instansi: p.instansi,
          phone_number: p.phone_number,
        });
      });
      if (skipped > 0) {
        toast.success(`${imported.length} kepala sekolah berhasil diimpor. ${skipped} sekolah dilewati karena data kepala belum diisi.`);
      } else {
        toast.success(`${imported.length} kepala sekolah berhasil diimpor sebagai peserta`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal mengimpor peserta');
    } finally {
      setImportingParticipants(false);
    }
  };

  const onSubmit = (values: FormValues) => {
    const payload: Partial<UpdateMeetingPayload> = {
      title: values.title,
      agenda: values.agenda,
      location: values.location,
      school_ids: values.school_ids,
      geolocation_enabled: values.geolocation_enabled,
      latitude: values.latitude ? parseFloat(values.latitude) : undefined,
      longitude: values.longitude ? parseFloat(values.longitude) : undefined,
      geolocation_radius_meters: values.geolocation_radius_meters
        ? parseInt(values.geolocation_radius_meters)
        : undefined,
      participants: values.participants as ParticipantInput[],
      send_reminder_wa: values.send_reminder_wa,
      reminder_timing: values.reminder_timing,
      reminder_custom_at: values.reminder_custom_at
        ? toBackendDatetime(values.reminder_custom_at)
        : undefined,
      // Only send invitation if explicitly checked (opt-in resend)
      send_invitation_wa: values.send_invitation_wa || undefined,
    };

    // Only include dates if not locked
    if (!isDateLocked) {
      payload.started_at = toBackendDatetime(values.started_at);
      payload.ended_at = toBackendDatetime(values.ended_at);
    }

    updateMutation.mutate(
      { id: meetingId, payload },
      { onSuccess: () => navigate(`/dashboard/meetings/${meetingId}`) }
    );
  };

  if (meetingLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !meeting) {
    return (
      <Alert variant="destructive" className="max-w-3xl mx-auto">
        <AlertDescription>Gagal memuat data rapat. Silakan coba lagi.</AlertDescription>
      </Alert>
    );
  }

  // Tile & badge color maps (same as CreatePage)
  const tileColors: Record<string, { num: string; active: string }> = {
    MI:  { num: 'text-blue-700',    active: 'border-blue-400 bg-blue-50' },
    MTs: { num: 'text-emerald-700', active: 'border-emerald-500 bg-emerald-50' },
    MA:  { num: 'text-purple-700',  active: 'border-purple-400 bg-purple-50' },
    SD:  { num: 'text-orange-700',  active: 'border-orange-400 bg-orange-50' },
    SMP: { num: 'text-cyan-700',    active: 'border-cyan-400 bg-cyan-50' },
    SMA: { num: 'text-rose-700',    active: 'border-rose-400 bg-rose-50' },
    SMK: { num: 'text-pink-700',    active: 'border-pink-400 bg-pink-50' },
  };
  const defaultColor = { num: 'text-slate-700', active: 'border-slate-400 bg-slate-50' };
  const badgeColors: Record<string, string> = {
    MI:  'bg-blue-50 text-blue-700 border-blue-200',
    MTs: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    MA:  'bg-purple-50 text-purple-700 border-purple-200',
    SD:  'bg-orange-50 text-orange-700 border-orange-200',
    SMP: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    SMA: 'bg-rose-50 text-rose-700 border-rose-200',
    SMK: 'bg-pink-50 text-pink-700 border-pink-200',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/meetings/${meetingId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-emerald-600" />
            Edit Rapat
          </h1>
          <p className="text-sm text-slate-500">{meeting.title}</p>
        </div>
      </div>

      {isDateLocked && (
        <Alert>
          <AlertDescription>
            Rapat sudah dimulai atau selesai. Waktu mulai dan waktu selesai tidak dapat diubah.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Detail Rapat */}
        <Card>
          <CardHeader><CardTitle className="text-base">Detail Rapat</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Judul Rapat *</Label>
              <Input id="title" {...register('title')} />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <Label htmlFor="agenda">Agenda</Label>
              <Textarea id="agenda" {...register('agenda')} rows={3} />
            </div>
            <div>
              <Label htmlFor="location">Lokasi *</Label>
              <Input id="location" {...register('location')} />
              {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location.message}</p>}
            </div>

            {/* School selector */}
            <div>
              <Label>Sekolah / Lembaga <span className="text-slate-400 font-normal">(opsional)</span></Label>
              {schoolsLoading ? (
                <p className="text-xs text-slate-400">Memuat daftar sekolah...</p>
              ) : (
                <Controller
                  control={control}
                  name="school_ids"
                  render={({ field }) => {
                    const allIds = schools.map((s) => s.id);
                    const jenjangList = Array.from(
                      new Set(schools.map((s) => s.jenjang).filter(Boolean))
                    ).sort() as string[];
                    const byJenjang = (j: string) => schools.filter((s) => s.jenjang === j).map((s) => s.id);
                    const isJenjangActive = (j: string) => {
                      const ids = byJenjang(j);
                      return ids.length > 0 && ids.every((id) => field.value.includes(id)) && field.value.every((id) => ids.includes(id));
                    };
                    const isAllActive = allIds.length > 0 && allIds.every((id) => field.value.includes(id));
                    const tiles = [
                      { value: 'all', label: 'Semua', count: allIds.length, ids: allIds, colors: defaultColor },
                      ...jenjangList.map((j) => ({ value: j, label: j, count: byJenjang(j).length, ids: byJenjang(j), colors: tileColors[j] ?? defaultColor })),
                    ];
                    const visibleSchools = schoolSearch.trim()
                      ? schools.filter((s) => s.nama.toLowerCase().includes(schoolSearch.toLowerCase()))
                      : schools;
                    return (
                      <div className="space-y-3 mt-2">
                        <div className="flex flex-wrap gap-2">
                          {tiles.map((tile) => {
                            const active = tile.value === 'all' ? isAllActive : isJenjangActive(tile.value);
                            return (
                              <button key={tile.value} type="button"
                                onClick={() => {
                                  if (tile.value === 'all') { field.onChange(isAllActive ? [] : allIds); }
                                  else {
                                    const jIds = tile.ids;
                                    const allSelected = jIds.every((id) => field.value.includes(id));
                                    field.onChange(allSelected ? field.value.filter((id) => !jIds.includes(id)) : Array.from(new Set([...field.value, ...jIds])));
                                  }
                                }}
                                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-4 py-2.5 min-w-[72px] font-medium transition-all ${active ? tile.colors.active + ' shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                              >
                                <span className={`text-lg font-bold leading-none ${tile.colors.num}`}>{tile.count}</span>
                                <span className="text-xs mt-0.5">{tile.label}</span>
                              </button>
                            );
                          })}
                          {field.value.length > 0 && (
                            <button type="button" onClick={() => field.onChange([])}
                              className="flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-red-200 bg-red-50 px-4 py-2.5 min-w-[72px] font-medium text-red-600 hover:bg-red-100 transition-all">
                              <span className="text-lg font-bold leading-none">✕</span>
                              <span className="text-xs mt-0.5">Hapus</span>
                            </button>
                          )}
                        </div>
                        <div className="border rounded-lg bg-white overflow-hidden">
                          <div className="px-3 py-2 bg-slate-50 border-b">
                            <span className="text-xs font-medium text-slate-600">
                              {field.value.length > 0 ? `${field.value.length} dari ${schools.length} sekolah dipilih` : 'Tidak ada sekolah dipilih'}
                            </span>
                          </div>
                          <div className="px-3 py-2 border-b">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                              <input type="text" value={schoolSearch} onChange={(e) => setSchoolSearch(e.target.value)}
                                placeholder="Cari nama sekolah..."
                                className="w-full pl-8 pr-8 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                              {schoolSearch && (
                                <button type="button" onClick={() => setSchoolSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
                            {visibleSchools.map((school) => {
                              const checked = field.value.includes(school.id);
                              return (
                                <label key={school.id} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors text-sm ${checked ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                                  <input type="checkbox" className="rounded accent-emerald-600 shrink-0" checked={checked}
                                    onChange={(e) => { field.onChange(e.target.checked ? [...field.value, school.id] : field.value.filter((id) => id !== school.id)); }} />
                                  <span className="flex-1 truncate">{school.nama}</span>
                                  {school.jenjang && (
                                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded border font-medium ${badgeColors[school.jenjang] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                      {school.jenjang}
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
              )}
            </div>

            {/* Date/time — disabled if locked */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="started_at">Waktu Mulai *</Label>
                <Input id="started_at" type="datetime-local" {...register('started_at')} disabled={isDateLocked} className={isDateLocked ? 'opacity-60 cursor-not-allowed' : ''} />
                {errors.started_at && <p className="text-xs text-red-500 mt-1">{errors.started_at.message}</p>}
              </div>
              <div>
                <Label htmlFor="ended_at">Waktu Selesai *</Label>
                <Input id="ended_at" type="datetime-local" {...register('ended_at')} disabled={isDateLocked} className={isDateLocked ? 'opacity-60 cursor-not-allowed' : ''} />
                {errors.ended_at && <p className="text-xs text-red-500 mt-1">{errors.ended_at.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Geolocation */}
        <Card>
          <CardHeader><CardTitle className="text-base">Validasi Lokasi (Opsional)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Controller control={control} name="geolocation_enabled"
                render={({ field }) => (
                  <Checkbox id="geolocation_enabled" checked={field.value} onCheckedChange={field.onChange} />
                )} />
              <Label htmlFor="geolocation_enabled" className="cursor-pointer">Aktifkan validasi lokasi saat check-in</Label>
            </div>
            {geoEnabled && (
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div><Label htmlFor="latitude">Latitude</Label><Input id="latitude" {...register('latitude')} placeholder="-7.7325" /></div>
                <div><Label htmlFor="longitude">Longitude</Label><Input id="longitude" {...register('longitude')} placeholder="109.0025" /></div>
                <div><Label htmlFor="geolocation_radius_meters">Radius (meter)</Label><Input id="geolocation_radius_meters" {...register('geolocation_radius_meters')} placeholder="200" /></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reminder WA */}
        <Card>
          <CardHeader><CardTitle className="text-base">Notifikasi WhatsApp</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Controller control={control} name="send_invitation_wa"
                render={({ field }) => (
                  <Checkbox id="send_invitation_wa" checked={field.value} onCheckedChange={field.onChange} />
                )} />
              <Label htmlFor="send_invitation_wa" className="cursor-pointer">
                Kirim ulang undangan WA ke semua peserta
              </Label>
            </div>
            <p className="text-xs text-slate-500 pl-6">
              Centang ini untuk mengirim ulang undangan WA beserta QR code ke semua peserta saat menyimpan.
            </p>
            <div className="flex items-center gap-2">
              <Controller control={control} name="send_reminder_wa"
                render={({ field }) => (
                  <Checkbox id="send_reminder_wa" checked={field.value} onCheckedChange={field.onChange} />
                )} />
              <Label htmlFor="send_reminder_wa" className="cursor-pointer">Kirim reminder WA sebelum rapat</Label>
            </div>
            {sendReminder && (
              <div className="space-y-3 pl-6">
                <div>
                  <Label>Waktu Reminder</Label>
                  <Controller control={control} name="reminder_timing"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih waktu reminder" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="H-1">H-1 (24 jam sebelum)</SelectItem>
                          <SelectItem value="2_hours">2 jam sebelum</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    )} />
                </div>
                {reminderTiming === 'custom' && (
                  <div>
                    <Label htmlFor="reminder_custom_at">Waktu Reminder Custom</Label>
                    <Input id="reminder_custom_at" type="datetime-local" {...register('reminder_custom_at')} />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Peserta */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Daftar Peserta *</CardTitle>
              <div className="flex gap-2">
                <Button
                  type="button" size="sm" variant="outline"
                  onClick={handleImportFromSchools}
                  disabled={importingParticipants || !watchedSchoolIds?.length}
                  className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  {importingParticipants
                    ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    : <Users className="h-3.5 w-3.5 mr-1.5" />}
                  Import dari Sekolah
                </Button>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => append({ participant_type: 'external', participant_id: null, name: '', jabatan: '', instansi: '', phone_number: '' })}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Tambah Peserta
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {errors.participants?.root && <p className="text-xs text-red-500">{errors.participants.root.message}</p>}
            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-lg p-4 space-y-3 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Peserta {index + 1}</span>
                  {fields.length > 1 && (
                    <Button type="button" size="icon" variant="ghost"
                      className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => remove(index)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipe Peserta</Label>
                    <Controller control={control} name={`participants.${index}.participant_type`}
                      render={({ field: f }) => (
                        <Select value={f.value} onValueChange={f.onChange}>
                          <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="headmaster">Kepala Sekolah</SelectItem>
                            <SelectItem value="teacher">Guru</SelectItem>
                            <SelectItem value="external">Eksternal</SelectItem>
                          </SelectContent>
                        </Select>
                      )} />
                  </div>
                  <div>
                    <Label className="text-xs">Nama *</Label>
                    <Input className="mt-1 h-8 text-sm" {...register(`participants.${index}.name`)} placeholder="Nama lengkap" />
                    {errors.participants?.[index]?.name && <p className="text-xs text-red-500 mt-0.5">{errors.participants[index]?.name?.message}</p>}
                  </div>
                  <div>
                    <Label className="text-xs">Jabatan *</Label>
                    <Input className="mt-1 h-8 text-sm" {...register(`participants.${index}.jabatan`)} placeholder="Kepala Sekolah" />
                  </div>
                  <div>
                    <Label className="text-xs">Instansi *</Label>
                    <Input className="mt-1 h-8 text-sm" {...register(`participants.${index}.instansi`)} placeholder="MI Maarif 01 Cilacap" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Nomor WhatsApp *</Label>
                    <Input className="mt-1 h-8 text-sm" {...register(`participants.${index}.phone_number`)} placeholder="081234567890" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(`/dashboard/meetings/${meetingId}`)}>
            Batal
          </Button>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </div>
  );
}
