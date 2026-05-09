import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateMeeting } from '../hooks/useMeetings';
import { CreateMeetingPayload, ParticipantInput } from '../types/meeting.types';

const participantSchema = z.object({
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
  geolocation_enabled: z.boolean(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  geolocation_radius_meters: z.string().optional(),
  send_invitation_wa: z.boolean(),
  send_reminder_wa: z.boolean(),
  reminder_timing: z.enum(['H-1', '2_hours', 'custom']).optional(),
  reminder_at: z.string().optional(),
  participants: z.array(participantSchema).min(1, 'Minimal 1 peserta'),
});

type FormValues = z.infer<typeof schema>;

export default function MeetingCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateMeeting();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      geolocation_enabled: false,
      send_invitation_wa: false,
      send_reminder_wa: false,
      participants: [
        { participant_type: 'external', participant_id: null, name: '', jabatan: '', instansi: '', phone_number: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'participants' });

  const geoEnabled = watch('geolocation_enabled');
  const sendReminder = watch('send_reminder_wa');
  const reminderTiming = watch('reminder_timing');

  const onSubmit = (values: FormValues) => {
    const payload: CreateMeetingPayload = {
      title: values.title,
      agenda: values.agenda,
      location: values.location,
      started_at: new Date(values.started_at).toISOString(),
      ended_at: new Date(values.ended_at).toISOString(),
      school_ids: [],
      geolocation_enabled: values.geolocation_enabled,
      latitude: values.latitude ? parseFloat(values.latitude) : undefined,
      longitude: values.longitude ? parseFloat(values.longitude) : undefined,
      geolocation_radius_meters: values.geolocation_radius_meters
        ? parseInt(values.geolocation_radius_meters)
        : undefined,
      participants: values.participants as ParticipantInput[],
      send_invitation_wa: values.send_invitation_wa,
      send_reminder_wa: values.send_reminder_wa,
      reminder_timing: values.reminder_timing,
      reminder_at: values.reminder_at ? new Date(values.reminder_at).toISOString() : undefined,
    };

    createMutation.mutate(payload, {
      onSuccess: (data) => navigate(`/dashboard/meetings/${data.id}`),
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/meetings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-emerald-600" />
            Buat Rapat Baru
          </h1>
          <p className="text-sm text-slate-500">Isi detail rapat dan daftar peserta</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Detail Rapat */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detail Rapat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Judul Rapat *</Label>
              <Input id="title" {...register('title')} placeholder="Rapat Koordinasi Kepala Sekolah" />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <Label htmlFor="agenda">Agenda</Label>
              <Textarea id="agenda" {...register('agenda')} placeholder="Pembahasan program semester genap..." rows={3} />
            </div>

            <div>
              <Label htmlFor="location">Lokasi *</Label>
              <Input id="location" {...register('location')} placeholder="Aula LP Ma'arif NU Cilacap" />
              {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="started_at">Waktu Mulai *</Label>
                <Input id="started_at" type="datetime-local" {...register('started_at')} />
                {errors.started_at && <p className="text-xs text-red-500 mt-1">{errors.started_at.message}</p>}
              </div>
              <div>
                <Label htmlFor="ended_at">Waktu Selesai *</Label>
                <Input id="ended_at" type="datetime-local" {...register('ended_at')} />
                {errors.ended_at && <p className="text-xs text-red-500 mt-1">{errors.ended_at.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Geolocation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Validasi Lokasi (Opsional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="geolocation_enabled"
                render={({ field }) => (
                  <Checkbox
                    id="geolocation_enabled"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="geolocation_enabled" className="cursor-pointer">
                Aktifkan validasi lokasi saat check-in
              </Label>
            </div>

            {geoEnabled && (
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div>
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input id="latitude" {...register('latitude')} placeholder="-7.7325" />
                </div>
                <div>
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input id="longitude" {...register('longitude')} placeholder="109.0025" />
                </div>
                <div>
                  <Label htmlFor="geolocation_radius_meters">Radius (meter)</Label>
                  <Input id="geolocation_radius_meters" {...register('geolocation_radius_meters')} placeholder="200" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* WA Blast */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifikasi WhatsApp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="send_invitation_wa"
                render={({ field }) => (
                  <Checkbox id="send_invitation_wa" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="send_invitation_wa" className="cursor-pointer">
                Kirim undangan WA ke semua peserta setelah rapat dibuat
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="send_reminder_wa"
                render={({ field }) => (
                  <Checkbox id="send_reminder_wa" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="send_reminder_wa" className="cursor-pointer">
                Kirim reminder WA sebelum rapat
              </Label>
            </div>

            {sendReminder && (
              <div className="space-y-3 pl-6">
                <div>
                  <Label>Waktu Reminder</Label>
                  <Controller
                    control={control}
                    name="reminder_timing"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Pilih waktu reminder" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="H-1">H-1 (24 jam sebelum)</SelectItem>
                          <SelectItem value="2_hours">2 jam sebelum</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                {reminderTiming === 'custom' && (
                  <div>
                    <Label htmlFor="reminder_at">Waktu Reminder Custom</Label>
                    <Input id="reminder_at" type="datetime-local" {...register('reminder_at')} />
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  append({ participant_type: 'external', participant_id: null, name: '', jabatan: '', instansi: '', phone_number: '' })
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Tambah Peserta
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {errors.participants?.root && (
              <p className="text-xs text-red-500">{errors.participants.root.message}</p>
            )}
            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-lg p-4 space-y-3 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Peserta {index + 1}</span>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipe Peserta</Label>
                    <Controller
                      control={control}
                      name={`participants.${index}.participant_type`}
                      render={({ field: f }) => (
                        <Select value={f.value} onValueChange={f.onChange}>
                          <SelectTrigger className="mt-1 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="headmaster">Kepala Sekolah</SelectItem>
                            <SelectItem value="teacher">Guru</SelectItem>
                            <SelectItem value="external">Eksternal</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Nama *</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      {...register(`participants.${index}.name`)}
                      placeholder="Nama lengkap"
                    />
                    {errors.participants?.[index]?.name && (
                      <p className="text-xs text-red-500 mt-0.5">{errors.participants[index]?.name?.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Jabatan *</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      {...register(`participants.${index}.jabatan`)}
                      placeholder="Kepala Sekolah"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Instansi *</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      {...register(`participants.${index}.instansi`)}
                      placeholder="MI Maarif 01 Cilacap"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Nomor WhatsApp *</Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      {...register(`participants.${index}.phone_number`)}
                      placeholder="081234567890"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate('/dashboard/meetings')}>
            Batal
          </Button>
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Buat Rapat
          </Button>
        </div>
      </form>
    </div>
  );
}
