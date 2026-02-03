import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { QRCodeSVG } from "qrcode.react";

interface KtaCardProps {
  teacher: {
    nama: string;
    nuptk: string;
    unitKerja?: string;
    photoId?: Id<"_storage">;
    nip?: string;
    // Add other fields as needed
  };
}

export default function KtaCard({ teacher }: KtaCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Fetch Photo URL
  const photoUrl = useQuery(api.teachers.getPhotoUrl, teacher.photoId ? { storageId: teacher.photoId } : "skip");
  
  // Verification URL (points to public verify page)
  const verifyUrl = `${import.meta.env.VITE_APP_URL || window.location.origin}/verify/teacher/${teacher.nuptk || "unknown"}`;

  const handlePrint = () => {
    // Simple print logic - in real app might use html2canvas or print-css
    window.print();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* CARD CONTAINER (CR-80 Size approx 85.6mm x 54mm) -> Aspect Ratio ~1.58 */}
      {/* We use pixel width 500px for display clarity */}
      <div 
        ref={cardRef}
        className="w-[500px] h-[316px] bg-gradient-to-br from-green-600 to-green-800 rounded-xl shadow-2xl relative overflow-hidden text-white"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
        
        {/* HEADER */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-white/10 backdrop-blur-sm border-b border-white/20 flex items-center px-4 justify-between">
           <div className="flex items-center gap-3">
              <img src="/logo-maarif.png" alt="Logo" className="h-10 w-10 drop-shadow-md" /> {/* Ensure logo exists or use fallback */}
              <div className="flex flex-col">
                 <h1 className="text-sm font-bold tracking-wider leading-tight uppercase text-yellow-300">Kartu Tanda Anggota</h1>
                 <h2 className="text-[10px] uppercase tracking-widest text-white/80">LP Ma'arif NU Cilacap</h2>
              </div>
           </div>
           <div className="text-right">
              <span className="block text-[8px] opacity-70">NUPTK / ID</span>
              <span className="font-mono font-bold text-lg tracking-wider text-white shadow-black drop-shadow-sm">{teacher.nuptk || "---"}</span>
           </div>
        </div>

        {/* BODY */}
        <div className="absolute top-20 left-4 right-4 bottom-4 flex gap-4">
           {/* PHOTO AREA */}
           <div className="w-28 h-36 bg-white rounded-lg border-2 border-yellow-400 shadow-lg overflow-hidden flex-shrink-0">
               {photoUrl ? (
                   <img src={photoUrl} className="w-full h-full object-cover" alt="Foto" />
               ) : (
                   <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs text-center p-2">
                       No Photo
                   </div>
               )}
           </div>
           
           {/* DETAILS */}
           <div className="flex-1 flex flex-col justify-start pt-1 space-y-2">
              <div>
                  <label className="text-[9px] uppercase text-green-200 block">Nama Lengkap</label>
                  <p className="font-bold text-lg leading-tight text-white capitalize line-clamp-2">{teacher.nama}</p>
              </div>
              <div>
                  <label className="text-[9px] uppercase text-green-200 block">Unit Kerja / Satminkal</label>
                  <p className="font-medium text-sm text-yellow-100 line-clamp-2">{teacher.unitKerja}</p>
              </div>
              {teacher.nip && (
                  <div>
                    <label className="text-[9px] uppercase text-green-200 block">NIP</label>
                    <p className="font-mono text-xs text-white">{teacher.nip}</p>
                </div>
              )}
           </div>

           {/* QR CODE */}
           <div className="absolute bottom-0 right-0 p-2 bg-white rounded-lg shadow-md">
              <QRCodeSVG value={verifyUrl} size={64} />
           </div>
        </div>
        
        {/* FOOTER STRIP */}
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-yellow-500/90 flex items-center justify-center">
            <span className="text-[8px] text-green-900 font-bold uppercase tracking-widest">Berkhidmat untuk Ummat • Mencerdaskan Bangsa</span>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Cetak / Save PDF
        </Button>
        <Button disabled>
            <Download className="w-4 h-4 mr-2" /> Download PNG (Coming Soon)
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center max-w-[500px]">
          * Gunakan fitur "Print to PDF" browser untuk menyimpan kartu ini dengan kualitas tinggi. Pastikan opsi "Background Graphics" dicentang pada pengaturan print.
      </p>
    </div>
  );
}
