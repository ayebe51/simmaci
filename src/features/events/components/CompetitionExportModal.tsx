import React, { useState } from 'react';
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
  const [viewScope, setViewScope] = useState<'winners' | 'all'>('winners');

  // Filter participants by jenjang if selected
  const filtered = participants.filter(
    (p) => filterJenjang === 'all' || p.jenjang === filterJenjang
  );

  // Check if there are ranked winners (Juara 1, 2, 3)
  const hasRankedWinners = filtered.some(
    (p) => p.result?.rank != null && p.result.rank >= 1 && p.result.rank <= 3
  );

  // Sort participants by rank (1, 2, 3) then by score descending
  const sorted = [...filtered].sort((a, b) => {
    const rankA = a.result?.rank ?? 9999;
    const rankB = b.result?.rank ?? 9999;
    if (rankA !== rankB) return rankA - rankB;

    const scoreA = Number(a.result?.score ?? a.total_score ?? 0);
    const scoreB = Number(b.result?.score ?? b.total_score ?? 0);
    return scoreB - scoreA;
  });

  // Display only Juara 1, 2, 3 when viewScope is 'winners' and winners exist, otherwise show all
  const displayedParticipants = (viewScope === 'winners' && hasRankedWinners)
    ? sorted.filter((p) => p.result?.rank != null && p.result.rank >= 1 && p.result.rank <= 3)
    : sorted;

  // Helper to identify organization or system account names that shouldn't be displayed as individual jury persons
  const isOrgOrSystemName = (name: string) => {
    if (!name) return true;
    const lower = name.toLowerCase().trim();
    return (
      lower.includes('ma\'arif') ||
      lower.includes('maarif') ||
      lower.includes('admin') ||
      lower.includes('operator') ||
      lower.includes('panitia') ||
      lower.includes('sekretariat') ||
      lower.includes('pengurus') ||
      lower.includes('pc lp')
    );
  };

  // Extract all distinct legitimate jury names across participants (excluding system/org accounts)
  const distinctJuryNames = Array.from(
    new Set(
      participants.flatMap((p) => {
        const scores = p.jury_scores ?? p.juryScores ?? p.result?.all_jury_scores ?? [];
        return scores.map((js: any) => js.jury_name || js.name).filter(Boolean);
      })
    )
  ).filter((name) => !isOrgOrSystemName(name));

  // Only show individual jury score columns if there are 2 or more distinct juries.
  // If only 1 jury or 0 juries exist, only show Nilai Akhir to avoid redundant columns.
  const showJuryColumns = distinctJuryNames.length > 1;

  // Build signatures list:
  // If distinct real juries exist, list them
  // If no distinct real juries exist, provide standard blank spots: Dewan Juri 1, 2, 3 with blank lines for manual signing
  const displayJuries = distinctJuryNames.length === 0
    ? [
        { label: 'Dewan Juri 1', name: '' },
        { label: 'Dewan Juri 2', name: '' },
        { label: 'Dewan Juri 3', name: '' },
      ]
    : distinctJuryNames.length === 1
    ? [
        { label: 'Dewan Juri 1', name: distinctJuryNames[0] },
        { label: 'Dewan Juri 2', name: '' },
        { label: 'Dewan Juri 3', name: '' },
      ]
    : distinctJuryNames.map((name, idx) => ({
        label: name.startsWith('Dewan') || name.startsWith('Juri') ? name : `Dewan Juri ${idx + 1}`,
        name: name.startsWith('Dewan') || name.startsWith('Juri') ? '' : name,
      }));

  const getRankTitle = (rank?: number, withEmoji = false) => {
    if (!rank || rank > 3) return '-';
    if (rank === 1) return withEmoji ? 'Juara I 🥇' : 'Juara I';
    if (rank === 2) return withEmoji ? 'Juara II 🥈' : 'Juara II';
    if (rank === 3) return withEmoji ? 'Juara III 🥉' : 'Juara III';
    return '-';
  };

  const getParticipantJuryScore = (p: any, juryName: string) => {
    const scores = p.jury_scores ?? p.juryScores ?? p.result?.all_jury_scores ?? [];
    const found = scores.find((s: any) => (s.jury_name || s.name) === juryName);
    if (!found) return '-';
    const sc = found.score ?? found.total_score;
    return sc != null && !isNaN(Number(sc)) ? Number(sc).toFixed(2) : '-';
  };

  const getParticipantFinalScore = (p: any) => {
    if (p.result?.score != null && !isNaN(Number(p.result.score)) && Number(p.result.score) > 0) {
      return Number(p.result.score).toFixed(2);
    }
    if (p.total_score != null && !isNaN(Number(p.total_score)) && Number(p.total_score) > 0) {
      return Number(p.total_score).toFixed(2);
    }
    const scores = p.jury_scores ?? p.juryScores ?? p.result?.all_jury_scores ?? [];
    if (scores.length > 0) {
      const valids = scores
        .map((s: any) => Number(s.score ?? s.total_score ?? 0))
        .filter((s: number) => !isNaN(s) && s > 0);
      if (valids.length > 0) {
        return (valids.reduce((a: number, b: number) => a + b, 0) / valids.length).toFixed(2);
      }
    }
    return '-';
  };

  const eventName = typeof competition?.event === 'object'
    ? competition?.event?.name
    : (competition?.event || 'HARLAH LP MA\'ARIF NU KE-97 TAHUN 2026');
  const compName = competition?.name || 'Cabang Lomba';
  const jenjangStr = filterJenjang !== 'all'
    ? filterJenjang
    : (competition?.jenjang || competition?.category || 'Semua Jenjang');
  const compDateFormatted = competition?.date
    ? new Date(competition.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const currentDateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const locationStr = competition?.location || 'LP Ma\'arif NU Cilacap';

  // ── 1. Export Excel (.xlsx) ────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (displayedParticipants.length === 0) {
      toast.error('Tidak ada data peserta untuk diexport.');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      const docTitle = (viewScope === 'winners' && hasRankedWinners)
        ? 'BERITA ACARA PENETAPAN KEJUARAAN (JUARA 1, 2, 3)'
        : 'BERITA ACARA HASIL PENILAIAN DEWAN JURI & REKAPITULASI KEJUARAAN';

      const headers = [
        [docTitle],
        [`Event: ${eventName}`],
        [`Cabang Lomba: ${compName} | Jenjang: ${jenjangStr}`],
        [`Hari / Tanggal: ${compDateFormatted}`],
        [`Tempat: ${locationStr}`],
        [], // empty row
      ];

      // Build data rows (hanya nilai, tanpa catatan, hanya juara 1, 2, 3)
      const dataRows = displayedParticipants.map((p, idx) => {
        const rowData: Record<string, any> = {
          'No': idx + 1,
          'Peringkat / Juara': getRankTitle(p.result?.rank, false),
          'Nama Peserta / Pendaftar': p.name || p.applicant_name || '-',
          'Asal Lembaga / Madrasah': p.institution || p.school_name || '-',
          'Jenjang': p.jenjang || compName,
        };

        // If multiple distinct jury scores exist, add each jury's score
        if (showJuryColumns) {
          distinctJuryNames.forEach((jName) => {
            rowData[`Nilai (${jName})`] = getParticipantJuryScore(p, jName);
          });
        }

        rowData['Nilai Akhir'] = getParticipantFinalScore(p);

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
        ...(showJuryColumns ? distinctJuryNames.map(() => ({ wch: 18 })) : []), // Tiap Juri
        { wch: 18 }, // Nilai Akhir
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Rekapitulasi Nilai');

      const sanitizedName = compName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Berita_Acara_${(viewScope === 'winners' && hasRankedWinners) ? 'Juara_1_2_3_' : 'Rekap_Nilai_'}${sanitizedName}_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success('Rekap nilai berhasil diunduh ke Excel (.xlsx)', {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      });
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor file Excel.');
    }
  };

  // ── 2. Print Berita Acara PDF via Isolated Iframe ──────────────────────────
  const handlePrint = () => {
    try {
      // Build standalone HTML for high-fidelity printing without dialog/overflow clipping
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.left = '-9999px';
      printIframe.style.top = '-9999px';
      printIframe.style.width = '210mm';
      printIframe.style.height = '297mm';
      printIframe.style.border = 'none';
      document.body.appendChild(printIframe);

      const doc = printIframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      // Generate HTML for jury columns in header (only if > 1 distinct juries)
      const juryHeaderCols = showJuryColumns
        ? distinctJuryNames.map((j) => `<th class="col-jury">${j}</th>`).join('')
        : '';

      // Generate table rows (scores only, no notes column, juara only 1, 2, 3)
      const tableRowsHtml = displayedParticipants.length === 0
        ? `<tr><td colspan="${4 + (showJuryColumns ? distinctJuryNames.length : 0) + 1}" style="text-align:center; padding:16px; color:#64748b;">Belum ada data nilai peserta.</td></tr>`
        : displayedParticipants.map((p, idx) => {
            const rankTitle = getRankTitle(p.result?.rank, false);
            const isWinner = p.result?.rank && p.result.rank <= 3;
            const finalScore = getParticipantFinalScore(p);

            const juryCellsHtml = showJuryColumns
              ? distinctJuryNames.map((jName) => `<td class="col-jury-score">${getParticipantJuryScore(p, jName)}</td>`).join('')
              : '';

            return `
              <tr class="${isWinner ? 'row-winner' : ''}">
                <td class="col-no">${idx + 1}</td>
                <td class="col-rank ${isWinner ? 'rank-highlight' : ''}">${rankTitle}</td>
                <td class="col-name">${p.name || p.applicant_name || '-'}</td>
                <td class="col-inst">${p.institution || p.school_name || '-'}</td>
                ${juryCellsHtml}
                <td class="col-final-score">${finalScore}</td>
              </tr>
            `;
          }).join('');

      // Generate Signatures Table
      const juryCount = displayJuries.length;
      let signatureRowsHtml = '';

      if (juryCount <= 3) {
        const cellWidth = Math.floor(100 / Math.max(juryCount, 1));
        const cells = displayJuries.map((j) => `
          <td style="width: ${cellWidth}%; text-align: center; vertical-align: top; padding: 0 12px;">
            <div class="jury-label">${j.label}</div>
            <div class="jury-space"></div>
            <div class="jury-name-line">${j.name ? `( ${j.name} )` : '(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)'}</div>
          </td>
        `).join('');
        signatureRowsHtml = `<tr>${cells}</tr>`;
      } else {
        // Chunk into rows of 3 and remainder
        const row1 = displayJuries.slice(0, 3);
        const row2 = displayJuries.slice(3);

        const cells1 = row1.map((j) => `
          <td style="width: 33.33%; text-align: center; vertical-align: top; padding: 0 12px;">
            <div class="jury-label">${j.label}</div>
            <div class="jury-space"></div>
            <div class="jury-name-line">${j.name ? `( ${j.name} )` : '(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)'}</div>
          </td>
        `).join('');

        const cells2 = row2.map((j) => `
          <td style="width: ${Math.floor(100 / row2.length)}%; text-align: center; vertical-align: top; padding: 16px 12px 0 12px;">
            <div class="jury-label">${j.label}</div>
            <div class="jury-space"></div>
            <div class="jury-name-line">${j.name ? `( ${j.name} )` : '(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)'}</div>
          </td>
        `).join('');

        signatureRowsHtml = `<tr>${cells1}</tr><tr>${cells2}</tr>`;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="utf-8" />
          <title>Berita Acara - ${compName} - ${eventName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 14mm 12mm 14mm 12mm;
              font-size: 9.5pt;
              line-height: 1.4;
            }
            .page-container {
              width: 100%;
              margin: 0 auto;
            }
            .doc-header {
              text-align: center;
              margin-bottom: 16px;
              padding-bottom: 8px;
              border-bottom: 2px solid #0f172a;
            }
            .doc-header h1 {
              font-size: 13pt;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              margin: 0 0 4px 0;
              color: #0f172a;
            }
            .doc-header h2 {
              font-size: 10.5pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.02em;
              margin: 0;
              color: #334155;
            }
            .meta-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 14px;
              font-size: 9.5pt;
            }
            .meta-table td {
              padding: 2.5px 0;
              vertical-align: top;
            }
            .meta-label {
              width: 150px;
              font-weight: bold;
              color: #1e293b;
            }
            .meta-sep {
              width: 14px;
              text-align: center;
              font-weight: bold;
              color: #1e293b;
            }
            .meta-val {
              font-weight: 600;
              color: #0f172a;
            }
            .section-heading {
              font-size: 9.5pt;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.02em;
              color: #0f172a;
              margin-bottom: 6px;
            }
            table.data-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 18px;
              font-size: 8.5pt;
            }
            table.data-table thead {
              display: table-header-group;
            }
            table.data-table th {
              background-color: #f1f5f9 !important;
              color: #0f172a;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 8.5pt;
              padding: 6px 5px;
              border: 1px solid #1e293b;
              text-align: center;
            }
            table.data-table td {
              padding: 5px 6px;
              border: 1px solid #334155;
              vertical-align: middle;
            }
            table.data-table tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            table.data-table tr.row-winner {
              background-color: #f8fafc;
            }
            .col-no {
              width: 28px;
              text-align: center;
            }
            .col-rank {
              width: 85px;
              text-align: center;
              font-weight: bold;
            }
            .rank-highlight {
              color: #0f172a;
            }
            .col-name {
              text-align: left;
              font-weight: 600;
              color: #0f172a;
            }
            .col-inst {
              text-align: left;
              color: #1e293b;
            }
            .col-jury {
              width: 65px;
              text-align: center;
              font-size: 8pt;
            }
            .col-jury-score {
              width: 65px;
              text-align: center;
              font-variant-numeric: tabular-nums;
            }
            .col-final-score {
              width: 75px;
              text-align: center;
              font-weight: bold;
              background-color: #f1f5f9 !important;
              font-variant-numeric: tabular-nums;
              font-size: 9pt;
            }
            .signatures-box {
              page-break-inside: avoid;
              break-inside: avoid;
              margin-top: 24px;
            }
            .signature-date {
              text-align: right;
              font-size: 9pt;
              font-weight: 600;
              color: #1e293b;
              margin-bottom: 12px;
            }
            .signature-title {
              text-align: center;
              font-size: 9.5pt;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #0f172a;
              margin-bottom: 14px;
            }
            table.signatures-table {
              width: 100%;
              border-collapse: collapse;
              border: none;
            }
            table.signatures-table td {
              border: none;
            }
            .jury-label {
              font-size: 9pt;
              font-weight: bold;
              color: #334155;
            }
            .jury-space {
              height: 60px;
            }
            .jury-name-line {
              font-size: 9pt;
              font-weight: bold;
              color: #0f172a;
              border-bottom: 1.5px solid #0f172a;
              display: inline-block;
              min-width: 150px;
              padding-bottom: 2px;
            }
          </style>
        </head>
        <body>
          <div class="page-container">
            <!-- Header Dokumen Formal -->
            <div class="doc-header">
              <h1>BERITA ACARA HASIL PENILAIAN DEWAN JURI</h1>
              <h2>${eventName}</h2>
            </div>

            <!-- Identitas Cabang Lomba -->
            <table class="meta-table">
              <tr>
                <td class="meta-label">Cabang Lomba</td>
                <td class="meta-sep">:</td>
                <td class="meta-val">${compName}</td>
              </tr>
              <tr>
                <td class="meta-label">Kategori / Jenjang</td>
                <td class="meta-sep">:</td>
                <td class="meta-val">${jenjangStr}</td>
              </tr>
              <tr>
                <td class="meta-label">Hari / Tanggal</td>
                <td class="meta-sep">:</td>
                <td class="meta-val">${compDateFormatted}</td>
              </tr>
              <tr>
                <td class="meta-label">Tempat Pelaksanaan</td>
                <td class="meta-sep">:</td>
                <td class="meta-val">${locationStr}</td>
              </tr>
            </table>

            <!-- Tabel Hasil Rekapitulasi (Hanya Nilai) -->
            <div class="section-heading">${
              viewScope === 'winners' && hasRankedWinners
                ? 'Hasil Penetapan Kejuaraan (Juara 1, 2, 3):'
                : 'Hasil Rekapitulasi & Penetapan Kejuaraan:'
            }</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th class="col-no">No</th>
                  <th class="col-rank">Peringkat / Juara</th>
                  <th>Nama Peserta / Pendaftar</th>
                  <th>Asal Madrasah / Sekolah</th>
                  ${juryHeaderCols}
                  <th class="col-final-score">Nilai Akhir</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>

            <!-- Tanda Tangan Dewan Juri Saja -->
            <div class="signatures-box">
              <div class="signature-date">Cilacap, ${currentDateFormatted}</div>
              <div class="signature-title">DEWAN JURI PENILAI:</div>
              <table class="signatures-table">
                ${signatureRowsHtml}
              </table>
            </div>
          </div>
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
        } catch (err) {
          console.error('Print iframe error:', err);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(printIframe)) {
              document.body.removeChild(printIframe);
            }
          }, 3000);
        }
      }, 300);
    } catch (e) {
      console.error(e);
      window.print();
    }
  };

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
                {compName} • {jenjangStr}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasRankedWinners && (
                <div className="flex items-center bg-slate-200/90 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setViewScope('winners')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      viewScope === 'winners'
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🏆 Hanya Juara (1, 2, 3)
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewScope('all')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      viewScope === 'all'
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📋 Semua Peserta ({filtered.length})
                  </button>
                </div>
              )}
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
                className="gap-1.5 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow"
              >
                <Printer className="w-4 h-4" />
                Cetak / Simpan PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Document Paper Container (A4 Preview) ── */}
        <div className="p-4 sm:p-6 bg-slate-200/70 flex justify-center">
          <div
            id="printable-berita-acara"
            className="bg-white w-full max-w-[210mm] min-h-[297mm] p-8 sm:p-12 shadow-xl rounded text-slate-900 font-sans relative border border-slate-200 print:border-0 print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full"
          >
            {/* ── JUDUL DOKUMEN FORMAL (TANPA KOP SURAT) ── */}
            <div className="text-center mb-5 pb-3 border-b-2 border-slate-900">
              <h2 className="font-extrabold text-base sm:text-lg uppercase tracking-wider text-slate-900 leading-tight">
                BERITA ACARA HASIL PENILAIAN DEWAN JURI
              </h2>
              <p className="font-bold text-xs sm:text-sm uppercase tracking-wide text-slate-700 mt-1">
                {eventName}
              </p>
            </div>

            {/* ── IDENTITAS CABANG LOMBA ── */}
            <table className="w-full mb-5 text-xs text-slate-900 leading-relaxed">
              <tbody>
                <tr>
                  <td className="w-36 font-bold text-slate-700 py-0.5">Cabang Lomba</td>
                  <td className="w-4 text-center font-bold py-0.5">:</td>
                  <td className="font-semibold py-0.5">{compName}</td>
                </tr>
                <tr>
                  <td className="font-bold text-slate-700 py-0.5">Kategori / Jenjang</td>
                  <td className="text-center font-bold py-0.5">:</td>
                  <td className="py-0.5">{jenjangStr}</td>
                </tr>
                <tr>
                  <td className="font-bold text-slate-700 py-0.5">Hari / Tanggal</td>
                  <td className="text-center font-bold py-0.5">:</td>
                  <td className="py-0.5">{compDateFormatted}</td>
                </tr>
                <tr>
                  <td className="font-bold text-slate-700 py-0.5">Tempat Pelaksanaan</td>
                  <td className="text-center font-bold py-0.5">:</td>
                  <td className="py-0.5">{locationStr}</td>
                </tr>
              </tbody>
            </table>

            {/* ── TABEL REKAPITULASI HASIL (HANYA NILAI) ── */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  {viewScope === 'winners' && hasRankedWinners
                    ? 'Hasil Penetapan Kejuaraan (Juara 1, 2, 3):'
                    : 'Hasil Rekapitulasi & Peringkat Kejuaraan:'}
                </p>
                {viewScope === 'winners' && hasRankedWinners && (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    Menampilkan Juara 1, 2, 3
                  </span>
                )}
              </div>
              <table className="w-full border-collapse border border-slate-800 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-900">
                    <th className="border border-slate-800 p-2 text-center w-8">No</th>
                    <th className="border border-slate-800 p-2 text-center w-28">Peringkat / Juara</th>
                    <th className="border border-slate-800 p-2 text-left">Nama Peserta / Pendaftar</th>
                    <th className="border border-slate-800 p-2 text-left">Asal Madrasah / Sekolah</th>
                    {showJuryColumns && distinctJuryNames.map((jName, i) => (
                      <th key={i} className="border border-slate-800 p-2 text-center w-16 text-[10px] leading-tight">
                        {jName}
                      </th>
                    ))}
                    <th className="border border-slate-800 p-2 text-center w-20 font-black">Nilai Akhir</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={4 + (showJuryColumns ? distinctJuryNames.length : 0) + 1} className="border border-slate-700 p-4 text-center text-slate-400">
                        Belum ada data nilai peserta.
                      </td>
                    </tr>
                  ) : (
                    displayedParticipants.map((p, idx) => {
                      const finalScore = getParticipantFinalScore(p);
                      const isWinner = p.result?.rank && p.result.rank <= 3;

                      return (
                        <tr
                          key={idx}
                          className={
                            isWinner
                              ? 'bg-amber-50/40 font-medium'
                              : idx % 2 === 1
                              ? 'bg-slate-50/60'
                              : ''
                          }
                        >
                          <td className="border border-slate-700 p-1.5 text-center">{idx + 1}</td>
                          <td className="border border-slate-700 p-1.5 text-center font-bold">
                            {isWinner ? (
                              <span className="text-slate-950">
                                {getRankTitle(p.result?.rank, false)}
                              </span>
                            ) : (
                              getRankTitle(p.result?.rank, false)
                            )}
                          </td>
                          <td className="border border-slate-700 p-1.5 font-semibold text-slate-900">
                            {p.name || p.applicant_name || '-'}
                          </td>
                          <td className="border border-slate-700 p-1.5 text-slate-700">
                            {p.institution || p.school_name || '-'}
                          </td>
                          {showJuryColumns && distinctJuryNames.map((jName, jIdx) => (
                            <td key={jIdx} className="border border-slate-700 p-1.5 text-center font-mono">
                              {getParticipantJuryScore(p, jName)}
                            </td>
                          ))}
                          <td className="border border-slate-700 p-1.5 text-center font-black font-mono text-slate-950 bg-slate-100">
                            {finalScore}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── TANDA TANGAN DEWAN JURI ── */}
            <div className="pt-2 text-xs break-inside-avoid print:break-inside-avoid">
              <div className="flex justify-end mb-3">
                <p className="text-slate-900 font-semibold">
                  Cilacap, {currentDateFormatted}
                </p>
              </div>

              {/* Baris Dewan Juri */}
              <div>
                <p className="font-bold text-center mb-4 uppercase tracking-wider text-slate-900">
                  DEWAN JURI PENILAI:
                </p>
                <div
                  className={`grid ${
                    displayJuries.length === 1
                      ? 'grid-cols-1 max-w-xs mx-auto'
                      : displayJuries.length === 2
                      ? 'grid-cols-2 max-w-lg mx-auto'
                      : displayJuries.length <= 3
                      ? 'grid-cols-3'
                      : 'grid-cols-4'
                  } gap-6 text-center`}
                >
                  {displayJuries.map((j, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <p className="font-bold text-slate-700 text-[11px] mb-14">
                        {j.label}
                      </p>
                      <p className="font-bold border-b-2 border-slate-900 pb-0.5 px-3 min-w-[140px] text-slate-900 text-center inline-block">
                        {j.name ? `( ${j.name} )` : '(\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0)'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CSS PRINT STYLES UNTUK CTRL+P DI HALAMAN UTAMA ── */}
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 0;
            }
            body {
              visibility: hidden !important;
            }
            #printable-berita-acara,
            #printable-berita-acara * {
              visibility: visible !important;
            }
            #printable-berita-acara {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              padding: 14mm 12mm 14mm 12mm !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              color: black !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
