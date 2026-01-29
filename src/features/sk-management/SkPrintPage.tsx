import { useRef, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Id } from "../../../convex/_generated/dataModel"
import QRCode from "react-qr-code"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Printer } from "lucide-react"

export default function SkPrintPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    
    // Fetch SK Data
    const sk = useQuery(api.sk.get, id ? { id: id as Id<"skDocuments"> } : "skip")

    const handlePrint = () => {
        window.print()
    }

    if (sk === undefined) return <div className="p-10 text-center">Memuat data...</div>
    if (sk === null) return <div className="p-10 text-center">Data tidak ditemukan</div>

    // Full Verification URL
    const verificationUrl = `${window.location.origin}/verify/${sk._id}`

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8 print:bg-white print:py-0">
            {/* Action Bar - Hidden when printing */}
            <div className="w-full max-w-[210mm] flex justify-between items-center mb-6 print:hidden px-4 sm:px-0">
                <Button variant="outline" onClick={() => navigate(-1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                </Button>
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" /> Cetak Sekarang
                </Button>
            </div>

            {/* A4 Paper Container */}
            <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[20mm] shadow-lg print:shadow-none print:w-full print:max-w-none print:p-0">
                {/* Header Kop Surat */}
                <div className="flex items-center gap-4 border-b-4 border-double border-black pb-4 mb-8 text-center justify-center">
                   <div className="w-24 h-24 bg-slate-200 flex items-center justify-center rounded-full overflow-hidden">
                       <img src="/logo_maarif.png" alt="Logo" className="w-full h-full object-cover" 
                            onError={(e) => { e.currentTarget.style.display = 'none' }} />
                       {/* Fallback if no logo */}
                       <span className="text-xs text-slate-400">Logo</span>
                   </div>
                   <div className="flex-1">
                        <h4 className="font-bold text-lg uppercase tracking-wide">Lembaga Pendidikan Ma'arif NU</h4>
                        <h2 className="font-bold text-2xl uppercase tracking-wider">Cabang Kabupaten Pasuruan</h2>
                        <p className="text-sm">Jalan Raya Warungdowo No. 99, Pohjentrek, Pasuruan</p>
                        <p className="text-sm">Email: pcmaarifpasuruan@gmail.com | Website: simmaci.com</p>
                   </div>
                </div>

                {/* SK Content */}
                <div className="text-center mb-8">
                     <h3 className="font-bold text-xl underline uppercase decoration-2 underline-offset-4">Surat Keputusan</h3>
                     <p className="font-medium mt-1">Nomor: {sk.nomorSk || "____________________"}</p>
                </div>

                <div className="space-y-6 text-justify leading-relaxed">
                    <p>
                        Berdasarkan hasil rapat pengurus dan pertimbangan kebutuhan organisasi, 
                        Ketua Lembaga Pendidikan Ma'arif NU Cabang Kabupaten Pasuruan dengan ini menetapkan:
                    </p>

                    <table className="w-full">
                        <tbody>
                            <tr>
                                <td className="w-40 font-bold py-1 align-top">Nama</td>
                                <td className="w-4 py-1 align-top">:</td>
                                <td className="py-1 align-top uppercase font-bold">{sk.nama}</td>
                            </tr>
                            <tr>
                                <td className="font-bold py-1 align-top">Unit Kerja</td>
                                <td className="py-1 align-top">:</td>
                                <td className="py-1 align-top">{sk.unitKerja}</td>
                            </tr>
                            <tr>
                                <td className="font-bold py-1 align-top">Tentang</td>
                                <td className="py-1 align-top">:</td>
                                <td className="py-1 align-top capitalize">{sk.jenisSk}</td>
                            </tr>
                            <tr>
                                <td className="font-bold py-1 align-top">Status</td>
                                <td className="py-1 align-top">:</td>
                                <td className="py-1 align-top capitalize">{sk.status}</td>
                            </tr>
                        </tbody>
                    </table>

                    <p>
                        Bahwa nama tersebut dipandang cakap dan mampu untuk melaksanakan tugas yang diamanahkan. 
                        Surat Keputusan ini berlaku sejak tanggal ditetapkan dan dapat ditinjau kembali jika terdapat kekeliruan.
                    </p>

                    <div className="my-8 p-4 border rounded bg-slate-50 print:bg-transparent print:border-none">
                        <p className="font-bold mb-2">Catatan Tambahan:</p>
                        <p>{"Tidak ada catatan khusus."}</p>
                    </div>
                </div>

                {/* Footer / TTD */}
                <div className="mt-16 flex justify-between items-end">
                     {/* QR Code Validation */}
                     <div className="text-center">
                         <div className="border p-2 bg-white inline-block">
                             <QRCode 
                                value={verificationUrl}
                                size={100}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                viewBox={`0 0 256 256`}
                             />
                         </div>
                         <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">Scan Untuk Validasi</p>
                         <p className="text-[8px] text-slate-400">{sk._id}</p>
                     </div>

                     <div className="text-center min-w-[200px]">
                         <p>Ditetapkan di: Pasuruan</p>
                         <p>Pada Tanggal: {new Date(sk.createdAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
                         <div className="mt-8 mb-20 relative">
                             {/* Space for stamp/sign */}
                             <p className="font-bold">Ketua LP Ma'arif NU</p>
                             <p className="font-bold">Kabupaten Pasuruan</p>
                         </div>
                         <p className="font-bold underline decoration-1 underline-offset-4 decoration-slate-400">H. AHMAD ADIP MUHLISIN, M.Pd.I</p>
                     </div>
                </div>
            </div>
        </div>
    )
}
