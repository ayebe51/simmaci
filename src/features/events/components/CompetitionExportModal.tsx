import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Printer, Trophy, Download, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { settingApi } from '@/lib/api';

interface CompetitionExportModalProps {
  competition: any;
  participants: any[];
  filterJenjang?: string;
  trigger?: React.ReactNode;
}

export default function CompetitionExportModal({
  competition,
  participants = [],
  filterJenjang = 'all',
  trigger,
}: CompetitionExportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [kopUrl, setKopUrl] = useState<string>('');
  const [kopCandidates, setKopCandidates] = useState<string[]>([]);
  const [kopCandidateIndex, setKopCandidateIndex] = useState<number>(0);
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);

  // Fetch official kop surat template from settings (uploaded in Settings page)
  useEffect(() => {
    const fetchKop = async () => {
      try {
        let val: string | null = null;
        try {
          const res = await settingApi.get('kop_surat_meeting');
          val = res?.data?.value ?? res?.value ?? null;
        } catch {
          // fallback to list
          const listRes = await settingApi.list();
          const listData = listRes?.data ?? listRes;
          if (Array.isArray(listData)) {
            val = listData.find((s: any) => s?.key === 'kop_surat_meeting')?.value ?? null;
          } else if (listData && typeof listData === 'object') {
            val = listData.kop_surat_meeting?.value ?? listData.kop_surat_meeting ?? null;
          }
        }

        if (val && typeof val === 'string' && val !== 'null' && val !== 'undefined' && val.trim() !== '') {
          if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:')) {
            setKopCandidates([val]);
            setKopUrl(val);
          } else {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
            const cleanPath = val.replace(/^\/?(storage\/|api\/minio\/|api\/files\/view\/)?/, '');
            const candidateUrls = [
              `${apiUrl}/files/view/${cleanPath.split('/').map(encodeURIComponent).join('/')}`,
              `${apiUrl}/minio/${cleanPath}`,
              `/storage/${cleanPath}`,
              `/${cleanPath}`
            ];
            setKopCandidates(candidateUrls);
            setKopCandidateIndex(0);
            setKopUrl(candidateUrls[0]);
          }
        }
      } catch (err) {
        console.warn('Could not load kop_surat_meeting setting:', err);
      }
    };

    fetchKop();
  }, []);

  // Filter participants by jenjang if selected
  const filtered = participants.filter(
    (p) => filterJenjang === 'all' || p.jenjang === filterJenjang
  );

  // Sort participants by rank (1, 2, 3, etc.) then by score descending
  const sorted = [...filtered].sort((a, b) => {
    const rankA = a.result?.rank ?? 9999;
    const rankB = b.result?.rank ?? 9999;
    if (rankA !== rankB) return rankA - rankB;

    const scoreA = Number(a.result?.score ?? a.total_score ?? 0);
    const scoreB = Number(b.result?.score ?? b.total_score ?? 0);
    return scoreB - scoreA;
  });

  // Extract all distinct jury names across participants
  const allJuryNames = Array.from(
    new Set(
      participants.flatMap((p) =>
        (p.jury_scores ?? []).map((js: any) => js.jury_name).filter(Boolean)
      )
    )
  );

  const getRankTitle = (rank?: number) => {
    if (!rank) return '-';
    if (rank === 1) return 'Juara I 🥇';
    if (rank === 2) return 'Juara II 🥈';
    if (rank === 3) return 'Juara III 🥉';
    if (rank === 4) return 'Harapan I';
    if (rank === 5) return 'Harapan II';
    if (rank === 6) return 'Harapan III';
    return `Peringkat ${rank}`;
  };

  // ── 1. Export Excel (.xlsx) ────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (sorted.length === 0) {
      toast.error('Tidak ada data peserta untuk diexport.');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Meta Header info
      const eventName = competition?.event?.name || competition?.event || 'Event LP Ma\'arif NU';
      const compName  = competition?.name || 'Cabang Lomba';
      const jenjangStr = filterJenjang !== 'all' ? filterJenjang : (competition?.jenjang || 'Semua Jenjang');

      const headers = [
        ['PENGURUS CABANG LEMBAGA PENDIDIKAN MA\'ARIF NU CILACAP'],
        ['REKAPITULASI PENILAIAN DEWAN JURI & HASIL KEJUARAAN'],
        [`Event: ${eventName}`],
        [`Cabang Lomba: ${compName} | Jenjang: ${jenjangStr}`],
        [`Tanggal Unduh: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`],
        [], // empty row
      ];

      // Build data rows
      const dataRows = sorted.map((p, idx) => {
        const rowData: Record<string, any> = {
          'No': idx + 1,
          'Peringkat / Juara': getRankTitle(p.result?.rank),
          'Nama Peserta / Pendaftar': p.name || p.applicant_name || '-',
          'Asal Lembaga / Madrasah': p.institution || p.school_name || '-',
          'Jenjang': p.jenjang || compName,
        };

        // If specific jury scores exist, add each jury's score
        if (allJuryNames.length > 0) {
          allJuryNames.forEach((jName) => {
            const js = (p.jury_scores ?? []).find((s: any) => s.jury_name === jName);
            rowData[`Nilai (${jName})`] = js ? Number(js.score).toFixed(2) : '-';
          });
        }

        const finalScore = p.result?.score != null
          ? Number(p.result.score).toFixed(2)
          : (p.total_score != null ? Number(p.total_score).toFixed(2) : '-');

        rowData['Nilai Akhir (Rata-rata)'] = finalScore;
        rowData['Catatan Dewan Juri'] = p.result?.notes || p.reviewer_notes || '-';

        return rowData;
      });

      const ws = XLSX.utils.aoa_to_sheet(headers);
      XLSX.utils.sheet_add_json(ws, dataRows, { origin: headers.length });

      // Auto-fit column widths
      const colWidths = [
        { wch: 6 },  // No
        { wch: 18 }, // Juara
        { wch: 28 }, // Nama
        { wch: 32 }, // Lembaga
        { wch: 14 }, // Jenjang
        ...allJuryNames.map(() => ({ wch: 18 })), // Tiap Juri
        { wch: 24 }, // Nilai Akhir
        { wch: 35 }, // Catatan
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Rekapitulasi Nilai');

      const sanitizedName = compName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Rekap_Nilai_${sanitizedName}_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success('Rekap nilai berhasil diunduh ke Excel (.xlsx)', {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      });
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor file Excel.');
    }
  };

  // ── 2. Print Berita Acara PDF ─────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  const currentDateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2 font-bold text-xs h-9">
            <Download size={14} className="text-emerald-600" /> Export / Cetak
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border-0 rounded-2xl shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Rekapitulasi Nilai & Berita Acara Kejuaraan
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-1">
                {competition?.name} • {filterJenjang !== 'all' ? `Jenjang ${filterJenjang}` : (competition?.jenjang || 'Semua Jenjang')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg cursor-pointer select-none transition-colors mr-1">
                <input
                  type="checkbox"
                  checked={includeSignatures}
                  onChange={(e) => setIncludeSignatures(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>TTD & Stempel Resmi</span>
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="gap-1.5 text-xs font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Unduh Excel (.xlsx)
              </Button>
              <Button
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
              >
                <Printer className="w-4 h-4" />
                Cetak Berita Acara (PDF)
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Document Paper Container (A4 preview) ── */}
        <div className="p-6 bg-slate-100 flex justify-center">
          <div
            id="printable-berita-acara"
            className="bg-white w-full max-w-[210mm] min-h-[297mm] p-8 sm:p-12 shadow-md rounded-xl text-black font-sans relative border print:border-0 print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full"
          >
            {/* ── KOP SURAT RESMI LP MA'ARIF NU CILACAP (DARI SETTING APLIKASI) ── */}
            {kopUrl ? (
              <div className="mb-6 pb-2 border-b-[3px] border-double border-green-700">
                <img
                  src={kopUrl}
                  alt="Kop Surat Resmi LP Ma'arif NU Cilacap"
                  className="w-full h-auto max-h-40 object-contain mx-auto block print:max-h-none print:w-full"
                  onError={() => {
                    const next = kopCandidateIndex + 1;
                    if (next < kopCandidates.length) {
                      setKopCandidateIndex(next);
                      setKopUrl(kopCandidates[next]);
                    } else {
                      setKopUrl('');
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-4 border-b-[3px] border-double border-green-700 pb-2 mb-6 justify-center relative">
                <div className="w-24 h-24 flex items-center justify-center absolute left-0">
                  <img
                    src="/logo-nu.png"
                    alt="Logo Ma'arif NU"
                    className="w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src = '/logo_maarif.png';
                    }}
                  />
                </div>

                <div className="flex-1 text-center text-green-700 w-full pl-24 pr-4">
                  <h4 className="font-bold text-lg sm:text-xl uppercase tracking-wide leading-none font-serif">
                    PENGURUS CABANG NAHDLATUL ULAMA CILACAP
                  </h4>
                  <h2 className="font-bold text-xl sm:text-2xl uppercase tracking-wider leading-none mt-1.5 font-serif">
                    LEMBAGA PENDIDIKAN MA'ARIF NU
                  </h2>
                  <div className="text-[11px] text-black font-sans mt-2 leading-tight space-y-0.5">
                    <p>Jl. Masjid No I/36 Kel. Sidanegara Kec. Cilacap Tengah Kab. Cilacap</p>
                    <p>Telepon: (0280) 521141 | Call Center: 082227438003</p>
                    <div className="flex justify-center gap-4 text-blue-700 font-semibold mt-0.5">
                      <span>📧 email.maarifnuclp@gmail.com</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── JUDUL DOKUMEN ── */}
            <div className="text-center mb-6">
              <h3 className="font-black text-base uppercase underline decoration-2 underline-offset-4 tracking-wider">
                BERITA ACARA HASIL PENILAIAN DEWAN JURI
              </h3>
              <p className="font-bold text-xs uppercase tracking-wide text-slate-800 mt-1">
                {competition?.event?.name || competition?.event || 'HARLAH LP MA\'ARIF NU KE-97 TAHUN 2026'}
              </p>
            </div>

            {/* ── IDENTITAS CABANG LOMBA ── */}
            <div className="mb-6 text-xs text-slate-800 space-y-1 bg-slate-50/60 p-3 rounded-lg border border-slate-200">
              <div className="grid grid-cols-4 gap-2">
                <span className="font-bold text-slate-600">Cabang Lomba</span>
                <span className="col-span-3 font-semibold text-slate-900">: {competition?.name}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <span className="font-bold text-slate-600">Kategori / Jenjang</span>
                <span className="col-span-3 font-semibold text-slate-900">
                  : {competition?.category} • {filterJenjang !== 'all' ? filterJenjang : (competition?.jenjang || 'Semua Jenjang')}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <span className="font-bold text-slate-600">Waktu & Tempat</span>
                <span className="col-span-3 font-semibold text-slate-900">
                  : {competition?.date ? new Date(competition.date).toLocaleDateString('id-ID', { dateStyle: 'full' }) : '-'} {competition?.location ? `(${competition.location})` : ''}
                </span>
              </div>
            </div>

            {/* ── TABEL REKAPITULASI HASIL ── */}
            <div className="mb-6">
              <p className="text-xs font-bold text-slate-800 mb-2 uppercase">
                A. Hasil Rekapitulasi & Peringkat Kejuaraan:
              </p>
              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="border border-slate-300 p-2 text-center w-8">No</th>
                    <th className="border border-slate-300 p-2 text-left w-28">Peringkat / Juara</th>
                    <th className="border border-slate-300 p-2 text-left">Nama Peserta / Pendaftar</th>
                    <th className="border border-slate-300 p-2 text-left">Asal Madrasah / Sekolah</th>
                    {allJuryNames.map((jName, i) => (
                      <th key={i} className="border border-slate-300 p-2 text-center w-16 text-[10px] leading-tight">
                        {jName}
                      </th>
                    ))}
                    <th className="border border-slate-300 p-2 text-center w-20 font-black">Nilai Akhir</th>
                    <th className="border border-slate-300 p-2 text-left w-24">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={6 + allJuryNames.length} className="border border-slate-300 p-4 text-center text-slate-400">
                        Belum ada data nilai peserta.
                      </td>
                    </tr>
                  ) : (
                    sorted.map((p, idx) => {
                      const finalScore = p.result?.score != null
                        ? Number(p.result.score).toFixed(2)
                        : (p.total_score != null ? Number(p.total_score).toFixed(2) : '-');

                      const isWinner = p.result?.rank && p.result.rank <= 3;

                      return (
                        <tr
                          key={idx}
                          className={
                            p.result?.rank === 1
                              ? 'bg-amber-50/50 font-medium'
                              : p.result?.rank === 2
                              ? 'bg-slate-50'
                              : p.result?.rank === 3
                              ? 'bg-orange-50/30'
                              : ''
                          }
                        >
                          <td className="border border-slate-300 p-1.5 text-center">{idx + 1}</td>
                          <td className="border border-slate-300 p-1.5 font-bold">
                            {isWinner ? (
                              <span className="text-amber-700 flex items-center gap-1">
                                {getRankTitle(p.result?.rank)}
                              </span>
                            ) : (
                              getRankTitle(p.result?.rank)
                            )}
                          </td>
                          <td className="border border-slate-300 p-1.5 font-semibold text-slate-900">
                            {p.name || p.applicant_name}
                          </td>
                          <td className="border border-slate-300 p-1.5 text-slate-700">
                            {p.institution || p.school_name}
                          </td>
                          {allJuryNames.map((jName, jIdx) => {
                            const js = (p.jury_scores ?? []).find((s: any) => s.jury_name === jName);
                            return (
                              <td key={jIdx} className="border border-slate-300 p-1.5 text-center font-mono">
                                {js ? Number(js.score).toFixed(2) : '-'}
                              </td>
                            );
                          })}
                          <td className="border border-slate-300 p-1.5 text-center font-black font-mono text-slate-900 bg-slate-50/80">
                            {finalScore}
                          </td>
                          <td className="border border-slate-300 p-1.5 text-[11px] text-slate-600">
                            {p.result?.notes || p.reviewer_notes || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── KLAUSUL BERITA ACARA ── */}
            <div className="text-[11px] text-slate-700 leading-relaxed mb-8">
              <p>
                Demikian Berita Acara Hasil Penilaian ini dibuat dengan sebenarnya dan sejujur-jujurnya berdasarkan
                akumulasi penilaian objektif Dewan Juri yang bertugas. Keputusan Dewan Juri bersifat mutlak dan tidak
                dapat diganggu gugat.
              </p>
            </div>

            {/* ── TANDA TANGAN DEWAN JURI & PANITIA ── */}
            <div className="pt-2 text-xs">
              <div className="flex justify-end mb-4">
                <p className="text-slate-800">
                  Cilacap, {currentDateFormatted}
                </p>
              </div>

              {/* Baris Dewan Juri */}
              <div className="mb-6">
                <p className="font-bold text-center mb-3 uppercase tracking-wider text-slate-900">
                  DEWAN JURI PENILAI:
                </p>
                <div
                  className={`grid ${
                    allJuryNames.length === 1
                      ? 'grid-cols-1 max-w-xs mx-auto'
                      : allJuryNames.length === 2
                      ? 'grid-cols-2 max-w-lg mx-auto'
                      : 'grid-cols-3'
                  } gap-4 text-center`}
                >
                  {(allJuryNames.length > 0 ? allJuryNames : ['Juri 1', 'Juri 2', 'Juri 3']).map((jName, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <p className="font-bold text-slate-700 text-[11px] mb-12">
                        {jName.startsWith('Juri') ? jName : `Juri ${idx + 1}`}
                      </p>
                      <p className="font-bold border-b border-slate-800 pb-0.5 px-3 min-w-[140px]">
                        ( {jName} )
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Baris Mengetahui (Ketua PC LP Ma'arif NU Cilacap) */}
              <div className="mt-8 flex justify-center text-center">
                <div className="flex flex-col items-center relative">
                  <p className="text-[11px] text-slate-700">Mengetahui,</p>
                  <p className="font-bold text-slate-900 uppercase text-[11px] mb-1">
                    Ketua PC LP Ma'arif NU Cilacap
                  </p>
                  {includeSignatures ? (
                    <div className="relative h-20 w-48 flex justify-center items-center my-1">
                      {/* Official Stamp & Signature */}
                      <img
                        src="/stempel-maarif-asli.png"
                        alt="Stempel LP Ma'arif"
                        className="absolute -left-2 -top-1 h-20 w-auto object-contain mix-blend-multiply opacity-90 pointer-events-none"
                      />
                      <img
                        src="/ttd-ketua-asli.png"
                        alt="Tanda Tangan Ketua"
                        className="absolute top-1 h-16 w-auto object-contain mix-blend-multiply z-10 pointer-events-none"
                      />
                    </div>
                  ) : (
                    <div className="h-20" />
                  )}
                  <p className="font-bold border-b border-slate-900 pb-0.5 px-6 min-w-[200px] text-slate-900 text-xs">
                    ( H. Ali Sodiqin, S.Ag., M.Pd.I. )
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CSS PRINT STYLES ── */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-berita-acara,
            #printable-berita-acara * {
              visibility: visible;
            }
            #printable-berita-acara {
              position: absolute;
              left: 0;
              top: 0;
              width: 100% !important;
              max-width: 100% !important;
              padding: 10mm !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
