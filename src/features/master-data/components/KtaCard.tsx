import { useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { QRCodeSVG } from "qrcode.react";

interface KtaCardProps {
  teacher: {
    nama: string;
    nuptk: string;
    unitKerja?: string;
    photoId?: Id<"_storage"> | string;
    nip?: string;
    // Add other fields as needed
  };
}

export default function KtaCard({ teacher }: KtaCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Load templates from settings/localstorage (fallback to defaults)
  const templateFront = typeof window !== 'undefined' ? localStorage.getItem("kta_template_front_blob") : null;
  const templateBack = typeof window !== 'undefined' ? localStorage.getItem("kta_template_back_blob") : null;

  // Fetch Photo URL Logic
  const isStorageId = teacher.photoId && !teacher.photoId.startsWith("http");
  const storageUrl = useQuery(api.teachers.getPhotoUrl, isStorageId ? { storageId: teacher.photoId as Id<"_storage"> } : "skip");
  
  // Final URL to display (with drive normalization)
  const displayUrl = useMemo(() => {
    const rawUrl = isStorageId ? storageUrl : teacher.photoId;
    if (rawUrl && typeof rawUrl === 'string' && rawUrl.includes("drive.google.com")) {
        const match = rawUrl.match(/id=([a-zA-Z0-9_-]+)/) || rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
    }
    return rawUrl;
  }, [isStorageId, storageUrl, teacher.photoId]);
  
  const baseUrl = (import.meta.env as any).VITE_APP_URL || window.location.origin;
  const verifyUrl = `${baseUrl}/verify/teacher/${teacher.nuptk || "unknown"}`;

  const handlePrint = () => {
    window.print();
  };

  const cardStyle = {
    width: "480px", // Standard CR80 is approx 480px at 150dpi or similar
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
            #kta-print-area, #kta-print-area * {
               visibility: visible;
            }
            #kta-print-area {
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
            /* Ensure colors print correctly */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>

      {/* PRINT CONTAINER */}
      <div id="kta-print-area" className="flex flex-col md:flex-row gap-6 items-center justify-center">
          
          {/* FRONT SIDE */}
          <div 
            style={{
                ...cardStyle,
                backgroundImage: templateFront ? `url(${templateFront})` : "linear-gradient(to bottom right, #059669, #064e3b)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)"
            }}
            className="border border-slate-200/20"
          >
            {!templateFront && (
                <>
                {/* Default Header if no template */}
                <div className="absolute top-0 left-0 right-0 h-14 bg-white/10 backdrop-blur-sm border-b border-white/20 flex items-center px-4 justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/logo-maarif.png" alt="Logo" className="h-8 w-8" />
                        <div>
                            <h1 className="text-[10px] font-bold text-yellow-300 uppercase leading-none">Anggota LP Ma'arif NU</h1>
                            <h2 className="text-[8px] text-white/80 uppercase">Kabupaten Cilacap</h2>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="block text-[7px] opacity-70 uppercase">ID Anggota</span>
                        <span className="font-mono font-bold text-md text-white">{teacher.nuptk || "---"}</span>
                    </div>
                </div>
                </>
            )}

            {/* Common Elements (Drawn over template too) */}
            <div className={`absolute ${templateFront ? 'top-12' : 'top-20'} left-4 right-4 bottom-4 flex gap-4`}>
                {/* PHOTO */}
                <div className="w-24 h-32 bg-white rounded border border-yellow-400 shadow-md overflow-hidden flex-shrink-0">
                    {displayUrl ? (
                        <img src={displayUrl} className="w-full h-full object-cover" alt="Profile" crossOrigin="anonymous" />
                    ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-[10px]">No Photo</div>
                    )}
                </div>

                {/* INFO */}
                <div className="flex-1 flex flex-col justify-start pt-1 space-y-2">
                    <div>
                        <label className="text-[8px] uppercase opacity-70 block">Nama Lengkap</label>
                        <p className="font-bold text-md leading-tight text-white capitalize line-clamp-2">{teacher.nama}</p>
                    </div>
                    <div>
                        <label className="text-[8px] uppercase opacity-70 block">Unit Kerja</label>
                        <p className="font-medium text-xs text-yellow-100 line-clamp-2">{teacher.unitKerja}</p>
                    </div>
                    {teacher.nip && teacher.nip !== "-" && (
                        <div>
                            <label className="text-[8px] uppercase opacity-70 block">NIP / PEGID</label>
                            <p className="font-mono text-[10px]">{teacher.nip}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Strip if no template */}
            {!templateFront && (
                <div className="absolute bottom-0 left-0 right-0 h-3 bg-yellow-500/90 flex items-center justify-center">
                    <span className="text-[7px] text-green-900 font-bold uppercase tracking-widest">Bermutu Dalam Ilmu • Bermartabat Dalam Sikap</span>
                </div>
            )}
          </div>

          {/* BACK SIDE */}
          <div 
            style={{
                ...cardStyle,
                backgroundImage: templateBack ? `url(${templateBack})` : "white",
                backgroundColor: "white",
                backgroundSize: "cover",
                backgroundPosition: "center",
                color: "black",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)"
            }}
            className="border border-slate-300"
          >
            {/* Rules / Ketentuan (Shown if no template or explicitly overlayed) */}
            <div className="p-4 flex flex-col h-full justify-between">
                <div>
                   <h3 className="text-[10px] font-bold uppercase border-b pb-1 mb-2 text-green-800">Ketentuan Kartu</h3>
                   <ul className="text-[8px] space-y-1 list-disc pl-3 text-slate-600">
                       <li>Kartu ini adalah identitas resmi Anggota LP Ma'arif NU Cilacap.</li>
                       <li>Wajib dibawa saat mengikuti program/kegiatan resmi organisasi.</li>
                       <li>Dilarang menyalahgunakan kartu ini untuk tindakan melanggar hukum.</li>
                       <li>Jika menemukan kartu ini, harap kembalikan ke kantor PC LP Ma'arif NU Kab. Cilacap.</li>
                   </ul>
                </div>

                <div className="flex justify-between items-end pb-2">
                    {/* QR Code */}
                    <div className="bg-white p-1 rounded border shadow-sm flex flex-col items-center">
                       <QRCodeSVG value={verifyUrl} size={64} />
                       <span className="text-[6px] mt-1 text-slate-400 font-mono tracking-tighter">SCAN TO VERIFY</span>
                    </div>

                    {/* Signature Area */}
                    <div className="text-right pr-2">
                        <p className="text-[8px] text-slate-500 mb-6">Cilacap, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric'})}</p>
                        <p className="text-[9px] font-bold border-t border-slate-300 pt-1">H. Munawir, M.Pd.</p>
                        <p className="text-[7px] uppercase tracking-wide opacity-70">Ketua PC LP Ma'arif NU</p>
                    </div>
                </div>
            </div>
          </div>

      </div>

      {/* ACTIONS */}
      <div className="flex gap-4 no-print mt-4">
        <Button onClick={handlePrint} className="bg-green-700 hover:bg-green-800">
            <Printer className="w-4 h-4 mr-2" /> Cetak / Simpan PDF
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground max-w-md text-center no-print pb-6">
          * Gunakan profil "Print to PDF" pada browser untuk menyimpan. Aktifkan opsi "Background Graphics" agar template latar belakang tercetak sempurna.
      </p>
    </div>
  );
}
