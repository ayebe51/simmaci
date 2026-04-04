import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Phone, MapPin, User, Users, GraduationCap, Building2, UserCheck, Loader2, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from "@tanstack/react-query";
import { schoolApi, teacherApi, studentApi } from "@/lib/api";

export default function SchoolDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // 🔥 REST API QUERIES
  const { data: school, isLoading: isLoadingSchool } = useQuery({
    queryKey: ['school-detail', id],
    queryFn: () => schoolApi.get(parseInt(id!)),
    enabled: !!id
  });

  const { data: teachersRes, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ['school-teachers', id],
    queryFn: () => teacherApi.list({ school_id: id, per_page: 500 }),
    enabled: !!id
  });

  const { data: studentsRes, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['school-students', id],
    queryFn: () => studentApi.list({ school_id: id, per_page: 500 }),
    enabled: !!id
  });

  const teachers = teachersRes?.data || [];
  const activeTeachers = teachers.filter((t: any) => t.is_active);
  const inactiveTeachers = teachers.filter((t: any) => !t.is_active);
  const certifiedTeachers = teachers.filter((t: any) => t.is_certified);

  const totalTeachers = teachers.length;
  const certifiedPercentage = totalTeachers > 0 ? Math.round((certifiedTeachers.length / totalTeachers) * 100) : 0;
  const activePercentage = totalTeachers > 0 ? Math.round((activeTeachers.length / totalTeachers) * 100) : 0;

  const students = studentsRes?.data || [];
  const totalStudents = students.length;

  if (isLoadingSchool) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center animate-bounce">
            <Building2 className="w-6 h-6 text-emerald-600" />
        </div>
        <p className="text-sm font-semibold text-slate-400 animate-pulse">Memuat Profil Lembaga...</p>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-800">Lembaga Tidak Ditemukan</h2>
            <p className="text-sm text-slate-500 mt-2">Data madrasah yang Anda cari mungkin telah dihapus.</p>
        </div>
        <Button onClick={() => navigate('/dashboard/master/schools')} className="h-14 px-10 rounded-2xl border-slate-200 font-black uppercase text-[10px] tracking-widest shadow-lg">
            <ArrowLeft className="h-4 w-4 mr-2" /> Return to Cluster
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard/master/schools')} className="mt-1 text-slate-600 hover:text-slate-900 transition-colors font-medium">
            <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
        <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">{school.nama}</h1>
            <p className="text-sm font-medium text-slate-400 mt-1">NSM: {school.nsm}</p>
        </div>
      </div>

      {/* Informasi Madrasah */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Kolom Kiri: Info Utama */}
        <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-sm rounded-3xl overflow-hidden bg-white/80 backdrop-blur-md">
                <CardContent className="p-8">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Profil Lembaga</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* NSM */}
                        <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 flex flex-col gap-1 transition-all hover:bg-slate-50">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nomor Statistik (NSM)</span>
                            <div className="font-bold text-slate-800 text-lg">{school.nsm}</div>
                        </div>

                        {/* NPSN */}
                        <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 flex flex-col gap-1 transition-all hover:bg-slate-50">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">NPSN</span>
                            <div className="font-bold text-slate-800 text-lg">{school.npsn || '-'}</div>
                        </div>

                        {/* Alamat LENGKAP */}
                        <div className="sm:col-span-2 bg-slate-50/50 p-5 rounded-3xl border border-slate-100 flex flex-col gap-2 transition-all hover:bg-slate-50">
                            <div className="flex items-center gap-1.5 text-slate-400">
                                <MapPin className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-widest">Alamat Lengkap</span>
                            </div>
                            <div className="font-medium text-slate-700 leading-relaxed text-sm">
                                {school.alamat || 'Alamat belum diisi.'}
                            </div>
                        </div>

                        {/* Kecamatan */}
                        <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 flex flex-col gap-1 transition-all hover:bg-slate-50">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kecamatan</span>
                            <div className="font-bold text-slate-800">{school.kecamatan || '-'}</div>
                        </div>
                        
                        {/* Kelurahan */}
                        <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 flex flex-col gap-1 transition-all hover:bg-slate-50">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Desa / Kelurahan</span>
                            <div className="font-bold text-slate-800">{school.desa_kelurahan || '-'}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full transition-transform group-hover:scale-150 duration-500 ease-out" />
                    <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center mb-4 relative z-10 text-blue-600">
                        <Users className="w-5 h-5" />
                    </div>
                    <div className="text-3xl font-black text-slate-800 relative z-10">{totalTeachers}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1 relative z-10">Total Guru</div>
                    <div className="text-[10px] text-slate-500 mt-2 bg-slate-50 px-2 py-1 rounded-lg w-fit relative z-10 font-medium">
                        {activeTeachers.length} Aktif • {inactiveTeachers.length} Non-aktif
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full transition-transform group-hover:scale-150 duration-500 ease-out" />
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center mb-4 relative z-10 text-amber-600">
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="text-3xl font-black text-slate-800 relative z-10">{totalStudents}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1 relative z-10">Total Siswa</div>
                    <div className="text-[10px] text-amber-600 mt-2 bg-amber-50 px-2 py-1 rounded-lg w-fit relative z-10 font-bold">
                        Peserta Didik Aktif
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full transition-transform group-hover:scale-150 duration-500 ease-out" />
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4 relative z-10 text-emerald-600">
                        <GraduationCap className="w-5 h-5" />
                    </div>
                    <div className="text-3xl font-black text-slate-800 relative z-10">{certifiedTeachers.length}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1 relative z-10">Sertifikasi</div>
                    <div className="text-[10px] text-emerald-600 mt-2 bg-emerald-50 px-2 py-1 rounded-lg w-fit relative z-10 font-bold">
                        {certifiedPercentage}% dari Total
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-50 rounded-full transition-transform group-hover:scale-150 duration-500 ease-out" />
                    <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center mb-4 relative z-10 text-purple-600">
                        <UserCheck className="w-5 h-5" />
                    </div>
                    <div className="text-3xl font-black text-slate-800 relative z-10">{activeTeachers.length}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1 relative z-10">Guru Aktif</div>
                    <div className="text-[10px] text-purple-600 mt-2 bg-purple-50 px-2 py-1 rounded-lg w-fit relative z-10 font-bold">
                        {activePercentage}% Kehadiran
                    </div>
                </div>
            </div>
        </div>

        {/* Kolom Kanan: Info Kepemimpinan & Status */}
        <div className="space-y-6">
            <Card className="border-0 shadow-sm rounded-3xl overflow-hidden bg-white/80 backdrop-blur-md">
                <CardContent className="p-8">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Kepemimpinan</h3>
                    <div className="flex items-center gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-100 mb-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <div className="font-bold text-slate-800">{school.kepala_madrasah || 'Belum diisi'}</div>
                            <div className="text-xs font-medium text-slate-500 mt-0.5">Kepala Madrasah</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0 text-green-600">
                            <Phone className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">No. Telepon / HP</div>
                            <div className="font-bold text-slate-700 mt-0.5">{school.telepon || '-'}</div>
                        </div>
                    </div>

                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-8 mb-4">Status & Izin</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center bg-slate-50/80 p-4 py-3 rounded-2xl border border-slate-100">
                            <span className="text-sm font-semibold text-slate-600">Terakreditasi</span>
                            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-sm shadow-sm ring-4 ring-emerald-50">
                                {school.akreditasi || '-'}
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center bg-slate-50/80 p-4 py-3 rounded-2xl border border-slate-100">
                            <span className="text-sm font-semibold text-slate-600">Status Jamiyyah</span>
                            <Badge variant="outline" className="rounded-xl bg-orange-50 text-orange-700 border-none font-bold px-3 shadow-none">
                                {school.status_jamiyyah || '-'}
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      {/* Daftar Guru & Tenaga Kependidikan */}
      {/* Daftar Guru & Tenaga Kependidikan */}
      <Card className="border-0 shadow-sm rounded-3xl overflow-hidden bg-white/80 backdrop-blur-md">
        <CardContent className="p-8">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Daftar Guru & Tenaga Kependidikan</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">Staf pendidik yang terdaftar di database lembaga ini</p>
                </div>
            </div>
            
            {isLoadingTeachers ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-50 flex items-center justify-center animate-pulse">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                    <span className="font-bold text-slate-400">Sinkronisasi Data Guru...</span>
                </div>
            ) : teachers.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                        <Users className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">Belum Ada Tenaga Pendidik</h3>
                    <p className="text-sm text-slate-500 font-medium max-w-sm mt-1">
                        Data guru untuk madrasah ini masih kosong. Silakan masuk ke menu Guru untuk mengimpor atau menambahkan data guru.
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/80">
                            <TableRow className="border-b border-slate-100 hover:bg-transparent">
                                <TableHead className="py-5 px-6 font-bold text-xs text-slate-500 uppercase tracking-widest">Identitas Dasar</TableHead>
                                <TableHead className="py-5 px-6 font-bold text-xs text-slate-500 uppercase tracking-widest">Tugas Pokok</TableHead>
                                <TableHead className="py-5 px-6 font-bold text-xs text-slate-500 uppercase tracking-widest">Sertifikasi & Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teachers.map((t: any) => (
                                <TableRow key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                    <TableCell className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{t.nama}</span>
                                            <span className="text-xs font-medium text-slate-400 mt-1 tracking-wide">{t.nuptk || t.nip || 'Tanpa Identitas'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-5">
                                        <div className="text-sm font-semibold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl w-fit border border-slate-100">
                                            {t.tugas_utama || t.mata_pelajaran || '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-5">
                                        <div className="flex flex-wrap gap-2">
                                            {t.is_certified && (
                                                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-none px-2.5 py-1 rounded-lg text-xs font-bold shadow-none">
                                                    Sertifikasi
                                                </Badge>
                                            )}
                                            {t.is_active ? (
                                                <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none px-2.5 py-1 rounded-lg text-xs font-bold shadow-none">
                                                    Aktif
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-100 border-none px-2.5 py-1 rounded-lg text-xs font-bold shadow-none">
                                                    Non-Aktif
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                  </div>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
