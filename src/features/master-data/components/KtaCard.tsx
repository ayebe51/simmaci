import { useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { QRCodeSVG } from "qrcode.react";

interface KtaCardProps {
  data: {
    _id: Id<"teachers"> | Id<"students">;
    nama: string;
    nuptk?: string; // Teacher
    nisn?: string; // Student
    nomorIndukMaarif?: string;
    unitKerja?: string; // Teacher
    namaSekolah?: string; // Student
    kelas?: string; // Student
    photoId?: Id<"_storage"> | string;
    nip?: string;
  };
  type: "teacher" | "student";
  isBatch?: boolean;
}

export default function KtaCard({ data, type, isBatch }: KtaCardProps) {
  const isTeacher = type === "teacher";
  
  // Load templates from settings/localstorage (fallback to defaults)
  const templateFront = typeof window !== 'undefined' ? localStorage.getItem(isTeacher ? "kta_template_front_blob" : "kta_student_template_front_blob") : null;
  const templateBack = typeof window !== 'undefined' ? localStorage.getItem(isTeacher ? "kta_template_back_blob" : "kta_student_template_back_blob") : null;

  // Fetch Photo URL Logic
  const isStorageId = data.photoId && typeof data.photoId === "string" && !data.photoId.startsWith("http") && data.photoId.length > 20;
  const storageUrl = useQuery(api.teachers.getPhotoUrl, isStorageId ? { storageId: data.photoId as Id<"_storage"> } : "skip");
  
  // Final URL to display
  const displayUrl = useMemo(() => {
    const rawUrl = isStorageId ? storageUrl : data.photoId;
    if (rawUrl && typeof rawUrl === 'string' && rawUrl.includes("drive.google.com")) {
        const match = rawUrl.match(/id=([a-zA-Z0-9_-]+)/) || rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
    }
    return rawUrl;
  }, [isStorageId, storageUrl, data.photoId]);
  
  const baseUrl = (import.meta.env as any).VITE_APP_URL || window.location.origin;
  const idValue = isTeacher ? data.nuptk : data.nisn;
  const verifyUrl = `${baseUrl}/verify/${isTeacher ? 'teacher' : 'student'}/${idValue || "unknown"}`;

  const handlePrint = () => {
    const originalTitle = document.title;
    const fileName = `KTA_${type.toUpperCase()}_${data.nama.replace(/\s+/g, '_')}`;
    document.title = fileName;
    window.print();
    // Restore title after a short delay to ensure print dialog picks it up
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const cardStyle = {
    width: "480px", 
    height: "300px",
    borderRadius: "12px",
    position: "relative" as const,
    overflow: "hidden" as const,
    color: "white",
    fontFamily: "sans-serif",
    flexShrink: 0
  };

  return (
    <div className={`flex flex-col items-center ${isBatch ? "" : "gap-6"}`}>
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            
            .kta-print-container {
               display: block !important;
               width: 100% !important;
               margin: 0 auto !important;
               padding: 20px 0 !important;
               background: white !important;
               page-break-after: always !important;
               break-after: page !important;
               position: relative !important;
            }
            
            #kta-print-area {
               position: absolute !important;
               left: 0 !important;
               top: 0 !important;
               width: 100% !important;
               height: 100vh !important;
               display: flex !important;
               flex-direction: column !important;
               align-items: center !important;
               justify-content: center !important;
               z-index: 99999 !important;
               background: white !important;
            }
            
            * { 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
              filter: none !important;
            }
            
            @page { 
              margin: 0; 
              size: auto;
            }
          }
        `}
      </style>

      {/* PRINT CONTAINER */}
      <div 
        id={isBatch ? undefined : "kta-print-area"} 
        className={`kta-print-container flex flex-col ${isBatch ? "mb-12" : "md:flex-row gap-6"} items-center justify-center`}
      >
          
          {/* FRONT SIDE */}
          <div 
            style={{
                ...cardStyle,
                backgroundImage: templateFront ? `url(${templateFront})` : isTeacher 
                  ? "linear-gradient(135deg, #0f172a 0%, #020617 100%)" 
                  : "linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: isBatch ? "none" : "0 10px 25px -5px rgba(0, 0, 0, 0.5)"
            }}
            className={`border ${isTeacher ? "border-yellow-500/20" : "border-blue-400/20"} relative overflow-hidden print:shadow-none`}
          >
            {!templateFront && (
              <>
                <div className={`absolute top-0 right-0 w-64 h-64 ${isTeacher ? "bg-emerald-500/10" : "bg-blue-400/10"} rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none`}></div>
                <div className={`absolute bottom-0 left-0 w-64 h-64 ${isTeacher ? "bg-yellow-500/10" : "bg-cyan-400/10"} rounded-full blur-[80px] -ml-32 -mb-32 pointer-events-none`}></div>
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M54.627 0l.83.48-15.022 26.02-15.02-26.02.83-.48h28.382zM29.5 0l-.83.48 15.02 26.02 15.022-26.02-.83-.48H29.5zm-5.383 0h-28.38l-.83.48 15.02 26.02 15.02-26.02-.83-.48zM0 0l.83.48 15.022 26.02L.83 52.52 0 52.04V0zm0 53.48l.83-.48 15.02 26.02-15.02 26.02-.83-.48v-51.08zm29.5 53.48l-.83-.48-15.022 26.02 15.02 26.02.83-.48V53.48zM60 0v52.04l-.83.48-15.02-26.02L59.17.48 60 0zm0 53.48v51.08l-.83.48-15.022-26.02L59.17 53 60 53.48zM24.117 52.04h28.38l.83.48-15.02 26.02-15.022-26.02.83-.48H24.117zm-5.382 0l-.83.48-15.02 26.02L17.905 104l.83-.48h-28.38zM54.627 104h-28.38l-.83.48 15.02 26.02 15.02-26.02.83-.48z\' fill=\'%23fbbf24\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' }}></div>
              </>
            )}

            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-slate-900/80 to-slate-800/80 backdrop-blur-md border-b border-white/10 flex items-center px-4 justify-between z-10 print:bg-slate-900/100">
                <div className="flex items-center gap-3">
                    <img src="/logo-maarif-white.png" alt="Logo" className="h-10 w-10 object-contain drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                    <div className="flex flex-col">
                        <h1 className={`text-[12px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${isTeacher ? 'from-yellow-200 to-yellow-500' : 'from-blue-200 to-cyan-300'} uppercase tracking-widest leading-none mb-0.5 ${isTeacher ? "print-color-yellow" : "print-color-blue"}`}>
                          {isTeacher ? "KARTU TANDA ANGGOTA" : "KARTU IDENTITAS SISWA"}
                        </h1>
                        <h2 className="text-[8px] font-semibold text-emerald-400 uppercase tracking-widest leading-none print-color-emerald">LP MA'ARIF NU CILACAP</h2>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <span className={`block text-[6px] ${isTeacher ? 'text-yellow-500/80' : 'text-blue-400/80'} uppercase tracking-widest mb-0.5 ${isTeacher ? "print-color-yellow" : "print-color-blue"}`}>
                          {isTeacher ? "ID Anggota" : "NISN / ID"}
                        </span>
                        <span className={`font-mono font-bold text-[10px] ${isTeacher ? 'text-yellow-100' : 'text-blue-50'} tracking-wider bg-black/40 px-2 py-0.5 rounded border ${isTeacher ? 'border-yellow-500/30 print:border-yellow-500' : 'border-blue-400/30 print:border-blue-400'} print-color-white`}>
                          {idValue || "---"}
                        </span>
                    </div>
                </div>
            </div>

            <div className={`relative z-10 flex gap-5 w-full h-full box-border ${templateFront ? 'pt-16 pb-6 px-5' : 'pt-20 pb-6 px-5'}`}>
                {/* PHOTO */}
                <div className={`w-24 h-32 bg-slate-800 rounded-md border-2 ${isTeacher ? 'border-yellow-500/40 print-border-yellow' : 'border-blue-400/40 print-border-blue'} shadow-lg overflow-hidden flex-shrink-0 relative`}>
                    {displayUrl ? (
                        <img src={displayUrl} className="w-full h-full object-cover" alt="Profile" crossOrigin="anonymous" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px] bg-slate-800 print-color-white">No Photo</div>
                    )}
                </div>

                {/* INFO */}
                <div className="flex-1 flex flex-col justify-start pt-1 gap-2.5">
                    <div className="border-b border-white/10 pb-1 flex justify-between">
                        <label className={`text-[7px] ${isTeacher ? 'text-yellow-500' : 'text-blue-400'} uppercase tracking-widest mt-0.5 ${isTeacher ? "print-color-yellow" : "print-color-blue"}`}>
                          {isTeacher ? "NUPTK / PEGID" : "NISN"}
                        </label>
                        <p className="font-mono font-bold text-[10px] text-white uppercase tracking-widest print-color-white">{idValue || "-"}</p>
                    </div>
                    {isTeacher && (
                      <div className="border-b border-white/10 pb-1 flex justify-between">
                        <label className="text-[7px] text-yellow-500 uppercase tracking-widest mt-0.5 print-color-yellow">NIM (No Induk Ma'arif)</label>
                        <p className="font-mono font-bold text-[10px] text-emerald-200 tracking-wider print-color-emerald">{data.nomorIndukMaarif || "-"}</p>
                      </div>
                    )}
                    <div className="border-b border-white/10 pb-1 pt-0.5">
                        <label className={`text-[7px] ${isTeacher ? 'text-yellow-500' : 'text-blue-400'} uppercase tracking-widest block mb-0.5 ${isTeacher ? "print-color-yellow" : "print-color-blue"}`}>Nama Lengkap</label>
                        <p className="font-bold text-[11px] text-white uppercase line-clamp-1 tracking-wide print-color-white">{data.nama}</p>
                    </div>
                    <div className="border-b border-white/10 pb-1">
                        <label className={`text-[7px] ${isTeacher ? 'text-yellow-500' : 'text-blue-400'} uppercase tracking-widest block mb-0.5 ${isTeacher ? "print-color-yellow" : "print-color-blue"}`}>
                          {isTeacher ? "Unit Kerja / Madrasah" : "Madrasah / Sekolah"}
                        </label>
                        <p className="font-semibold text-[10px] text-slate-300 line-clamp-1 tracking-wide uppercase print-color-white">
                          {isTeacher ? data.unitKerja : data.namaSekolah}
                        </p>
                    </div>
                    {!isTeacher && (
                      <div className="border-b border-white/10 pb-1">
                        <label className="text-[7px] text-blue-400 uppercase tracking-widest block mb-0.5 print-color-blue">Kelas</label>
                        <p className="font-bold text-[10px] text-emerald-400 tracking-wide uppercase print-color-emerald">{data.kelas || "-"}</p>
                      </div>
                    )}
                </div>
            </div>

            <div className={`absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-r ${isTeacher ? 'from-yellow-600 to-yellow-500' : 'from-blue-600 to-blue-500'} flex items-center justify-center z-20 print:bg-yellow-500`}>
                <span className={`text-[7px] ${isTeacher ? 'text-yellow-950' : 'text-white'} font-extrabold uppercase tracking-[0.2em] print:text-black`}>Bermutu Dalam Ilmu • Bermartabat Dalam Sikap</span>
            </div>
          </div>

          {/* BACK SIDE */}
          <div 
            style={{
                ...cardStyle,
                backgroundImage: templateBack ? `url(${templateBack})` : isTeacher 
                  ? "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
                  : "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: isBatch ? "none" : "0 10px 25px -5px rgba(0, 0, 0, 0.5)"
            }}
            className={`border ${isTeacher ? "border-yellow-500/20" : "border-blue-400/20"} relative print:shadow-none`}
          >
            <div className="p-5 flex flex-col h-full justify-between z-10 relative">
                <div>
                   <h3 className={`text-[9px] font-bold uppercase border-b ${isTeacher ? 'border-yellow-500/30 text-yellow-400' : 'border-blue-400/30 text-blue-300'} pb-1.5 mb-2.5 tracking-widest`}>
                    Ketentuan Kartu {isTeacher ? "Anggota" : "Siswa"}
                   </h3>
                   <ul className="text-[7.5px] space-y-1.5 list-none pl-1 text-slate-300">
                       <li className="flex gap-2"><div className={`w-1 h-1 rounded-full ${isTeacher ? 'bg-emerald-500' : 'bg-blue-400'} mt-1 flex-shrink-0`}></div> Kartu ini adalah identitas resmi anggota LP Ma'arif NU Cilacap.</li>
                       <li className="flex gap-2"><div className={`w-1 h-1 rounded-full ${isTeacher ? 'bg-emerald-500' : 'bg-blue-400'} mt-1 flex-shrink-0`}></div> Wajib dibawa saat mengikuti program/kegiatan resmi {isTeacher ? "organisasi" : "sekolah"}.</li>
                       <li className="flex gap-2"><div className={`w-1 h-1 rounded-full ${isTeacher ? 'bg-emerald-500' : 'bg-blue-400'} mt-1 flex-shrink-0`}></div> Digunakan dalam sistem absensi digital LP Ma'arif NU Cilacap.</li>
                       <li className="flex gap-2"><div className={`w-1 h-1 rounded-full ${isTeacher ? 'bg-emerald-500' : 'bg-blue-400'} mt-1 flex-shrink-0`}></div> Jika menemukan kartu ini, harap kembalikan ke kantor LP Ma'arif NU Cilacap.</li>
                   </ul>
                </div>

                <div className="flex justify-between items-end pb-1">
                    {/* QR Code */}
                    <div className="bg-white/10 p-1.5 rounded-lg border border-white/20 shadow-md flex flex-col items-center backdrop-blur-sm">
                       <div className="bg-white p-1 rounded-md">
                           <QRCodeSVG value={verifyUrl} size={60} level="M" />
                       </div>
                       <span className={`text-[5px] mt-1.5 ${isTeacher ? 'text-yellow-400' : 'text-blue-300'} font-mono tracking-[0.15em] font-semibold uppercase`}>
                         {isTeacher ? "NUPTK" : "NISN"}: {idValue || "---"}
                       </span>
                    </div>

                    {/* Signature Area */}
                    <div className="text-center pr-2">
                        <p className="text-[7.5px] text-slate-400 mb-1 font-medium">Cilacap, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric'})}</p>
                        <div className="flex flex-col items-center pt-0 relative">
                            <div className="relative flex justify-center items-center h-10 w-24 mx-auto mb-2 mt-1">
                                <img src="/stempel-maarif-putih.png" alt="Stempel" className="absolute -left-8 -top-5 h-20 w-20 object-contain mix-blend-screen opacity-90" />
                                <img src="/ttd-ketua-putih.png" alt="Tanda Tangan" className="absolute top-0 h-12 w-auto object-contain z-10 mix-blend-screen" />
                            </div>
                            <p className="text-[10px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 to-yellow-400 border-b border-yellow-500/30 pb-0.5 mb-1 px-4 tracking-wide relative z-20">Ali Sodiqin, S.Ag., M.Pd.I.</p>
                            <p className="text-[6.5px] uppercase tracking-[0.14em] text-emerald-400 font-semibold relative z-20">Ketua LP Ma'arif NU Cilacap</p>
                        </div>
                    </div>
                </div>
            </div>
          </div>
      </div>

      {!isBatch && (
        <div className="flex gap-4 no-print mt-4">
          <Button onClick={handlePrint} className="bg-emerald-700 hover:bg-emerald-800">
              <Printer className="w-4 h-4 mr-2" /> Cetak / Simpan PDF
          </Button>
        </div>
      )}
    </div>
  );
}
