import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";

export default function VerifyStudentPage() {
  const { nisn } = useParams<{ nisn: string }>();
  
  // Assuming a public endpoint for verifying students exists
  const student = useQuery(api.students.getByNisnPublic, { nisn: nisn || "" });

  if (student === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-pulse flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">Memverifikasi Data Siswa...</p>
        </div>
      </div>
    );
  }

  if (student === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <CardTitle className="text-2xl text-red-700">Tidak Ditemukan</CardTitle>
            <CardDescription className="text-base mt-2">
              Data Siswa dengan NISN/ID <strong>{nisn}</strong> tidak terdaftar dalam sistem LP Ma'arif NU Kab. Cilacap.
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
      <Card className="max-w-md w-full border-blue-200 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
        <CardHeader className="text-center pt-8 pb-4 bg-white">
          <div className="mx-auto bg-blue-50 w-24 h-24 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm ring-2 ring-blue-100">
            <CheckCircle2 className="w-12 h-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl text-slate-800 tracking-tight">Siswa Resmi Valid</CardTitle>
          <CardDescription className="text-sm mt-1 text-blue-600 font-medium bg-blue-50 inline-block px-3 py-1 rounded-full">
            Siswa Tersinkronisasi LP Ma'arif NU Cilacap
          </CardDescription>
        </CardHeader>
        <CardContent className="bg-slate-50/50 p-6">
            <div className="space-y-4">
               <div>
                   <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">Nama Lengkap Siswa</p>
                   <p className="text-lg font-bold text-slate-800">{student.nama}</p>
               </div>
               <div className="grid grid-cols-2 gap-4">
                   <div>
                       <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">NISN / NIS</p>
                       <p className="font-mono text-sm font-medium text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded inline-block">{student.nisn || "-"}</p>
                   </div>
                   {student.nik && student.nik !== "-" && typeof student.nik === "string" && (
                     <div>
                         <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">NIK</p>
                         <p className="font-mono text-sm font-medium text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded inline-block">***{student.nik.slice(-4)}</p>
                     </div>
                   )}
               </div>
               <div>
                   <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">Asal Lembaga Pendidikan</p>
                   <p className="font-semibold text-slate-700">{student.namaSekolah}</p>
               </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col items-center text-center">
                <img src="/logo-maarif-hijau.png" alt="Logo NU" className="h-10 w-auto mb-2" />
                <p className="text-[10px] text-slate-400 font-medium">SIMMACI - Sistem Informasi Manajemen Ma'arif<br/>Pimpinan Cabang LP Ma'arif NU Kab. Cilacap</p>
                <p className="text-[10px] text-slate-500 mt-2 font-medium">Cilacap, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric'})}</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
