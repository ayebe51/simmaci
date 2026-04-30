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
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/dashboard/master/schools')} 
          className="self-start sm:self-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all font-semibold rounded-xl px-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
        <div className="flex flex-col">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">{school.nama}</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1.5">NSM: {school.nsm}</p>
        </div>
      </div>

      {/* Informasi Madrasah */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Kolom Kiri: Info Utama */}
        <div className="lg:col-span-2">
            <Card className="border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden bg-white h-full">
                <CardContent className="p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-xl font-black text-slate-900">Profil Lembaga</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* NSM */}
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 p-5 rounded-xl border border-slate-200/60 flex flex-col gap-2 transition-all hover:shadow-md hover:border-slate-300">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nomor Statistik (NSM)</span>
                            <div className="font-black text-slate-900 text-lg">{school.nsm}</div>
                        </div>

                        {/* NPSN */}
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 p-5 rounded-xl border border-slate-200/60 flex flex-col gap-2 transition-all hover:shadow-md hover:border-slate-300">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">NPSN</span>
                            <div className="font-black text-slate-900 text-lg">{school.npsn || '-'}</div>
                        </div>

                        {/* Alamat LENGKAP */}
                        <div className="sm:col-span-2 bg-gradient-to-br from-slate-50 to-slate-100/50 p-5 rounded-xl border border-slate-200/60 flex flex-col gap-2.5 transition-all hover:shadow-md hover:border-slate-300">
                            <div className="flex items-center gap-2 text-slate-500">
                                <MapPin className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Alamat Lengkap</span>
                            </div>
                            <div className="font-semibold text-slate-800 leading-relaxed text-sm">
                                {school.alamat || 'Alamat belum diisi.'}
                            </div>
                        </div>

                        {/* Kecamatan */}
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 p-5 rounded-xl border border-slate-200/60 flex flex-col gap-2 transition-all hover:shadow-md hover:border-slate-300">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kecamatan</span>
                            <div className="font-black text-slate-900">{school.kecamatan || '-'}</div>
                        </div>
                        
                        {/* Kelurahan */}
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 p-5 rounded-xl border border-slate-200/60 flex flex-col gap-2 transition-all hover:shadow-md hover:border-slate-300">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Desa / Kelurahan</span>
                            <div className="font-black text-slate-900">{school.desa_kelurahan || '-'}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Kolom Kanan: Info Kepemimpinan & Status */}
        <div className="space-y-6">
            <Card className="border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden bg-white h-full">
                <CardContent className="p-6 sm:p-8">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Kepemimpinan</h3>
                    <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-4 bg-gradient-to-br from-slate-50 to-slate-100/50 p-5 rounded-xl border border-slate-200/60 hover:shadow-md transition-all">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
                                <User className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-black text-slate-900 text-sm truncate">{school.kepala_madrasah || 'Belum diisi'}</div>
                                <div className="text-xs font-semibold text-slate-500 mt-1">Kepala Madrasah</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-gradient-to-br from-slate-50 to-slate-100/50 p-5 rounded-xl border border-slate-200/60 hover:shadow-md transition-all">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0 text-white shadow-lg shadow-green-500/20">
                                <Phone className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No. Telepon / HP</div>
                                <div className="font-black text-slate-900 mt-1 truncate">{school.telepon || '-'}</div>
                            </div>
                        </div>
                    </div>

                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Status & Izin</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center bg-gradient-to-br from-slate-50 to-slate-100/50 p-5 rounded-xl border border-slate-200/60 hover:shadow-md transition-all">
                            <span className="text-sm font-bold text-slate-700">Terakreditasi</span>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center font-black text-base shadow-lg shadow-emerald-500/30">
                                {school.akreditasi || '-'}
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center bg-gradient-to-br from-slate-50 to-slate-100/50 p-5 rounded-xl border border-slate-200/60 hover:shadow-md transition-all">
                            <span className="text-sm font-bold text-slate-700">Status Jamiyyah</span>
                            <Badge className="rounded-lg bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800 border-none font-black px-3 py-1.5 shadow-sm hover:shadow-md transition-all">
                                {school.status_jamiyyah || '-'}
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      {/* Stats Cards Row - Full Width */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Guru */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                    <div className="absolute -right-6 -top-6 w-28 h-28 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-full transition-transform group-hover:scale-125 duration-500 ease-out opacity-60" />
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 relative z-10 text-white shadow-lg shadow-blue-500/30">
                        <Users className="w-5 h-5" />
                    </div>
                    <div className="text-3xl font-black text-slate-900 relative z-10 mb-1">{totalTeachers}</div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest relative z-10 mb-3">Total Guru</div>
                    <div className="text-[11px] text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg w-fit relative z-10 font-semibold border border-slate-200/60">
                        {activeTeachers.length} Aktif • {inactiveTeachers.length} Non-aktif
                    </div>
                </div>

                {/* Total Siswa */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                    <div className="absolute -right-6 -top-6 w-28 h-28 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-full transition-transform group-hover:scale-125 duration-500 ease-out opacity-60" />
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-4 relative z-10 text-white shadow-lg shadow-amber-500/30">
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="text-3xl font-black text-slate-900 relative z-10 mb-1">{totalStudents}</div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest relative z-10 mb-3">Total Siswa</div>
                    <div className="text-[11px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg w-fit relative z-10 font-bold border border-amber-200/60">
                        Peserta Didik Aktif
                    </div>
                </div>

                {/* Sertifikasi */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                    <div className="absolute -right-6 -top-6 w-28 h-28 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-full transition-transform group-hover:scale-125 duration-500 ease-out opacity-60" />
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-4 relative z-10 text-white shadow-lg shadow-emerald-500/30">
                        <GraduationCap className="w-5 h-5" />
                    </div>
                    <div className="text-3xl font-black text-slate-900 relative z-10 mb-1">{certifiedTeachers.length}</div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest relative z-10 mb-3">Sertifikasi</div>
                    <div className="text-[11px] text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg w-fit relative z-10 font-bold border border-emerald-200/60">
                        {certifiedPercentage}% dari Total
                    </div>
                </div>

                {/* Guru Aktif */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                    <div className="absolute -right-6 -top-6 w-28 h-28 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-full transition-transform group-hover:scale-125 duration-500 ease-out opacity-60" />
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4 relative z-10 text-white shadow-lg shadow-purple-500/30">
                        <UserCheck className="w-5 h-5" />
                    </div>
                    <div className="text-3xl font-black text-slate-900 relative z-10 mb-1">{activeTeachers.length}</div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest relative z-10 mb-3">Guru Aktif</div>
                    <div className="text-[11px] text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg w-fit relative z-10 font-bold border border-purple-200/60">
                        {activePercentage}% Kehadiran
                    </div>
                </div>
      </div>

      {/* Daftar Guru & Tenaga Kependidikan */}
      <Card className="border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-6 sm:p-8">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900">Daftar Guru & Tenaga Kependidikan</h2>
                    <p className="text-sm font-semibold text-slate-500 mt-1.5">Staf pendidik yang terdaftar di database lembaga ini</p>
                </div>
            </div>
            
            {isLoadingTeachers ? (
                <div className="py-24 flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center animate-pulse shadow-lg">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                    <span className="font-bold text-slate-500 animate-pulse">Sinkronisasi Data Guru...</span>
                </div>
            ) : teachers.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center text-center bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border-2 border-dashed border-slate-300">
                    <div className="w-20 h-20 rounded-2xl bg-white shadow-lg flex items-center justify-center mb-5 border border-slate-200">
                        <Users className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-black text-slate-800">Belum Ada Tenaga Pendidik</h3>
                    <p className="text-sm text-slate-600 font-semibold max-w-md mt-2 leading-relaxed">
                        Data guru untuk madrasah ini masih kosong. Silakan masuk ke menu <span className="font-black text-indigo-600">Guru</span> untuk mengimpor atau menambahkan data guru.
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gradient-to-r from-slate-50 to-slate-100/50">
                            <TableRow className="border-b border-slate-200 hover:bg-transparent">
                                <TableHead className="py-4 px-6 font-black text-[10px] text-slate-600 uppercase tracking-widest">Identitas Dasar</TableHead>
                                <TableHead className="py-4 px-6 font-black text-[10px] text-slate-600 uppercase tracking-widest">Tugas Pokok</TableHead>
                                <TableHead className="py-4 px-6 font-black text-[10px] text-slate-600 uppercase tracking-widest">Sertifikasi & Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teachers.map((t: any) => (
                                <TableRow key={t.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                                    <TableCell className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">{t.nama}</span>
                                            <span className="text-xs font-semibold text-slate-500 mt-1.5 tracking-wide">{t.nuptk || t.nip || 'Tanpa Identitas'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-5">
                                        <div className="text-sm font-bold text-slate-800 bg-gradient-to-br from-slate-50 to-slate-100/50 px-4 py-2 rounded-lg w-fit border border-slate-200">
                                            {t.tugas_utama || t.mata_pelajaran || '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-5">
                                        <div className="flex flex-wrap gap-2">
                                            {t.is_certified && (
                                                <Badge className="bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-800 hover:from-emerald-200 hover:to-emerald-300 border-none px-3 py-1 rounded-lg text-xs font-black shadow-sm">
                                                    Sertifikasi
                                                </Badge>
                                            )}
                                            {t.is_active ? (
                                                <Badge className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800 hover:from-blue-200 hover:to-blue-300 border-none px-3 py-1 rounded-lg text-xs font-black shadow-sm">
                                                    Aktif
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-gradient-to-br from-rose-100 to-rose-200 text-rose-800 hover:from-rose-200 hover:to-rose-300 border-none px-3 py-1 rounded-lg text-xs font-black shadow-sm">
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
