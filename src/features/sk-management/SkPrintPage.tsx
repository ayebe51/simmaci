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

                {/* Header Kop Surat - Pasuruan Style matched to Template color/layout */}
                {/* A4 Paper Container */}
                <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[15mm] shadow-lg print:shadow-none print:w-full print:max-w-none print:p-0 text-black">
                    <div className="flex items-start gap-4 border-b-4 border-double border-black pb-2 mb-6 justify-center">
                   <div className="w-24 h-24 flex items-start justify-center pt-2">
                       <img src="/logo_maarif.png" alt="Logo" className="w-full object-contain" 
                            onError={(e) => { e.currentTarget.style.display = 'none' }} />
                   </div>
                   <div className="flex-1 text-center font-serif text-green-700">
                        <h4 className="font-bold text-lg uppercase tracking-wide leading-tight">PENGURUS CABANG NAHDLATUL ULAMA KABUPATEN PASURUAN</h4>
                        <h2 className="font-bold text-2xl uppercase tracking-wider leading-tight">LEMBAGA PENDIDIKAN MA'ARIF NU</h2>
                        <div className="text-xs text-black font-sans mt-1 space-y-0.5">
                            <p>Jalan Raya Warungdowo No. 99, Pohjentrek, Pasuruan Telp. (0343) 421234</p>
                            <p>Email: pcmaarifpasuruan@gmail.com | Website: www.maarifpasuruan.org</p>
                        </div>
                   </div>
                </div>

                {/* SK Title */}
                <div className="text-center mb-6 font-serif">
                     <h3 className="font-bold text-lg underline uppercase decoration-1 underline-offset-4">SURAT KEPUTUSAN</h3>
                     <p className="font-bold text-sm mt-1">Nomor : {sk.nomorSk || "..../PC.L/A.II/...../2024"}</p>
                     
                     <div className="mt-4 mb-2">
                         <p className="font-bold text-sm uppercase">TENTANG</p>
                         <p className="font-bold text-sm uppercase">PENGANGKATAN {sk.jenisSk || "GURU TETAP YAYASAN"}</p>
                         <p className="font-bold text-sm uppercase">DI LINGKUNGAN PENGURUS CABANG LEMBAGA PENDIDIKAN MA'ARIF NU KABUPATEN PASURUAN</p>
                     </div>
                </div>

                <div className="text-justify text-[13px] leading-tight font-serif space-y-2 relative">
                    {/* Floating Layout for 'Menimbang' etc */}
                    <div className="flex">
                        <div className="w-32 font-bold shrink-0">Menimbang</div>
                        <div className="w-4 text-center shrink-0">:</div>
                        <div className="flex-1">
                            <ol className="list-[lower-alpha] pl-4 space-y-1">
                                <li>
                                    <span className="absolute left-[145px] -ml-4">1.</span>
                                    Bahwa Pembangunan nasional dalam bidang pendidikan adalah upaya mencerdaskan kehidupan bangsa dan meningkatkan kualitas manusia Indonesia.
                                </li>
                                <li>
                                    <span className="absolute left-[145px] -ml-4">2.</span>
                                    Bahwa untuk merealisasikan hal tersebut diatas perlu ditetapkan formasi Tenaga Pendidik dan Kependidikan di Lingkungan Pengurus Cabang LP Ma'arif NU.
                                </li>
                                <li>
                                    <span className="absolute left-[145px] -ml-4">3.</span>
                                    Bahwa berdasarkan pertimbangan angka 1 dan 2, perlu diterbitkan Surat Keputusan.
                                </li>
                            </ol>
                        </div>
                    </div>

                    <div className="flex">
                        <div className="w-32 font-bold shrink-0">Mengingat</div>
                        <div className="w-4 text-center shrink-0">:</div>
                        <div className="flex-1">
                            <ol className="list-decimal pl-4 space-y-1 relative">
                                <li>
                                    <span className="absolute left-0 -ml-4">1.</span>
                                    Undang – Undang Nomor 20 Tahun 2003 tentang Sistem Pendidikan Nasional.
                                </li>
                                <li>
                                    <span className="absolute left-0 -ml-4">2.</span>
                                    Peraturan Menteri Pendidikan Nasional Nomor 13 tahun 2007.
                                </li>
                                <li>
                                    <span className="absolute left-0 -ml-4">3.</span>
                                    AD/ART Lembaga Pendidikan Ma'arif NU.
                                </li>
                            </ol>
                        </div>
                    </div>

                    <div className="flex">
                        <div className="w-32 font-bold shrink-0">Memperhatikan</div>
                        <div className="w-4 text-center shrink-0">:</div>
                        <div className="flex-1">
                            <ol className="list-decimal pl-4 space-y-1 relative">
                                <li>
                                    <span className="absolute left-0 -ml-4">1.</span>
                                    Hasil Rapat Pengurus Harian LP Ma'arif NU Cabang Pasuruan.
                                </li>
                                <li>
                                    <span className="absolute left-0 -ml-4">2.</span>
                                    Surat Permohonan dari {sk.unitKerja}.
                                </li>
                            </ol>
                        </div>
                    </div>

                    <div className="text-center py-4 font-bold">
                        MEMUTUSKAN :
                    </div>

                    <div className="flex">
                        <div className="w-32 font-bold shrink-0">Menetapkan</div>
                        <div className="w-4 text-center shrink-0">:</div>
                        <div className="flex-1"></div>
                    </div>
                    
                    <div className="flex">
                        <div className="w-32 font-bold shrink-0">Pertama</div>
                        <div className="w-4 text-center shrink-0">:</div>
                        <div className="flex-1">
                            <p className="mb-2">Identitas Personil tersebut di bawah ini :</p>
                            <table className="w-full mb-2">
                                <tbody>
                                    <tr>
                                        <td className="w-5 font-bold">1.</td>
                                        <td className="w-32">Nama</td>
                                        <td className="w-4">:</td>
                                        <td className="font-bold uppercase">{sk.nama}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold">2.</td>
                                        <td>Tempat/Tgl Lahir</td>
                                        <td>:</td>
                                        <td>-</td> 
                                    </tr>
                                    <tr>
                                        <td className="font-bold">3.</td>
                                        <td>NUPTK</td>
                                        <td>:</td>
                                        <td>{sk.teacher?.nuptk || "-"}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold">4.</td>
                                        <td>Pendidikan</td>
                                        <td>:</td>
                                        <td>-</td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold">5.</td>
                                        <td>Unit Kerja</td>
                                        <td>:</td>
                                        <td>{sk.unitKerja}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold">6.</td>
                                        <td>TMT</td>
                                        <td>:</td>
                                        <td>{new Date(sk.createdAt).toLocaleDateString('id-ID')}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p className="indent-0">
                                Terhitung mulai tanggal ditetapkan, diangkat kembali sebagai {sk.jenisSk} pada {sk.unitKerja}, diberikan hak-hak sesuai dengan ketentuan yang berlaku.
                            </p>
                        </div>
                    </div>

                    <div className="flex">
                        <div className="w-32 font-bold shrink-0">Kedua</div>
                        <div className="w-4 text-center shrink-0">:</div>
                        <div className="flex-1">
                            <p>
                                Keputusan ini berlaku sejak tanggal ditetapkan sampai dengan 1 Tahun, dan apabila ada kekeliruan dikemudian hari akan diadakan perbaikan sebagaimana mestinya.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Section - Precise Layout Match */}
                <div className="mt-8 relative font-serif text-[13px]">
                     {/* Right Side: Date & Signatures */}
                     <div className="ml-auto w-[60%] relative">
                         {/* Date Block */}
                         <div className="flex leading-tight">
                             <div className="w-24">Ditetapkan di</div>
                             <div className="w-4">:</div>
                             <div>Pasuruan</div>
                         </div>
                         <div className="flex leading-tight mb-4">
                             <div className="w-24">Pada Tanggal</div>
                             <div className="w-4">:</div>
                             <div>{new Date(sk.createdAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</div>
                         </div>

                         {/* QR Code BOX - Absolute Right of the Date Block */}
                         <div className="absolute right-0 top-0 w-[80px] h-[80px] border border-black p-1 bg-white">
                             <QRCode 
                                value={verificationUrl}
                                size={70}
                                style={{ height: "100%", width: "100%" }}
                                viewBox={`0 0 256 256`}
                             />
                         </div>

                         {/* Signature Header */}
                         <div className="text-center mt-2 pr-[80px]"> {/* pr-80px to account for QR box visual balance if needed, or just standard center */}
                             <p className="font-bold uppercase">PENGURUS CABANG NAHDLATUL ULAMA</p>
                             <p className="font-bold uppercase">LEMBAGA PENDIDIKAN MA'ARIF</p>
                             <p className="font-bold uppercase">KABUPATEN PASURUAN</p>
                         </div>
                         
                         {/* Signatures Columns */}
                         <div className="flex justify-between mt-16 pr-[20px]">
                             <div className="text-center relative">
                                 {/* Optional Sekretaris Slot */}
                             </div>
                             
                             <div className="text-center relative min-w-[150px] mr-12">
                                 <p className="font-bold underline decoration-1 underline-offset-2 uppercase mb-1">H. AHMAD ADIP MUHLISIN, M.Pd.I</p>
                                 <p className="font-bold">Ketua</p>
                             </div>
                         </div>
                     </div>

                     {/* Tembusan - Bottom Left Absolute */}
                     <div className="absolute bottom-0 left-0 text-[11px] w-[35%]">
                         <p className="underline decoration-1 mb-1">Tembusan dikirim Kepada Yth.:</p>
                         <ol className="list-decimal pl-4 space-y-0 leading-tight">
                            <li>LP Ma'arif PWNU Jawa Timur</li>
                            <li>PCNU Kabupaten Pasuruan</li>
                            <li>Arsip</li>
                         </ol>
                         <p className="text-[8px] text-slate-300 mt-2">rev.2405</p>
                     </div>
                </div>
            </div>
        </div>
    )
}
