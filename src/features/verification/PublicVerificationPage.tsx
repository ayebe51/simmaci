import { useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, ShieldCheck, FileText, User, Calendar, CalendarX, School, Loader2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { verificationApi } from "@/lib/api"

export default function PublicVerificationPage({ isTeacher, isStudent }: { isTeacher?: boolean, isStudent?: boolean }) {
    const { id } = useParams()
    
    // 🔥 REST API QUERIES
    const { data: verificationData, isLoading, error } = useQuery({
        queryKey: ['verification', isTeacher ? 'teacher' : isStudent ? 'student' : 'sk', id],
        queryFn: () => {
            if (!id) return null;
            if (isTeacher) return verificationApi.verifyByNuptk(id);
            if (isStudent) return verificationApi.verifyByNisn(id);
            return verificationApi.verifyByCode(id);
        },
        enabled: !!id
    });

    const status = isLoading ? "loading" : (error || !verificationData?.success ? "invalid" : "valid");
    const data = verificationData?.data;

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <Card className="w-full max-w-md shadow-2xl border-0 rounded-[2.5rem] overflow-hidden">
                <CardHeader className="text-center pb-2 pt-10">
                    <div className="mx-auto mb-6 bg-emerald-50 w-20 h-20 rounded-3xl flex items-center justify-center shadow-sm">
                        <ShieldCheck className="w-10 h-10 text-emerald-600" />
                    </div>
                    <CardTitle className="text-2xl font-black text-slate-800 tracking-tight">
                        {isTeacher ? "Verifikasi Anggota" : (isStudent ? "Verifikasi Siswa" : "Verifikasi Dokumen")}
                    </CardTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Digital Verification System</p>
                </CardHeader>
                <CardContent className="space-y-6 p-8">
                    {status === "loading" && (
                        <div className="text-center py-20">
                            <Loader2 className="h-10 w-10 animate-spin text-emerald-500 mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-500">Memverifikasi keaslian data...</p>
                        </div>
                    )}

                    {status === "invalid" && (
                        <div className="text-center py-10 bg-red-50 rounded-[2rem] border border-red-100">
                            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                            <h3 className="text-lg font-black text-red-700">DATA TIDAK SAH</h3>
                            <p className="text-xs text-red-600 px-8 mt-2 leading-relaxed">
                                Kode verifikasi atau nomor identitas tidak ditemukan dalam database resmi LP Ma'arif Cilacap.
                            </p>
                        </div>
                    )}

                    {status === "valid" && data && (
                        <>
                            <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-8 text-center">
                                <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
                                <h3 className="text-xl font-black text-emerald-800 uppercase tracking-tight">
                                    {isTeacher ? "ANGGOTA RESMI" : (isStudent ? "SISWA TERDAFTAR" : "DOKUMEN VALID")}
                                </h3>
                                <p className="text-xs text-emerald-600 font-medium mt-1">
                                    {isTeacher 
                                      ? "Terverifikasi sebagai pendidik resmi di bawah naungan LP Ma'arif Cilacap."
                                      : (isStudent ? "Terverifikasi sebagai peserta didik aktif di madrasah affiliasi Ma'arif." : "Dokumen ini tercatat resmi dan berlaku aktif.")}
                                </p>
                            </div>

                            <div className="space-y-6 pt-2">
                                <div className="flex items-start gap-4">
                                    <div className="bg-slate-50 h-10 w-10 rounded-xl flex items-center justify-center shrink-0">
                                        <FileText className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1.5">
                                            {isTeacher ? "ID NUPTK" : (isStudent ? "NOMOR NISN" : "NOMOR DOKUMEN")}
                                        </p>
                                        <p className="font-bold text-slate-800 break-all text-sm uppercase font-mono">
                                            {id || "-"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="bg-slate-50 h-10 w-10 rounded-xl flex items-center justify-center shrink-0">
                                        <User className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1.5">
                                            {isStudent ? "Nama Peserta Didik" : "Nama Pemilik"}
                                        </p>
                                        <p className="font-bold text-slate-800 text-base">
                                            {data.nama}
                                        </p>
                                        {data.nuptk && <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">NUPTK: {data.nuptk}</p>}
                                        {data.nik && <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">NIK: {data.nik}</p>}
                                    </div>
                                </div>

                                {(data.school || data.unit_kerja) && (
                                    <div className="flex items-start gap-4">
                                        <div className="bg-slate-50 h-10 w-10 rounded-xl flex items-center justify-center shrink-0">
                                            <School className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1.5">Pangkalan Unit</p>
                                            <p className="font-bold text-slate-800 text-sm">
                                                {data.school?.nama || data.unit_kerja || "-"}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    
                    <div className="text-center pt-8 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                            SIMMACI DIGITAL VERIFICATION &bull; {new Date().getFullYear()}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
