import { useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Printer, ShieldCheck, Sparkles, UserCircle2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

interface StudentCardProps {
  student: {
    nama: string;
    nisn: string;
    nik?: string;
    nama_sekolah?: string;
    photo_id?: string;
    kelas?: string;
  };
  isBatch?: boolean;
}

export default function StudentCard({ student, isBatch }: StudentCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Load student-specific templates from local storage (System Config)
  const templateFront = typeof window !== 'undefined' ? localStorage.getItem("student_template_front_blob") : null;
  const templateBack = typeof window !== 'undefined' ? localStorage.getItem("student_template_back_blob") : null;

  // Resolve Photo URL for Laravel Backend
  const displayUrl = useMemo(() => {
    if (!student.photo_id) return null;
    if (student.photo_id.startsWith("http")) return student.photo_id;
    
    // Resolve drive links if any
    if (student.photo_id.includes("drive.google.com")) {
        const match = student.photo_id.match(/id=([a-zA-Z0-9_-]+)/) || student.photo_id.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
    }

    // Default Laravel Storage Path
    const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';
    return `${apiBase}/storage/${student.photo_id}`;
  }, [student.photo_id]);
  
  const baseUrl = (import.meta.env as any).VITE_APP_URL || window.location.origin;
  const verifyUrl = `${baseUrl}/verify/student/${student.nisn || "unknown"}`;

  const handlePrint = () => {
    window.print();
  };

  const cardStyle = {
    width: "480px",
    height: "300px",
    borderRadius: "24px",
    position: "relative" as const,
    overflow: "hidden" as const,
    flexShrink: 0
  };

  return (
    <div className="flex flex-col items-center gap-10 group">
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
            .student-print-container {
               display: block !important;
               width: 100% !important;
               margin: 0 auto !important;
               padding: 20px 0 !important;
               page-break-after: always !important;
               break-after: page !important;
            }
            #student-print-area {
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
        id={isBatch ? undefined : "student-print-area"} 
        className={cn(
            "student-print-container flex flex-col items-center justify-center gap-10",
            isBatch ? "mb-20" : "md:flex-row md:gap-12"
        )}
      >
          {/* FRONT SIDE */}
          <div 
            style={{
                ...cardStyle,
                backgroundImage: templateFront ? `url(${templateFront})` : "linear-gradient(145deg, #0f172a 0%, #1e3a8a 100%)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: isBatch ? "none" : "0 30px 60px -12px rgba(0,0,0,0.25), 0 18px 36px -18px rgba(0,0,0,0.3)"
            }}
            className="border border-white/10 relative overflow-hidden"
          >
            {/* Holographic Overlays */}
            {!templateFront && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/10 rounded-full blur-[100px] -mr-40 -mt-40"></div>
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-400/5 rounded-full blur-[100px] -ml-40 -mb-40"></div>
              </div>
            )}

            {/* Premium Header */}
            <div className="absolute top-0 left-0 right-0 h-20 bg-white/5 backdrop-blur-xl border-b border-white/10 flex items-center px-6 justify-between z-10">
                <div className="flex items-center gap-4">
                    <img src="/logo-maarif-white.png" alt="Logo" className="h-10 w-auto object-contain drop-shadow-2xl" />
                    <div className="flex flex-col">
                        <h1 className="text-[14px] font-black text-white uppercase tracking-tight italic leading-none mb-1">KARTU TANDA PELAJAR</h1>
                        <h2 className="text-[8px] font-bold text-blue-300 uppercase tracking-widest leading-none">LP MA'ARIF NU CILACAP</h2>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <ShieldCheck className="w-2 h-2" /> Verified Identity
                    </span>
                    <Badge variant="outline" className="bg-slate-950/40 text-white border-white/20 text-[10px] font-black px-3 py-1 rounded-lg">
                        {student.nisn || "NO-ID"}
                    </Badge>
                </div>
            </div>

            <div className="relative z-10 flex gap-8 w-full h-full pt-24 px-8 pb-8">
                {/* PHOTO CONTAINER */}
                <div className="w-28 h-36 bg-slate-900/50 rounded-2xl border-2 border-white/10 shadow-2xl overflow-hidden shrink-0 relative">
                    {displayUrl ? (
                        <img src={displayUrl} className="w-full h-full object-cover" alt="Profile" crossOrigin="anonymous" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-500 gap-2">
                            <UserCircle2 className="w-10 h-10 opacity-20" />
                            <span className="text-[8px] font-black uppercase text-center px-4">No Digital Identity</span>
                        </div>
                    )}
                </div>

                {/* INFO CONTENT */}
                <div className="flex-1 flex flex-col justify-start pt-2 space-y-4">
                    <div className="space-y-1">
                        <label className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Student Narrative</label>
                        <p className="font-black text-xl text-white uppercase italic tracking-tighter leading-none truncate">{student.nama}</p>
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Institution Hub</label>
                        <p className="font-bold text-xs text-slate-200 uppercase tracking-tight leading-tight line-clamp-2">{student.nama_sekolah || 'Digital Hub'}</p>
                    </div>

                    <div className="pt-2 flex gap-4">
                        {student.nik && (
                            <div className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2">
                                <span className="text-[7px] font-black text-slate-400 uppercase">NIK:</span>
                                <span className="text-[9px] font-bold text-slate-200 font-mono italic">{student.nik}</span>
                            </div>
                        )}
                        <div className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2">
                            <span className="text-[7px] font-black text-slate-400 uppercase">CLASS:</span>
                            <span className="text-[9px] font-bold text-slate-200 italic">{student.kelas || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Accent */}
            <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-emerald-500 to-yellow-500"></div>
          </div>

          {/* BACK SIDE */}
          <div 
            style={{
                ...cardStyle,
                backgroundImage: templateBack ? `url(${templateBack})` : "linear-gradient(145deg, #1e3a8a 0%, #0f172a 100%)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: isBatch ? "none" : "0 30px 60px -12px rgba(0,0,0,0.25), 0 18px 36px -18px rgba(0,0,0,0.3)"
            }}
            className="border border-white/10 relative overflow-hidden"
          >
            <div className="p-8 flex flex-col h-full justify-between z-10 relative">
                <div className="space-y-4">
                   <h3 className="text-[10px] font-black uppercase text-emerald-400 border-b border-white/10 pb-3 tracking-[0.2em] flex items-center gap-2 italic">
                       <Sparkles className="w-3 h-3" /> Protocol & Engagement
                   </h3>
                   <ul className="text-[8px] space-y-2 text-slate-300 font-bold uppercase tracking-tight leading-relaxed">
                       <li className="flex gap-3"><span className="text-blue-400">01</span> Kartu identitas resmi ekosistem digital Ma'arif.</li>
                       <li className="flex gap-3"><span className="text-blue-400">02</span> Wajib digunakan untuk otentikasi kehadiran.</li>
                       <li className="flex gap-3"><span className="text-blue-400">03</span> Token akses perpustakaan & fasilitas mandiri.</li>
                       <li className="flex gap-3"><span className="text-blue-400">04</span> Kehilangan wajib dilaporkan ke departemen IT.</li>
                   </ul>
                </div>

                <div className="flex justify-between items-end">
                   {/* QR Code Segment */}
                    <div className="p-3 bg-white rounded-3xl shadow-2xl flex flex-col items-center gap-2 group/qr">
                        <QRCodeSVG value={verifyUrl} size={70} level="H" includeMargin={false} />
                        <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest group-hover/qr:text-blue-600 transition-colors">Scan Verify</span>
                    </div>

                    {/* Authority Segment */}
                    <div className="text-right pb-1">
                        <p className="text-[8px] font-bold text-slate-400 mb-2 uppercase tracking-widest italic">Cilacap, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric'})}</p>
                        <div className="flex flex-col items-center relative">
                            <div className="relative h-14 w-32 flex justify-center items-center">
                                {/* Stamp & Signature */}
                                <img src="/stempel-maarif-putih.png" alt="Stempel" className="absolute -left-6 -top-2 h-20 w-auto object-contain opacity-80 mix-blend-screen scale-110" />
                                <img src="/ttd-ketua-putih.png" alt="TTD" className="absolute top-0 h-14 w-auto object-contain z-10 mix-blend-screen" />
                            </div>
                            <h4 className="text-[11px] font-black text-white border-b-2 border-emerald-500/50 pb-1 mb-1 px-4 italic tracking-tight uppercase relative z-20">Ali Sodiqin, S.Ag., M.Pd.I.</h4>
                            <p className="text-[7px] font-black text-blue-300 uppercase tracking-widest relative z-20">Chief Executive Protocol</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="absolute inset-0 bg-blue-500/5 opacity-50 blur-3xl pointer-events-none"></div>
          </div>
      </div>

      {/* ACTIONS */}
      <div className="flex gap-4 no-print">
        <Button onClick={handlePrint} size="lg" className="h-16 px-10 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95">
            <Printer className="w-5 h-5 mr-3 text-blue-600" /> Dispatch to Print Array
        </Button>
      </div>
    </div>
  );
}
