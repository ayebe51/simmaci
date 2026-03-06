import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertCircle, ArrowLeft } from "lucide-react";

export default function VerifyTeacherPage() {
  const { nuptk } = useParams<{ nuptk: string }>();
  
  // We need a public endpoint that doesn't check validation tokens.
  // Using listAll from teachers temporarily if public lookup isn't defined.
  // Assuming a basic lookup here:
  const teacher = useQuery(api.teachers.getByNuptkPublic, { nuptk: nuptk || "" });

  if (teacher === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-pulse flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">Memverifikasi Data...</p>
        </div>
      </div>
    );
  }

  if (teacher === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <CardTitle className="text-2xl text-red-700">Tidak Ditemukan</CardTitle>
            <CardDescription className="text-base mt-2">
              Data Anggota dengan NUPTK/ID <strong>{nuptk}</strong> tidak terdaftar dalam sistem LP Ma'arif NU Kab. Cilacap.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex justify-center">
             <Link to="/" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
             </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
      <Card className="max-w-md w-full border-green-200 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 to-green-600"></div>
        <CardHeader className="text-center pt-8 pb-4 bg-white">
          <div className="mx-auto bg-green-50 w-24 h-24 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm ring-2 ring-green-100">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-slate-800 tracking-tight">Terverifikasi Resmi</CardTitle>
          <CardDescription className="text-sm mt-1 text-emerald-600 font-medium bg-emerald-50 inline-block px-3 py-1 rounded-full">
            Anggota Aktif LP Ma'arif NU Cilacap
          </CardDescription>
        </CardHeader>
        <CardContent className="bg-slate-50/50 p-6">
            <div className="space-y-4">
               <div>
                   <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">Nama Lengkap</p>
                   <p className="text-lg font-bold text-slate-800">{teacher.nama}</p>
               </div>
               <div className="grid grid-cols-2 gap-4">
                   <div>
                       <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">NUPTK / PEGID</p>
                       <p className="font-mono text-sm font-medium text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded inline-block">{teacher.nuptk || "-"}</p>
                   </div>
                   <div>
                       <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">NIM Ma'arif</p>
                       <p className="font-mono text-sm font-medium text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded inline-block">{(teacher as any).nomorIndukMaarif || "-"}</p>
                   </div>
               </div>
               <div>
                   <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">Asal Madrasah/Sekolah</p>
                   <p className="font-semibold text-slate-700">{teacher.unitKerja}</p>
               </div>
               {teacher.statusPegawai && (
                   <div>
                       <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">Status Pegawai</p>
                       <p className="text-sm font-medium text-slate-700">{teacher.statusPegawai}</p>
                   </div>
               )}
            </div>

            <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col items-center text-center">
                <img src="/logo-maarif-white.png" alt="Logo" className="h-8 w-auto mb-2 opacity-50 grayscale invert" />
                <p className="text-[10px] text-slate-400 font-medium">SIMMACI - Sistem Informasi Manajemen Ma'arif<br/>Pimpinan Cabang LP Ma'arif NU Kab. Cilacap</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
