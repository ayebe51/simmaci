import { useRef, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { skApi } from "@/lib/api"
import { getSkVerificationUrl } from "@/utils/verification"
import QRCode from "react-qr-code"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Printer, Loader2 } from "lucide-react"

function parseIndonesianDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null
    const months: Record<string, number> = {
        Januari: 0, Februari: 1, Maret: 2, April: 3, Mei: 4, Juni: 5,
        Juli: 6, Agustus: 7, September: 8, Oktober: 9, November: 10, Desember: 11
    }
    // Try "D Bulan YYYY" format (e.g. "1 Juli 2026")
    const m = dateStr.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/)
    if (m) {
        const month = months[m[2]]
        if (month !== undefined) return new Date(parseInt(m[3]), month, parseInt(m[1]))
    }
    // Fallback to native parse
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
}

export default function SkPrintPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    
    // 🔥 REST API QUERY
    const { data: sk, isLoading } = useQuery({
        queryKey: ['sk-document', id],
        queryFn: () => skApi.get(Number(id)),
        enabled: !!id
    })

    const handlePrint = () => {
        window.print()
    }

    if (isLoading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Menyiapkan Dokumen Cetak...</span>
        </div>
    )

    if (!sk) return <div className="p-10 text-center font-bold text-red-500 uppercase tracking-widest">Data tidak ditemukan</div>

    const verificationUrl = getSkVerificationUrl(sk.nomor_sk)

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8 print:bg-white print:py-0">
            {/* Action Bar - Hidden when printing */}
            <div className="w-full max-w-[210mm] flex justify-between items-center mb-6 print:hidden px-4 sm:px-0">
                <Button variant="ghost" onClick={() => navigate(-1)} className="text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-blue-600">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                </Button>
                <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] px-6 rounded-xl shadow-lg shadow-blue-100">
                    <Printer className="mr-2 h-4 w-4" /> Cetak Sekarang
                </Button>
            </div>

            {/* Document Content */}
            <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[15mm] shadow-lg print:shadow-none print:w-full print:max-w-none print:p-0 text-black font-sans relative">
                <div className="flex items-center gap-4 border-b-[3px] border-double border-green-700 pb-2 mb-6 justify-center relative">
                    <div className="w-24 h-24 flex items-center justify-center absolute left-0">
                        <img src="/logo_maarif.png" alt="Logo" className="w-full object-contain" />
                    </div>
                    
                    <div className="flex-1 text-center text-green-700 w-full pl-24 pr-24">
                        <h4 className="font-bold text-xl uppercase tracking-wide leading-none font-serif">PENGURUS CABANG NAHDLATUL ULAMA CILACAP</h4>
                        <h2 className="font-bold text-2xl uppercase tracking-wider leading-none mt-1 font-serif">LEMBAGA PENDIDIKAN MA'ARIF NU</h2>
                        <div className="text-[11px] text-black font-sans mt-2 leading-tight">
                            <p>Jl Masjid No I/36 Kel.Sidanegara Kec. Cilacap Tengah Kab. Cilacap</p>
                            <p>Telepon (0280) 521141 Call Center 082227438003</p>
                            <div className="flex justify-center gap-4 text-blue-700 font-semibold mt-1">
                                <span>📧 email.maarifnucilacap@gmail.com</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SK Title */}
                <div className="text-center mb-6 font-sans">
                     <h3 className="font-bold text-lg underline uppercase decoration-1 underline-offset-4">SURAT KEPUTUSAN</h3>
                     <p className="font-bold text-sm mt-1">Nomor : {sk.nomor_sk || "..../PC.L/A.II/...../2026"}</p>
                     
                     <div className="mt-4 mb-2">
                         <p className="font-bold text-sm uppercase">TENTANG</p>
                         <p className="font-bold text-sm uppercase">PENGANGKATAN {sk.jenis_sk || "GURU TETAP YAYASAN"}</p>
                         <p className="font-bold text-sm uppercase">DI LINGKUNGAN PENGURUS CABANG LEMBAGA PENDIDIKAN MA'ARIF NU KABUPATEN CILACAP</p>
                     </div>
                </div>

                <div className="text-justify text-[13px] leading-tight font-sans space-y-2 relative">
                    <div className="flex items-start">
                        <div className="w-28 font-bold shrink-0">Menimbang</div>
                        <div className="w-4 text-center shrink-0">:</div>
                        <div className="flex-1">
                            <ol className="list-decimal pl-4 space-y-1">
                                <li>Bahwa Pembangunan nasional dalam bidang pendidikan adalah upaya mencerdaskan kehidupan bangsa dan meningkatkan kualitas manusia Indonesia yang beriman, bertakwa, dan berakhlak mulia.</li>
                                <li>Bahwa untuk merealisasikan hal tersebut diatas perlu ditetapkan formasi Tenaga Pendidik dan Kependidikan di Lingkungan Pengurus Cabang LP Ma'arif NU Kabupaten Cilacap.</li>
                                <li>Bahwa berdasarkan pertimbangan angka 1 dan 2, perlu diterbitkan Surat Keputusan.</li>
                            </ol>
                        </div>
                    </div>

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

                    <div className="text-center py-4 font-bold">MEMUTUSKAN :</div>
                    
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
                                        <td>{sk.teacher?.tempat_lahir || "-"}, {sk.teacher?.tanggal_lahir ? new Date(sk.teacher.tanggal_lahir).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : "-"}</td> 
                                    </tr>
                                    <tr>
                                        <td>3.</td>
                                        <td>Nomor Induk</td>
                                        <td>:</td>
                                        <td>{sk.teacher?.nuptk || sk.teacher?.nip || "-"}</td>
                                    </tr>
                                    <tr>
                                        <td>4.</td>
                                        <td>Unit Kerja</td>
                                        <td>:</td>
                                        <td>{sk.unit_kerja}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p className="indent-0 text-justify">
                                Terhitung mulai tanggal <span className="font-bold">{(parseIndonesianDate(sk.tanggal_penetapan) || new Date(sk.created_at)).toLocaleDateString('id-ID')}</span> diangkat kembali sebagai {sk.jenis_sk} pada {sk.unit_kerja}, diberikan hak-hak sesuai dengan ketentuan yang berlaku.
                            </p>
                         </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 relative font-sans text-[13px]">
                     <div className="flex justify-end mb-6 pr-10">
                        <div className="w-auto">
                            <div className="flex">
                                <div className="w-24 text-[11px] font-bold">Ditetapkan di</div>
                                <div className="w-4 text-[11px]">:</div>
                                <div className="text-[11px]">Cilacap</div>
                            </div>
                            <div className="flex">
                                <div className="w-24 text-[11px] font-bold">Pada Tanggal</div>
                                <div className="w-4 text-[11px]">:</div>
                                <div className="text-[11px]">{(parseIndonesianDate(sk.tanggal_penetapan) || new Date(sk.created_at)).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</div>
                            </div>
                        </div>
                     </div>
                     
                     <div className="text-center font-bold mb-8">
                         <p className="uppercase text-[12px]">PENGURUS CABANG NAHDLATUL ULAMA</p>
                         <p className="uppercase text-[12px]">LEMBAGA PENDIDIKAN MA'ARIF</p>
                         <p className="uppercase text-[12px]">KABUPATEN CILACAP</p>
                     </div>

                     <div className="flex justify-between px-10 mt-16 font-bold">
                         <div className="text-center w-64 border-t border-black pt-1">
                             <p className="uppercase text-[11px]">ALI SODIQIN, S.Ag., M.Pd.I</p>
                             <p className="text-[10px] opacity-60">Ketua</p>
                         </div>
                         <div className="text-center w-64 border-t border-black pt-1">
                             <p className="uppercase text-[11px]">NGADINO, S.Pd.I</p>
                             <p className="text-[10px] opacity-60">Sekretaris</p>
                         </div>
                     </div>

                     <div className="absolute bottom-[-10px] right-0 border border-black p-1 bg-white">
                         <QRCode value={verificationUrl} size={80} viewBox={`0 0 256 256`} />
                     </div>
                </div>
            </div>
        </div>
    )
}
