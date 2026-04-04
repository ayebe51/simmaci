import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { verificationApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, XCircle, ArrowLeft, Loader2, GraduationCap } from "lucide-react";

export default function VerifyStudentPage() {
  const { nisn } = useParams<{ nisn: string }>();
  
  // 🔥 REST API QUERY
  const { data: verificationResponse, isLoading, error } = useQuery({
    queryKey: ['verify', 'student', nisn],
    queryFn: () => nisn ? verificationApi.verifyByNisn(nisn) : null,
    enabled: !!nisn
  });

  const student = verificationResponse?.data;
  const isSuccess = verificationResponse?.success;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Memvalidasi NISN...</p>
        </div>
      </div>
    );
  }

  if (!isSuccess || !student) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-2xl rounded-[2rem] overflow-hidden">
          <CardHeader className="text-center pb-2 pt-10">
            <div className="mx-auto bg-red-50 w-20 h-20 rounded-3xl flex items-center justify-center mb-6">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-black text-slate-800">DATA TIDAK DITEMUKAN</CardTitle>
            <CardDescription className="text-sm px-8 pt-2 leading-relaxed">
              Peserta didik dengan NISN <strong>{nisn}</strong> tidak terdaftar dalam database resmi PC LP Ma'arif NU Cilacap.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 flex justify-center border-t border-slate-50 mt-4">
             <Link to="/" className="text-xs font-black text-slate-400 hover:text-slate-800 flex items-center gap-2 uppercase tracking-widest transition-colors">
                <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
             </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 py-12">
      <Card className="max-w-md w-full border-0 shadow-2xl rounded-[2.5rem] overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
        <CardHeader className="text-center pt-12 pb-6 bg-white">
          <div className="mx-auto bg-blue-50 w-24 h-24 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm ring-4 ring-blue-50/50">
            <GraduationCap className="w-12 h-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-black text-slate-800 tracking-tight uppercase">SISWA RESMI VALID</CardTitle>
          <div className="mt-2 text-[10px] font-black tracking-[0.2em] text-blue-600 bg-blue-50 inline-block px-5 py-2 rounded-full uppercase">
            PESERTA DIDIK AKTIF TERDAFTAR
          </div>
        </CardHeader>
        <CardContent className="bg-white p-8 space-y-6 pt-2">
            <div className="space-y-6">
               <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Nama Lengkap Peserta Didik</p>
                    <p className="text-lg font-black text-slate-800 leading-tight">{student.nama}</p>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-6">
                   <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">NISN / ID SISWA</p>
                       <p className="font-mono text-sm font-bold text-slate-700 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl inline-block">{student.nisn || "-"}</p>
                   </div>
                   <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">NIK SISTEM</p>
                       <p className="font-mono text-sm font-bold text-slate-700 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl inline-block">
                           {student.nik ? `***${student.nik.slice(-4)}` : "-"}
                       </p>
                   </div>
               </div>
               <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Instansi Pendidikan</p>
                   <p className="font-bold text-slate-700 text-base">{student.school?.nama || student.nama_sekolah || "-"}</p>
               </div>
               {student.kelas && (
                   <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Rombongan Belajar</p>
                       <p className="text-sm font-bold text-slate-800 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl inline-block">KELAS {student.kelas}</p>
                   </div>
               )}
            </div>

            <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col items-center text-center">
                <img src="/logo-maarif-hijau.png" alt="Logo" className="h-14 w-auto mb-4 grayscale opacity-30" />
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  SIMMACI CLOUD VERIFICATION<br/>PC LP MA'ARIF NU CILACAP
                </p>
                <p className="text-[9px] text-slate-300 mt-4 font-mono">
                  TIMESTAMP: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
