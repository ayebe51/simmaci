import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Phone, MapPin, User, Users, GraduationCap, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from "convex/react";
import { api as convexApi } from "../../../convex/_generated/api";

interface Teacher {
  id: string;
  nip: string;
  nama: string;
  status: string;
  mapel: string;
  sertifikasi: boolean;
  isActive: boolean;
  phoneNumber?: string;
  kecamatan?: string;
}

interface School {
  id: string;
  nsm: string;
  npsn: string;
  nama: string;
  alamat: string;
  kecamatan: string;
  kepala: string;
  noHpKepala?: string;
  statusJamiyyah?: string;
  akreditasi?: string;
  status?: string;
}

export default function SchoolDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Get current user for RBAC
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  // Use Convex real-time queries
  const schoolData = useQuery(convexApi.schools.get, id ? { id: id as any } : "skip");
  const teachersData = useQuery(convexApi.teachers.list, { 
    unitKerja: schoolData?.nama,
    token: localStorage.getItem("token") || undefined
  });

  const loading = schoolData === undefined;
  
  // Map Convex data to School interface
  const school = schoolData ? {
    id: schoolData._id,
    nsm: schoolData.nsm || "",
    npsn: schoolData.npsn || "",
    nama: schoolData.nama || "",
    alamat: schoolData.alamat || "",
    kecamatan: schoolData.kecamatan || "",
    kepala: schoolData.kepalaMadrasah || "",
    noHpKepala: schoolData.telepon || "",
    statusJamiyyah: schoolData.statusJamiyyah || "",
    akreditasi: schoolData.akreditasi || "",
  } : null;

  // Map teachers data
  const teachers = (teachersData || []).map((t: any) => ({
    id: t._id,
    nip: t.nip || t.nuptk || "",
    nama: t.nama || "",
    status: t.status || "",
    mapel: t.mapel || "",
    sertifikasi: t.isCertified || false,
    isActive: t.isActive ?? true,
    phoneNumber: t.phoneNumber,
    kecamatan: t.kecamatan,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Madrasah Tidak Ditemukan</h2>
          <p className="text-muted-foreground mb-4">Data madrasah yang Anda cari tidak tersedia</p>
          <Button onClick={() => navigate('/dashboard/master/schools')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Kembali ke Daftar
          </Button>
        </div>
      </div>
    );
  }

  const activeTeachers = teachers.filter(t => t.isActive);
  const certifiedTeachers = teachers.filter(t => t.sertifikasi);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/master/schools')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{school.nama}</h1>
          <p className="text-sm text-muted-foreground">NSM: {school.nsm}</p>
        </div>
      </div>

      {/* School Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Informasi Madrasah
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <dt className="text-sm font-medium text-muted-foreground mb-1">NSM</dt>
              <dd className="text-base font-semibold">{school.nsm}</dd>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <dt className="text-sm font-medium text-muted-foreground mb-1">NPSN</dt>
              <dd className="text-base font-semibold">{school.npsn || '-'}</dd>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 md:col-span-2">
              <dt className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Alamat
              </dt>
              <dd className="text-base">{school.alamat}</dd>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <dt className="text-sm font-medium text-muted-foreground mb-1">Kecamatan</dt>
              <dd className="text-base font-semibold">{school.kecamatan}</dd>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <dt className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <User className="h-3 w-3" /> Kepala Sekolah
              </dt>
              <dd className="text-base font-semibold">{school.kepala || '-'}</dd>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <dt className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Phone className="h-3 w-3" /> No HP Kepala
              </dt>
              <dd className="text-base font-mono">{school.noHpKepala || '-'}</dd>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <dt className="text-sm font-medium text-muted-foreground mb-1">Status Jamiyyah</dt>
              <dd className="text-base">
                <Badge variant="outline">{school.statusJamiyyah || '-'}</Badge>
              </dd>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <dt className="text-sm font-medium text-muted-foreground mb-1">Akreditasi</dt>
              <dd className="text-base">
                <Badge variant="default">{school.akreditasi || '-'}</Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Guru & Tendik</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teachers.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeTeachers.length} aktif, {teachers.length - activeTeachers.length} non-aktif
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Guru Bersertifikat</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{certifiedTeachers.length}</div>
            <p className="text-xs text-muted-foreground">
              {teachers.length > 0 ? ((certifiedTeachers.length / teachers.length) * 100).toFixed(0) : 0}% dari total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Guru Aktif</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTeachers.length}</div>
            <p className="text-xs text-muted-foreground">
              {teachers.length > 0 ? ((activeTeachers.length / teachers.length) * 100).toFixed(0) : 0}% dari total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Teachers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Guru & Tenaga Kependidikan</CardTitle>
          <p className="text-sm text-muted-foreground">
            Guru yang terdaftar di {school.nama}
          </p>
        </CardHeader>
        <CardContent>
          {teachers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Belum ada data guru untuk madrasah ini
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NUPTK/NIP</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mapel</TableHead>
                    <TableHead className="text-center">Sertifikasi</TableHead>
                    <TableHead className="text-center">Status Aktif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map(teacher => (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-mono text-sm">{teacher.nip}</TableCell>
                      <TableCell className="font-medium">{teacher.nama}</TableCell>
                      <TableCell>{teacher.status}</TableCell>
                      <TableCell>{teacher.mapel || '-'}</TableCell>
                      <TableCell className="text-center">
                        {teacher.sertifikasi ? (
                          <Badge variant="default" className="bg-green-600">Ya</Badge>
                        ) : (
                          <Badge variant="secondary">Belum</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {teacher.isActive ? (
                          <Badge variant="default">Aktif</Badge>
                        ) : (
                          <Badge variant="destructive">Non-Aktif</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
