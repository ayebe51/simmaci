import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { verificationApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileCheck,
  XCircle,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  Briefcase,
  Building2,
  Calendar,
  CalendarX,
  Tag,
  School,
} from "lucide-react";

interface SkData {
  nomor_sk: string;
  nama: string;
  jabatan: string;
  unit_kerja: string;
  tanggal_penetapan: string;
  tanggal_kadaluarsa: string;
  jenis_sk: string;
  status: string;
  is_expired: boolean;
  school?: {
    nama: string;
  };
}

export default function VerifySkPage() {
  const { nomor } = useParams<{ nomor: string }>();

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ["verify", "sk", nomor],
    queryFn: () => (nomor ? verificationApi.verifyBySk(nomor) : null),
    enabled: !!nomor,
    retry: false,
  });

  // The response interceptor in apiClient unwraps `data` when success=true,
  // so response.data is the SK data object directly.
  const skData: SkData | undefined = response?.data?.data ?? response?.data;
  const isFound = !isError && !!skData;
  const isExpired = isFound && skData.is_expired;

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
            Memverifikasi Nomor SK...
          </p>
        </div>
      </div>
    );
  }

  // ── Not found / error state ──
  if (!isFound) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-2xl rounded-[2rem] overflow-hidden">
          <CardHeader className="text-center pb-2 pt-10">
            <div className="mx-auto bg-red-50 w-20 h-20 rounded-3xl flex items-center justify-center mb-6">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <div className="mb-4">
              <Badge className="bg-red-100 text-red-700 border-0 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full">
                SK TIDAK DITEMUKAN
              </Badge>
            </div>
            <CardTitle className="text-2xl font-black text-slate-800">
              DOKUMEN TIDAK SAH
            </CardTitle>
            <CardDescription className="text-sm px-8 pt-2 leading-relaxed">
              Nomor SK <strong className="break-all">{nomor}</strong> tidak ditemukan
              dalam database resmi PC LP Ma'arif NU Cilacap, atau dokumen belum
              berstatus aktif.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 flex justify-center border-t border-slate-50 mt-4">
            <Link
              to="/"
              className="text-xs font-black text-slate-400 hover:text-slate-800 flex items-center gap-2 uppercase tracking-widest transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Found state (valid or expired) ──
  const gradientClass = isExpired
    ? "from-amber-400 to-yellow-500"
    : "from-emerald-500 to-teal-600";

  const iconBgClass = isExpired ? "bg-amber-50 ring-amber-50/50" : "bg-emerald-50 ring-emerald-50/50";
  const iconColorClass = isExpired ? "text-amber-600" : "text-emerald-600";

  const badgeClass = isExpired
    ? "bg-amber-100 text-amber-700"
    : "bg-emerald-100 text-emerald-700";

  const badgeLabel = isExpired ? "SK KADALUARSA" : "SK VALID & AKTIF";

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 py-12">
      <Card className="max-w-md w-full border-0 shadow-2xl rounded-[2.5rem] overflow-hidden relative">
        {/* Gradient bar */}
        <div
          className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${gradientClass}`}
        />

        <CardHeader className="text-center pt-12 pb-6 bg-white">
          <div
            className={`mx-auto ${iconBgClass} w-24 h-24 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm ring-4`}
          >
            {isExpired ? (
              <AlertTriangle className={`w-12 h-12 ${iconColorClass}`} />
            ) : (
              <FileCheck className={`w-12 h-12 ${iconColorClass}`} />
            )}
          </div>

          <CardTitle className="text-2xl font-black text-slate-800 tracking-tight uppercase">
            {isExpired ? "SK KADALUARSA" : "SK TERVERIFIKASI"}
          </CardTitle>

          <div className="mt-3">
            <Badge
              className={`${badgeClass} border-0 text-[10px] font-black tracking-[0.2em] px-5 py-2 rounded-full uppercase`}
            >
              {badgeLabel}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="bg-white p-8 space-y-6 pt-2">
          <div className="space-y-5">
            {/* Nomor SK */}
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">
                  Nomor SK
                </p>
                <p className="font-mono text-sm font-bold text-slate-700 break-all leading-snug">
                  {skData.nomor_sk}
                </p>
              </div>
            </div>

            {/* Nama Guru */}
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">
                  Nama Guru
                </p>
                <p className="text-base font-black text-slate-800 leading-tight">
                  {skData.nama}
                </p>
              </div>
            </div>

            {/* Jabatan & Jenis SK */}
            <div className="grid grid-cols-2 gap-5">
              <div>
                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center mb-2">
                  <Briefcase className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">
                  Jabatan
                </p>
                <p className="text-sm font-bold text-slate-700 leading-snug">
                  {skData.jabatan || "-"}
                </p>
              </div>
              <div>
                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center mb-2">
                  <Tag className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">
                  Jenis SK
                </p>
                <p className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl inline-block">
                  {skData.jenis_sk || "-"}
                </p>
              </div>
            </div>

            {/* Unit Kerja */}
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">
                  Unit Kerja
                </p>
                <p className="text-sm font-bold text-slate-700">
                  {skData.unit_kerja || "-"}
                </p>
              </div>
            </div>

            {/* Nama Sekolah */}
            {skData.school?.nama && (
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                  <School className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">
                    Nama Sekolah
                  </p>
                  <p className="text-sm font-bold text-slate-700">
                    {skData.school.nama}
                  </p>
                </div>
              </div>
            )}

            {/* Tanggal Penetapan & Kadaluarsa */}
            <div className="grid grid-cols-2 gap-5">
              <div>
                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center mb-2">
                  <Calendar className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">
                  Tgl. Penetapan
                </p>
                <p className="text-sm font-bold text-slate-700">
                  {skData.tanggal_penetapan || "-"}
                </p>
              </div>
              <div>
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center mb-2 ${
                    isExpired ? "bg-amber-50" : "bg-slate-50"
                  }`}
                >
                  <CalendarX
                    className={`w-5 h-5 ${isExpired ? "text-amber-400" : "text-slate-400"}`}
                  />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">
                  Tgl. Kadaluarsa
                </p>
                <p
                  className={`text-sm font-bold ${
                    isExpired ? "text-amber-600" : "text-slate-700"
                  }`}
                >
                  {skData.tanggal_kadaluarsa || "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Expired notice */}
          {isExpired && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-amber-700 leading-relaxed">
                SK ini pernah valid namun telah melewati masa berlaku 1 tahun
                sejak tanggal penetapan.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col items-center text-center">
            <img
              src="/logo-maarif-hijau.png"
              alt="Logo LP Ma'arif NU Cilacap"
              className="h-14 w-auto mb-4 grayscale opacity-30"
            />
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              SIMMACI CLOUD VERIFICATION
              <br />
              PC LP MA'ARIF NU CILACAP
            </p>
            <p className="text-[9px] text-slate-300 mt-4 font-mono">
              VERIFIED ON:{" "}
              {new Date().toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
