import { useState, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, Search, CreditCard, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import QRCode from "qrcode";
import { useEffect } from "react";

export default function KtaGeneratorPage() {
  const [search, setSearch] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  // Fetch teachers for search
  // Fetch teachers for search (Use listAll for legacy behavior)
  const teachers = useQuery(api.teachers.listAll, { 
      // No pagination args needed
  }) || [];

  const filteredTeachers = search 
    ? teachers.filter((t: any) => t.nama?.toLowerCase().includes(search.toLowerCase()) || t.nip?.includes(search))
    : [];

  useEffect(() => {
    if (selectedTeacher) {
        // Generate QR Code containing the validation URL
        const validationUrl = `${window.location.origin}/verify/${selectedTeacher._id}`;
        QRCode.toDataURL(validationUrl, { width: 128, margin: 1 }, (err, url) => {
            if (!err) setQrCodeUrl(url);
        });
    }
  }, [selectedTeacher]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#004D40]">KTA Digital</h1>
          <p className="text-muted-foreground">Generator Kartu Tanda Anggota LP Ma'arif</p>
        </div>
        <div>
            {selectedTeacher && (
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" /> Cetak Kartu
                </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SEARCH PANEL */}
        <Card className="print:hidden md:col-span-1">
          <CardHeader>
            <CardTitle>Cari Guru</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Nama atau NIP..." 
                className="pl-8" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="border rounded-md h-[400px] overflow-y-auto">
                {filteredTeachers.length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">
                        {search ? "Tidak ditemukan" : "Ketik nama untuk mencari..."}
                    </div>
                )}
                {filteredTeachers.map((t: any) => (
                    <div 
                        key={t._id} 
                        className={`p-3 border-b cursor-pointer hover:bg-slate-50 ${selectedTeacher?._id === t._id ? 'bg-green-50 border-green-200' : ''}`}
                        onClick={() => setSelectedTeacher(t)}
                    >
                        <div className="font-bold text-sm">{t.nama}</div>
                        <div className="text-xs text-gray-500">{t.nip || "Tanpa NIP"}</div>
                        <div className="text-xs text-gray-500">{t.unitKerja}</div>
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* PREVIEW PANEL */}
        <div className="md:col-span-2 print:col-span-3 print:w-full">
            {selectedTeacher ? (
                <div className="flex flex-col items-center justify-center space-y-8 print:space-y-4">
                    
                    {/* ID CARD FRONT */}
                    <div className="w-[85.6mm] h-[53.98mm] bg-gradient-to-r from-green-700 to-green-900 rounded-xl shadow-2xl relative overflow-hidden print:shadow-none print:border border-gray-300 text-white break-inside-avoid">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-10 bg-[url('/pattern.png')]"></div>
                        
                        {/* Header */}
                        <div className="absolute top-4 left-4 flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                                {/* Logo placeholder */}
                                <img src="/logo-maarif.png" alt="Logo" className="w-8 h-8 object-contain" onError={(e) => e.currentTarget.style.display='none'} />
                                <span className="text-green-800 font-bold text-xs">NU</span>
                            </div>
                            <div>
                                <h2 className="text-[10px] font-bold tracking-widest uppercase text-green-100">Lembaga Pendidikan Ma'arif NU</h2>
                                <h1 className="text-sm font-black tracking-tight">KARTU TANDA ANGGOTA</h1>
                            </div>
                        </div>

                        {/* Photo */}
                        <div className="absolute top-16 left-4">
                            <div className="w-20 h-24 bg-white rounded-md border-2 border-green-200 shadow-sm overflow-hidden">
                                {selectedTeacher.fotoProfile ? (
                                    <img src={selectedTeacher.fotoProfile} alt="Foto Profil" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-100">
                                        <div className="text-4xl">👤</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Data */}
                        <div className="absolute top-16 left-28 right-4 text-sm space-y-1">
                            <div>
                                <div className="text-[9px] text-green-200 uppercase">Nama Lengkap</div>
                                <div className="font-bold text-md leading-tight">{selectedTeacher.nama}</div>
                            </div>
                            <div>
                                <div className="text-[9px] text-green-200 uppercase">NIP / PEGID</div>
                                <div className="font-mono">{selectedTeacher.nip || "-"}</div>
                            </div>
                            <div>
                                <div className="text-[9px] text-green-200 uppercase">Unit Kerja</div>
                                <div className="leading-tight text-xs">{selectedTeacher.unitKerja}</div>
                            </div>
                            <div>
                                <div className="text-[9px] text-green-200 uppercase">Status</div>
                                <div className="text-xs badge badge-sm bg-green-800 bg-opacity-50 px-2 py-0.5 rounded inline-block">
                                    {selectedTeacher.statusKepegawaian || "Aktif"}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="absolute bottom-2 right-4 text-[8px] opacity-70">
                            Berlaku s/d: <span className="font-bold">Seumur Hidup</span>
                        </div>
                    </div>

                    {/* ID CARD BACK */}
                    <div className="w-[85.6mm] h-[53.98mm] bg-white rounded-xl shadow-2xl relative overflow-hidden print:shadow-none print:border border-gray-300 text-black break-inside-avoid">
                        <div className="absolute top-4 left-4 right-4 text-center">
                            <h3 className="font-bold text-sm uppercase border-b pb-2 mb-2">Ketentuan Kartu</h3>
                            <ul className="text-[8px] text-left space-y-1 list-disc pl-4 text-gray-600">
                                <li>Kartu ini adalah identitas resmi Anggota LP Ma'arif NU Cilacap.</li>
                                <li>Harap dibawa saat kegiatan resmi kelembagaan.</li>
                                <li>Jika menemukan kartu ini, harap kembalikan ke kantor PC LP Ma'arif NU Cilacap.</li>
                            </ul>
                        </div>

                        <div className="absolute bottom-4 left-4 flex items-end gap-3">
                             <div className="border p-1 rounded bg-white">
                                {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16" />}
                             </div>
                             <div className="text-[8px] text-gray-500 mb-1">
                                 Scan untuk validasi data anggota.
                             </div>
                        </div>

                        <div className="absolute bottom-4 right-4 text-right">
                             <div className="text-[9px] text-gray-500">Mengetahui,</div>
                             <div className="text-[9px] font-bold">Ketua PC LP Ma'arif NU</div>
                             <div className="h-8"></div> {/* Signature Space */}
                             <div className="text-[9px] font-bold underline">H. Munawir, M.Pd.</div>
                        </div>
                    </div>

                </div>
            ) : (
                <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-gray-400">
                    <CreditCard className="w-16 h-16 mb-4 opacity-20" />
                    <p>Pilih guru untuk menampilkan Preview KTA</p>
                </div>
            )}
        </div>
      </div>

      <style type="text/css" media="print">
        {`
          @page { size: auto; margin: 0; }
          body { -webkit-print-color-adjust: exact; background-color: white; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:col-span-3 { grid-column: span 3 / span 3; }
        `}
      </style>
    </div>
  );
}
