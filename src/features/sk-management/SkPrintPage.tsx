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

                {/* Header Kop Surat - Match Image 2 */}
                <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[15mm] shadow-lg print:shadow-none print:w-full print:max-w-none print:p-0 text-black font-sans relative">
                    <div className="flex items-center gap-4 border-b-[3px] border-double border-green-700 pb-2 mb-6 justify-center relative">
                       {/* Left Logo */}
                       <div className="w-24 h-24 flex items-center justify-center absolute left-0">
                           <img src="/logo_maarif.png" alt="Logo" className="w-full object-contain" 
                                onError={(e) => { e.currentTarget.style.display = 'none' }} />
                       </div>
                       
                       <div className="flex-1 text-center text-green-700 w-full pl-24 pr-24">
                            <h4 className="font-bold text-xl uppercase tracking-wide leading-none font-serif">PENGURUS CABANG NAHDLATUL ULAMA CILACAP</h4>
                            <h2 className="font-bold text-2xl uppercase tracking-wider leading-none mt-1 font-serif">LEMBAGA PENDIDIKAN MA'ARIF NU</h2>
                            <div className="text-[11px] text-black font-sans mt-2 leading-tight">
                                <p>Jl Masjid No I/36 Kel.Sidanegara Kec. Cilacap Tengah Kab. Cilacap</p>
                                <p>Telepon (0280) 521141 Call Center 082227438003</p>
                                <div className="flex justify-center gap-4 text-blue-700 font-semibold">
                                    <span>📧 email.maarifnucilacap@gmail.com</span>
                                    <span>📺 LP Ma'arif NU Cilacap</span>
                                    <span>facebook Ma'arif NU Cilacap</span>
                                </div>
                            </div>
                       </div>
                    </div>

                    {/* SK Title */}
                    <div className="text-center mb-6 font-sans">
                         <h3 className="font-bold text-lg underline uppercase decoration-1 underline-offset-4">SURAT KEPUTUSAN</h3>
                         <p className="font-bold text-sm mt-1">Nomor : {sk.nomorSk || "..../PC.L/A.II/...../2026"}</p>
                         
                         <div className="mt-4 mb-2">
                             <p className="font-bold text-sm uppercase">TENTANG</p>
                             <p className="font-bold text-sm uppercase">PENGANGKATAN {sk.jenisSk || "GURU TETAP YAYASAN"}</p>
                             <p className="font-bold text-sm uppercase">DI LINGKUNGAN PENGURUS CABANG LEMBAGA PENDIDIKAN MA'ARIF NU KABUPATEN CILACAP</p>
                         </div>
                    </div>

                    <div className="text-justify text-[13px] leading-tight font-sans space-y-2 relative">
                        {/* Menimbang */}
                        <div className="flex items-start">
                            <div className="w-28 font-bold shrink-0">Menimbang</div>
                            <div className="w-4 text-center shrink-0">:</div>
                            <div className="flex-1">
                                <ol className="list-decimal pl-4 space-y-1">
                                    <li>
                                        Bahwa Pembangunan nasional dalam bidang pendidikan adalah upaya mencerdaskan kehidupan bangsa dan meningkatkan kualitas manusia Indonesia yang beriman, bertakwa, dan berakhlak mulia.
                                    </li>
                                    <li>
                                        Bahwa untuk merealisasikan hal tersebut diatas perlu ditetapkan formasi Tenaga Pendidik dan Kependidikan di Lingkungan Pengurus Cabang LP Ma'arif NU Kabupaten Cilacap.
                                    </li>
                                    <li>
                                        Bahwa berdasarkan pertimbangan angka 1 dan 2, perlu diterbitkan Surat Keputusan.
                                    </li>
                                </ol>
                            </div>
                        </div>

                        {/* Mengingat */}
                        <div className="flex items-start">
                            <div className="w-28 font-bold shrink-0">Mengingat</div>
                            <div className="w-4 text-center shrink-0">:</div>
                            <div className="flex-1">
                                <ol className="list-decimal pl-4 space-y-1">
                                    <li>Undang – Undang Nomor 20 Tahun 2003 tentang Sistem Pendidikan Nasional.</li>
                                    <li>Undang – Undang Nomor 14 Tahun 2005 tentang Guru dan Dosen.</li>
                                    <li>Peraturan Pemerintah Nomor 19 Tahun 2005 tentang Standar Pendidikan Nasional.</li>
                                    <li>Peraturan Menteri Pendidikan Nasional Nomor 13 tahun 2007 tentang Pendidik dan Tenaga Kependidikan.</li>
                                    <li>Peraturan Lembaga Pendidikan Ma'arif NU.</li>
                                </ol>
                            </div>
                        </div>

                        {/* Memperhatikan */}
                        <div className="flex items-start">
                            <div className="w-28 font-bold shrink-0">Memperhatikan</div>
                            <div className="w-4 text-center shrink-0">:</div>
                            <div className="flex-1">
                                <ol className="list-decimal pl-4 space-y-1">
                                    <li>Hasil Rakernas Pengurus Pusat LP Ma'arif NU Tahun 2022.</li>
                                    <li>Peraturan Pengurus Wilayah LP Ma'arif NU Jawa Tengah Nomor: 02/PW.11/LPMNU/PPW/2014.</li>
                                    <li>Program Kerja Pengurus Cabang Lembaga Pendidikan Ma'arif NU Cilacap Masa Khidmat 2024-2029.</li>
                                </ol>
                            </div>
                        </div>

                        <div className="text-center py-4 font-bold">
                            MEMUTUSKAN :
                        </div>
                        
                        <div className="flex items-start">
                            <div className="w-28 font-bold shrink-0">Menetapkan</div>
                            <div className="w-4 text-center shrink-0">:</div>
                            <div className="flex-1 font-bold underline">Identitas Personil tersebut di bawah ini</div>
                        </div>

                        <div className="flex items-start">
                             <div className="w-28 font-bold shrink-0">Pertama</div>
                             <div className="w-4 text-center shrink-0">:</div>
                             <div className="flex-1">
                                <table className="w-full mb-2">
                                    <tbody>
                                        <tr>
                                            <td className="w-5">1.</td>
                                            <td className="w-32">Nama</td>
                                            <td className="w-4">:</td>
                                            <td className="font-bold uppercase">{sk.nama}</td>
                                        </tr>
                                        <tr>
                                            <td>2.</td>
                                            <td>Tempat/Tgl Lahir</td>
                                            <td>:</td>
                                            <td>{sk.teacher?.tempatLahir || "-"}, {sk.teacher?.tanggalLahir ? new Date(sk.teacher.tanggalLahir).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : "-"}</td> 
                                        </tr>
                                        <tr>
                                            <td>3.</td>
                                            <td>Nomor Induk</td>
                                            <td>:</td>
                                            <td>{sk.teacher?.nuptk || "-"}</td>
                                        </tr>
                                        <tr>
                                            <td>4.</td>
                                            <td>Unit Kerja</td>
                                            <td>:</td>
                                            <td>{sk.unitKerja}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <p className="indent-0 text-justify">
                                    Terhitung mulai tanggal <span className="font-bold">{new Date(sk.createdAt).toLocaleDateString('id-ID')}</span> diangkat kembali sebagai {sk.jenisSk} pada {sk.unitKerja}, diberikan hak-hak sesuai dengan ketentuan yang berlaku.
                                </p>
                             </div>
                        </div>

                        <div className="flex items-start">
                            <div className="w-28 font-bold shrink-0">Kedua</div>
                            <div className="w-4 text-center shrink-0">:</div>
                            <div className="flex-1 text-justify">
                                Keputusan ini berlaku sejak tanggal ditetapkan sampai dengan 1 Tahun, dan apabila ada kekeliruan dikemudian hari akan diadakan perbaikan sebagaimana mestinya.
                            </div>
                        </div>
                    </div>

                    {/* Footer / Signatures - Match Image 2 */}
                    <div className="mt-12 relative font-sans text-[13px]">
                         
                         {/* Date */}
                         <div className="flex justify-end mb-6 pr-10">
                            <div className="w-auto">
                                <div className="flex">
                                    <div className="w-24">Ditetapkan di</div>
                                    <div className="w-4">:</div>
                                    <div>Cilacap</div>
                                </div>
                                <div className="flex">
                                    <div className="w-24">Pada Tanggal</div>
                                    <div className="w-4">:</div>
                                    <div>{new Date(sk.createdAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</div>
                                </div>
                            </div>
                         </div>
                         
                         <div className="text-center font-bold mb-8">
                             <p>PENGURUS CABANG NAHDLATUL ULAMA</p>
                             <p>LEMBAGA PENDIDIKAN MA'ARIF</p>
                             <p>KABUPATEN CILACAP</p>
                         </div>

                         {/* Signatures */}
                         <div className="flex justify-between px-10 mt-16 font-bold">
                             <div className="text-center w-64">
                                 <p className="underline decoration-1 underline-offset-2 uppercase mb-1">ALI SODIQIN, S.Ag., M.Pd.I</p>
                                 <p>Ketua</p>
                             </div>
                             
                             <div className="text-center w-64">
                                 <p className="underline decoration-1 underline-offset-2 uppercase mb-1">NGADINO, S.Pd.I</p>
                                 <p>Sekretaris</p>
                             </div>
                         </div>

                         {/* QR Code - Bottom Right Absolute */}
                         <div className="absolute bottom-[-20px] right-0 border border-black p-1 bg-white">
                             <QRCode 
                                value={verificationUrl}
                                size={90}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                viewBox={`0 0 256 256`}
                             />
                         </div>

                         {/* Tembusan */}
                         <div className="mt-12 text-[10px]">
                             <p className="mb-1">Tembusan dikirim Kepada Yth.:</p>
                             <ol className="list-decimal pl-4">
                                <li>LP Ma'arif PWNU Jawa Timur</li>
                                <li>PCNU Kabupaten Cilacap</li>
                                <li>Arsip</li>
                             </ol>
                         </div>
                    </div>
            </div>
        </div>
    )
}
