import { useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface KtaCardProps {
  data: {
    id: number;
    nama: string;
    nuptk?: string; // Teacher
    nisn?: string; // Student
    nomorIndukMaarif?: string;
    unitKerja?: string; // Teacher
    namaSekolah?: string; // Student
    kelas?: string; // Student
    photoId?: string;
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

  // Final URL to display
  const displayUrl = useMemo(() => {
    const rawUrl = data.photoId;
    if (rawUrl && typeof rawUrl === 'string' && rawUrl.includes("drive.google.com")) {
        const match = rawUrl.match(/id=([a-zA-Z0-9_-]+)/) || rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
    }
    return rawUrl;
  }, [data.photoId]);
  
  const baseUrl = (import.meta.env as any).VITE_APP_URL || window.location.origin;
  const idValue = isTeacher ? data.nuptk : data.nisn;
  const verifyUrl = `${baseUrl}/verify/${isTeacher ? 'teacher' : 'student'}/${idValue || "unknown"}`;

  const handlePrint = () => {
    const originalTitle = document.title;
    const fileName = `KTA_${type.toUpperCase()}_${data.nama.replace(/\s+/g, '_')}`;
    document.title = fileName;
    window.print();
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
            html, body, #root, main {
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              display: block !important;
              position: static !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .no-print { display: none !important; }
            .kta-print-container {
               display: block !important;
               width: 100% !important;
               margin: 0 auto !important;
               padding: 20px 0 !important;
               background: white !important;
               page-break-after: always !important;
               break-after: page !important;
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
            }
            @page { margin: 5mm; size: auto; }
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
                backgroundPosition: "center"
            }}
            className={`border ${isTeacher ? "border-yellow-500/20" : "border-blue-400/20"} relative overflow-hidden`}
          >
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-slate-900/80 to-slate-800/80 backdrop-blur-md border-b border-white/10 flex items-center px-4 justify-between z-10">
                <div className="flex items-center gap-3">
                    <img src="/logo-maarif-white.png" alt="Logo" className="h-10 w-10 object-contain" />
                    <div className="flex flex-col">
                        <h1 className="text-[12px] font-extrabold text-white uppercase tracking-widest leading-none mb-0.5">
                          {isTeacher ? "KARTU TANDA ANGGOTA" : "KARTU IDENTITAS SISWA"}
                        </h1>
                        <h2 className="text-[8px] font-semibold text-emerald-400 uppercase tracking-widest leading-none">LP MA'ARIF NU CILACAP</h2>
                    </div>
                </div>
            </div>

            <div className="relative z-10 flex gap-5 w-full h-full pt-20 pb-6 px-5">
                <div className={`w-24 h-32 bg-slate-800 rounded-md border-2 ${isTeacher ? 'border-yellow-500/40' : 'border-blue-400/40'} overflow-hidden flex-shrink-0`}>
                    {displayUrl ? (
                        <img src={displayUrl} className="w-full h-full object-cover" alt="Profile" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px]">No Photo</div>
                    )}
                </div>

                <div className="flex-1 flex flex-col justify-start pt-1 gap-2.5">
                    <div className="border-b border-white/10 pb-1 flex justify-between">
                        <label className="text-[7px] text-slate-400 uppercase tracking-widest">ID</label>
                        <p className="font-mono font-bold text-[10px] text-white tracking-widest">{idValue || "-"}</p>
                    </div>
                    <div className="border-b border-white/10 pb-1">
                        <label className="text-[7px] text-slate-400 uppercase tracking-widest block mb-0.5">Nama Lengkap</label>
                        <p className="font-bold text-[11px] text-white uppercase truncate">{data.nama}</p>
                    </div>
                    <div className="border-b border-white/10 pb-1">
                        <label className="text-[7px] text-slate-400 uppercase tracking-widest block mb-0.5">Instansi</label>
                        <p className="font-semibold text-[10px] text-slate-300 truncate uppercase">
                          {isTeacher ? data.unitKerja : data.namaSekolah}
                        </p>
                    </div>
                </div>
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
                backgroundPosition: "center"
            }}
            className={`border ${isTeacher ? "border-yellow-500/20" : "border-blue-400/20"} relative`}
          >
            <div className="p-5 flex flex-col h-full justify-between z-10 relative">
                <div>
                   <h3 className="text-[9px] font-bold uppercase border-b border-white/10 pb-1.5 mb-2.5 text-slate-400 tracking-widest">Ketentuan</h3>
                   <ul className="text-[7.5px] space-y-1.5 text-slate-300">
                       <li>• Kartu ini adalah identitas resmi LP Ma'arif NU Cilacap.</li>
                       <li>• Wajib dibawa saat kegiatan resmi.</li>
                       <li>• Digunakan dalam sistem absensi digital.</li>
                   </ul>
                </div>

                <div className="flex justify-between items-end pb-1">
                    <div className="bg-white p-1 rounded-md">
                        <QRCodeSVG value={verifyUrl} size={60} level="M" />
                    </div>
                    <div className="text-center">
                        <p className="text-[7.5px] text-slate-400 mb-4 font-medium">LP MA'ARIF NU CILACAP</p>
                        <p className="text-[10px] font-extrabold text-white border-b border-white/20 pb-0.5 mb-1 px-4 tracking-wide">Ali Sodiqin, S.Ag., M.Pd.I.</p>
                        <p className="text-[6.5px] uppercase tracking-widest text-emerald-400 font-semibold">Ketua</p>
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
