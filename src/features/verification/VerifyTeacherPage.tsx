import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { verificationApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, XCircle, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

export default function VerifyTeacherPage() {
  const { nuptk } = useParams<{ nuptk: string }>();
  
  // 🔥 REST API QUERY
  const { data: verificationResponse, isLoading, error } = useQuery({
    queryKey: ['verify', 'teacher', nuptk],
    queryFn: () => nuptk ? verificationApi.verifyByNuptk(nuptk) : null,
    enabled: !!nuptk
  });

  const teacher = verificationResponse?.data;
  const isSuccess = verificationResponse?.success;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Memvalidasi NUPTK...</p>
        </div>
      </div>
    );
  }

  if (!isSuccess || !teacher) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-2xl rounded-[2rem] overflow-hidden">
          <CardHeader className="text-center pb-2 pt-10">
            <div className="mx-auto bg-red-50 w-20 h-20 rounded-3xl flex items-center justify-center mb-6">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-black text-slate-800">DATA TIDAK SAH</CardTitle>
            <CardDescription className="text-sm px-8 pt-2 leading-relaxed">
              Pendidik dengan NUPTK <strong>{nuptk}</strong> tidak terdaftar dalam database resmi PC LP Ma'arif NU Cilacap.
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
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 to-teal-600"></div>
        <CardHeader className="text-center pt-12 pb-6 bg-white">
          <div className="mx-auto bg-emerald-50 w-24 h-24 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm ring-4 ring-emerald-50/50">
            <ShieldCheck className="w-12 h-12 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl font-black text-slate-800 tracking-tight uppercase">TERVERIFIKASI RESMI</CardTitle>
          <div className="mt-2 text-[10px] font-black tracking-[0.2em] text-emerald-600 bg-emerald-50 inline-block px-5 py-2 rounded-full uppercase">
            GURU / TENAGA KEPENDIDIKAN AKTIF
          </div>
        </CardHeader>
        <CardContent className="bg-white p-8 space-y-6 pt-2">
            <div className="space-y-6">
               <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Nama Lengkap</p>
                    <p className="text-lg font-black text-slate-800 leading-tight">{teacher.nama}</p>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-6">
                   <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">NUPTK / PEGID</p>
                       <p className="font-mono text-sm font-bold text-slate-700 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl inline-block">{teacher.nuptk || "-"}</p>
                   </div>
                   <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">NIM MA'ARIF</p>
                       <p className="font-mono text-sm font-bold text-slate-700 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl inline-block">{teacher.nim_maarif || "-"}</p>
                   </div>
               </div>
               <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Homebase Madrasah</p>
                   <p className="font-bold text-slate-700 text-base">{teacher.school?.nama || teacher.unit_kerja || "-"}</p>
               </div>
               {teacher.status_pegawai && (
                   <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Status Kepegawaian</p>
                       <p className="text-sm font-bold text-slate-800 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl inline-block">{teacher.status_pegawai}</p>
                   </div>
               )}
            </div>

            <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col items-center text-center">
                <img src="/logo-maarif-hijau.png" alt="Logo" className="h-14 w-auto mb-4 grayscale opacity-30" />
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  SIMMACI CLOUD VERIFICATION<br/>PC LP MA'ARIF NU CILACAP
                </p>
                <p className="text-[9px] text-slate-300 mt-4 font-mono">
                  VERIFIED ON: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
