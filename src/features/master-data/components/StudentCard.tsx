import { useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { QRCodeSVG } from "qrcode.react";

interface StudentCardProps {
  student: {
    nama: string;
    nisn: string;
    nik?: string;
    namaSekolah?: string;
    photoId?: Id<"_storage"> | string;
    kelas?: string;
  };
}

export default function StudentCard({ student }: StudentCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Load student-specific templates
  const templateFront = typeof window !== 'undefined' ? localStorage.getItem("student_template_front_blob") : null;
  const templateBack = typeof window !== 'undefined' ? localStorage.getItem("student_template_back_blob") : null;

  // Fetch Photo URL Logic
  const isStorageId = student.photoId && !student.photoId.startsWith("http");
  const storageUrl = useQuery(api.students.getPhotoUrl, isStorageId ? { photoId: student.photoId as string } : "skip");
  
  // Final URL to display (with drive normalization)
  const displayUrl = useMemo(() => {
    const rawUrl = isStorageId ? storageUrl : student.photoId;
    if (rawUrl && typeof rawUrl === 'string' && rawUrl.includes("drive.google.com")) {
        const match = rawUrl.match(/id=([a-zA-Z0-9_-]+)/) || rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
    }
    return rawUrl;
  }, [isStorageId, storageUrl, student.photoId]);
  
  const baseUrl = (import.meta.env as any).VITE_APP_URL || window.location.origin;
  const verifyUrl = `${baseUrl}/verify/student/${student.nisn || "unknown"}`;

  const handlePrint = () => {
    window.print();
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
    <div className="flex flex-col items-center gap-6">
      <style>
        {`
          @media print {
            body * {
               visibility: hidden;
               background: none !important;
            }
            #student-print-area, #student-print-area * {
               visibility: visible;
            }
            #student-print-area {
               position: absolute;
               left: 0;
               top: 0;
               width: 100%;
               display: flex;
               flex-direction: column;
               align-items: center;
               gap: 20px;
               background: white !important;
            }
            .no-print {
               display: none !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>

      {/* PRINT CONTAINER */}
      <div id="student-print-area" className="flex flex-col md:flex-row gap-6 items-center justify-center">
          
          <div 
            style={{
                ...cardStyle,
                backgroundImage: templateFront ? `url(${templateFront})` : "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)", // Premium Navy
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)"
            }}
            className="border border-blue-400/20 relative overflow-hidden"
          >
            {/* Holographic / Light Accent overlays */}
            {!templateFront && (
              <>
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-[80px] -ml-32 -mb-32 pointer-events-none"></div>
                {/* Subtle Hexagon Pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M54.627 0l.83.48-15.022 26.02-15.02-26.02.83-.48h28.382zM29.5 0l-.83.48 15.02 26.02 15.022-26.02-.83-.48H29.5zm-5.383 0h-28.38l-.83.48 15.02 26.02 15.02-26.02-.83-.48zM0 0l.83.48 15.022 26.02L.83 52.52 0 52.04V0zm0 53.48l.83-.48 15.02 26.02-15.02 26.02-.83-.48v-51.08zm29.5 53.48l-.83-.48-15.022 26.02 15.02 26.02.83-.48V53.48zM60 0v52.04l-.83.48-15.02-26.02L59.17.48 60 0zm0 53.48v51.08l-.83.48-15.022-26.02L59.17 53 60 53.48zM24.117 52.04h28.38l.83.48-15.02 26.02-15.022-26.02.83-.48H24.117zm-5.382 0l-.83.48-15.02 26.02L17.905 104l.83-.48h-28.38zM54.627 104h-28.38l-.83.48 15.02 26.02 15.02-26.02.83-.48z\' fill=\'%23fbbf24\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' }}></div>
              </>
            )}

            {!templateFront && (
                <>
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-blue-900/80 to-slate-900/80 backdrop-blur-md border-b border-blue-400/20 flex items-center px-4 justify-between z-10">
                    <div className="flex items-center gap-3">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/4/4b/Logo_Nahdlatul_Ulama.png" alt="NU" className="h-10 w-10 object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        <div className="flex flex-col">
                            <h1 className="text-[12px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500 uppercase tracking-widest leading-none mb-0.5">KARTU TANDA PELAJAR</h1>
                            <h2 className="text-[8px] font-semibold text-blue-300 uppercase tracking-widest leading-none">LP Ma'arif NU Kab. Cilacap</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <span className="block text-[6px] text-yellow-500/80 uppercase tracking-widest mb-0.5">NISN / ID Siswa</span>
                            <span className="font-mono font-bold text-[10px] text-yellow-100 tracking-wider bg-slate-950/50 px-2 py-0.5 rounded border border-yellow-500/30">{student.nisn || "---"}</span>
                        </div>
                        <img src="/logo-maarif.png" alt="Ma'arif" className="h-10 w-10 object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                    </div>
                </div>
                </>
            )}

            {/* Common Elements (Drawn over template too) */}
            <div className={`absolute ${templateFront ? 'top-12' : 'top-20'} left-5 right-5 bottom-5 flex gap-5 z-10`}>
                {/* PHOTO */}
                <div className="w-24 h-32 bg-slate-800 rounded-md border-2 border-blue-400/40 shadow-[0_0_15px_rgba(59,130,246,0.15)] overflow-hidden flex-shrink-0 relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10 pointer-events-none"></div>
                    {displayUrl ? (
                        <img src={displayUrl} className="w-full h-full object-cover" alt="Profile" crossOrigin="anonymous" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px] bg-slate-800">No Photo</div>
                    )}
                </div>

                {/* INFO */}
                <div className="flex-1 flex flex-col justify-start pt-1 space-y-3">
                    <div className="border-b border-blue-900/50 pb-2">
                        <label className="text-[7px] text-yellow-500 uppercase tracking-widest block mb-1">Nama Lengkap</label>
                        <p className="font-bold text-sm text-slate-100 capitalize line-clamp-2 tracking-wide text-shadow-sm">{student.nama}</p>
                    </div>
                    <div className="border-b border-blue-900/50 pb-2">
                        <label className="text-[7px] text-yellow-500 uppercase tracking-widest block mb-1">Asal Madrasah / Sekolah</label>
                        <p className="font-semibold text-[11px] text-blue-200 line-clamp-2 tracking-wide">{student.namaSekolah}</p>
                    </div>
                    {student.nik && student.nik !== "-" && (
                        <div>
                            <label className="text-[7px] text-yellow-500 uppercase tracking-widest block mb-1">NIK</label>
                            <p className="font-mono text-[10px] text-slate-300 tracking-wider inline-block bg-slate-900/80 px-2 py-0.5 rounded border border-blue-900">{student.nik}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Strip if no template */}
            {!templateFront && (
                <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-r from-yellow-600 to-yellow-500 flex items-center justify-center z-20">
                    <span className="text-[7px] text-yellow-950 font-extrabold uppercase tracking-[0.2em]">Belajar • Berjuang • Bertaqwa</span>
                </div>
            )}
          </div>

          <div 
            style={{
                ...cardStyle,
                backgroundImage: templateBack ? `url(${templateBack})` : "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
                backgroundColor: "#0f172a",
                backgroundSize: "cover",
                backgroundPosition: "center",
                color: "white",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)"
            }}
            className="border border-blue-500/20 relative"
          >
            {!templateBack && (
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M54.627 0l.83.48-15.022 26.02-15.02-26.02.83-.48h28.382zM29.5 0l-.83.48 15.02 26.02 15.022-26.02-.83-.48H29.5zm-5.383 0h-28.38l-.83.48 15.02 26.02 15.02-26.02-.83-.48zM0 0l.83.48 15.022 26.02L.83 52.52 0 52.04V0zm0 53.48l.83-.48 15.02 26.02-15.02 26.02-.83-.48v-51.08zm29.5 53.48l-.83-.48-15.022 26.02 15.02 26.02.83-.48V53.48zM60 0v52.04l-.83.48-15.02-26.02L59.17.48 60 0zm0 53.48v51.08l-.83.48-15.022-26.02L59.17 53 60 53.48zM24.117 52.04h28.38l.83.48-15.02 26.02-15.022-26.02.83-.48H24.117zm-5.382 0l-.83.48-15.02 26.02L17.905 104l.83-.48h-28.38zM54.627 104h-28.38l-.83.48 15.02 26.02 15.02-26.02.83-.48z\' fill=\'%23fbbf24\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' }}></div>
            )}
            
            <div className="p-5 flex flex-col h-full justify-between z-10 relative">
                <div>
                   <h3 className="text-[9px] font-bold uppercase border-b border-blue-400/30 pb-1.5 mb-2.5 text-blue-300 tracking-widest">Ketentuan Kartu Pelajar</h3>
                   <ul className="text-[7.5px] space-y-1.5 list-none pl-1 text-slate-300">
                       <li className="flex gap-2"><div className="w-1 h-1 rounded-full bg-yellow-400 mt-1 flex-shrink-0"></div> Kartu ini adalah kartu identitas resmi Siswa LP Ma'arif NU Cilacap.</li>
                       <li className="flex gap-2"><div className="w-1 h-1 rounded-full bg-yellow-400 mt-1 flex-shrink-0"></div> Wajib dibawa saat mengikuti KBM dan kegiatan ekstrakurikuler.</li>
                       <li className="flex gap-2"><div className="w-1 h-1 rounded-full bg-yellow-400 mt-1 flex-shrink-0"></div> Dapat digunakan untuk sistem absensi digital dan perpustakaan.</li>
                       <li className="flex gap-2"><div className="w-1 h-1 rounded-full bg-yellow-400 mt-1 flex-shrink-0"></div> Jika kartu ini hilang, segera lapor ke admin sekolah masing-masing.</li>
                   </ul>
                </div>

                <div className="flex justify-between items-end pb-1">
                    {/* QR/Barcode (Attendance focus) */}
                    <div className="bg-white/10 p-1.5 rounded-lg border border-white/20 shadow-md flex flex-col items-center backdrop-blur-sm">
                       <div className="bg-white p-1 rounded-md">
                           <QRCodeSVG value={student.nisn || ""} size={60} level="M" />
                       </div>
                       <span className="text-[5px] mt-1.5 text-yellow-400 font-mono tracking-[0.15em] font-semibold">NISN: {student.nisn}</span>
                    </div>

                    {/* Signature Area */}
                    <div className="text-center pr-2">
                        <p className="text-[7.5px] text-slate-400 mb-6 font-medium">Cilacap, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric'})}</p>
                        <div className="flex flex-col items-center pt-2">
                            {/* Stylized Signature Image could go here */}
                            <p className="text-[10px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500 border-b border-yellow-500/30 pb-1 mb-1 px-4 tracking-wide">Ali Sodiqin, S.Ag., M.Pd.I.</p>
                            <p className="text-[6.5px] uppercase tracking-[0.15em] text-blue-300 font-semibold">Ketua PC LP Ma'arif NU</p>
                        </div>
                    </div>
                </div>
            </div>
          </div>

      </div>

      {/* ACTIONS */}
      <div className="flex gap-4 no-print mt-4">
        <Button onClick={handlePrint} className="bg-blue-700 hover:bg-blue-800">
            <Printer className="w-4 h-4 mr-2" /> Cetak Kartu Pelajar
        </Button>
      </div>
    </div>
  );
}
