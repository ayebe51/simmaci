import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  Share2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { downloadQrCodeImage, downloadQrCardImage, sanitizeFilename } from '../utils/qrDownload';
import { formatMeetingDate } from '../utils/dateHelpers';

interface MeetingQrModalProps {
  meeting: {
    id: number;
    title: string;
    description?: string | null;
    started_at?: string | null;
    ended_at?: string | null;
    location?: string | null;
    qr_umum_token?: string | null;
    qr_umum_url?: string | null;
  };
  trigger?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const MeetingQrModal: React.FC<MeetingQrModalProps> = ({
  meeting,
  trigger,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
}) => {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : uncontrolledIsOpen;
  const setIsOpen = (val: boolean) => {
    if (isControlled && controlledOnOpenChange) {
      controlledOnOpenChange(val);
    } else {
      setUncontrolledIsOpen(val);
    }
  };

  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Ambil URL QR Walk-In
  const qrRaw = meeting.qr_umum_url || meeting.qr_umum_token || '';
  const qrUrl = qrRaw.startsWith('http')
    ? qrRaw
    : qrRaw.startsWith('/')
    ? `${window.location.origin}${qrRaw}`
    : qrRaw
    ? `${window.location.origin}/meetings/${meeting.id}/walk-in?token=${qrRaw}`
    : `${window.location.origin}/meetings/${meeting.id}/walk-in`;

  const handleCopyLink = () => {
    if (!qrUrl) return;
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    toast.success('Link presensi walk-in berhasil disalin');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPng = async () => {
    if (!qrUrl) return;
    setIsDownloading(true);
    try {
      const safeTitle = sanitizeFilename(meeting.title);
      await downloadQrCodeImage(qrUrl, `QR_Absensi_${safeTitle}.png`);
    } catch {
      // toast handled in download helper
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadCard = async () => {
    if (!qrUrl) return;
    setIsDownloading(true);
    try {
      const dateStr = meeting.started_at
        ? formatMeetingDate(meeting.started_at, 'EEEE, d MMMM yyyy')
        : undefined;
      const timeStr = meeting.started_at
        ? `Pukul ${formatMeetingDate(meeting.started_at, 'HH:mm')} WIB`
        : undefined;
      await downloadQrCardImage({
        text: qrUrl,
        title: meeting.title,
        dateText: dateStr,
        timeText: timeStr,
        locationText: meeting.location || undefined,
      });
    } catch {
      // toast handled in download helper
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    try {
      const standeeEl = document.getElementById('printable-qr-standee');
      // Pastikan mengambil SVG QR Code yang benar, bukan icon SVG Lucide
      const qrSvgEl =
        standeeEl?.querySelector('#standee-qr-code-svg') ||
        standeeEl?.querySelector('.qr-container-standee svg') ||
        document.getElementById('standee-qr-code-svg');

      if (!qrSvgEl) {
        window.print();
        return;
      }

      // Format metadata rapat
      const dateStr = meeting.started_at
        ? formatMeetingDate(meeting.started_at, 'EEEE, d MMMM yyyy')
        : '';
      const timeStr = meeting.started_at
        ? formatMeetingDate(meeting.started_at, 'HH:mm')
        : '';
      const locationStr = meeting.location || '';

      // Bersihkan SVG agar responsive mengisi container besar
      const qrSvgCleanHtml = qrSvgEl.outerHTML
        .replace(/width="[^"]*"/, 'width="100%"')
        .replace(/height="[^"]*"/, 'height="100%"');

      // Buat iframe terisolasi untuk proses cetak
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-10000px';
      iframe.style.top = '-10000px';
      iframe.style.width = '210mm';
      iframe.style.height = '297mm';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>Standee QR Absensi - ${meeting.title}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #0f172a;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            .standee-container {
              width: 100%;
              max-width: 185mm;
              min-height: 270mm;
              margin: 0 auto;
              padding: 7mm 10mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              text-align: center;
              background: #ffffff;
              border: 3px double #a7f3d0;
              border-radius: 20px;
            }
            .header-section {
              width: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .logo {
              height: 56px;
              width: auto;
              max-width: 90px;
              object-fit: contain;
              margin-bottom: 6px;
            }
            .institution-name {
              font-size: 16px;
              font-weight: 800;
              color: #065f46;
              letter-spacing: 0.06em;
              margin-bottom: 5px;
            }
            .badge {
              display: inline-block;
              padding: 4px 14px;
              border-radius: 9999px;
              background-color: #ecfdf5;
              border: 1.5px solid #a7f3d0;
              color: #047857;
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }
            .header-divider {
              width: 140mm;
              height: 1.5px;
              background: #f1f5f9;
              border-top: 1px solid #e2e8f0;
              margin: 10px auto 12px auto;
            }
            .title {
              font-size: 24px;
              font-weight: 900;
              color: #0f172a;
              margin: 0 0 10px 0;
              line-height: 1.35;
              max-width: 165mm;
            }
            .meta {
              display: flex;
              flex-wrap: wrap;
              justify-content: center;
              align-items: center;
              gap: 8px 14px;
              font-size: 12.5px;
              color: #334155;
              font-weight: 600;
              margin-bottom: 10px;
              max-width: 165mm;
            }
            .meta-pill {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 9999px;
              padding: 4px 12px;
              display: inline-flex;
              align-items: center;
            }
            .qr-wrapper {
              background: #ffffff;
              border: 4.5px solid #059669;
              border-radius: 22px;
              padding: 16px;
              box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 6px auto;
              position: relative;
              width: 105mm;
              height: 105mm;
              box-sizing: border-box;
            }
            .qr-wrapper svg {
              width: 100% !important;
              height: 100% !important;
              max-width: 100% !important;
              max-height: 100% !important;
              display: block;
            }
            .corner {
              position: absolute;
              width: 22px;
              height: 22px;
              border-color: #047857;
              border-style: solid;
              pointer-events: none;
            }
            .corner-tl { top: 6px; left: 6px; border-width: 4px 0 0 4px; border-radius: 6px 0 0 0; }
            .corner-tr { top: 6px; right: 6px; border-width: 4px 4px 0 0; border-radius: 0 6px 0 0; }
            .corner-bl { bottom: 6px; left: 6px; border-width: 0 0 4px 4px; border-radius: 0 0 0 6px; }
            .corner-br { bottom: 6px; right: 6px; border-width: 0 4px 4px 0; border-radius: 0 0 6px 0; }

            .action-callout {
              margin-top: 8px;
            }
            .action-title {
              font-size: 19px;
              font-weight: 800;
              color: #065f46;
              letter-spacing: 0.04em;
            }
            .action-subtitle {
              font-size: 12.5px;
              color: #64748b;
              margin-top: 4px;
            }
            .instructions {
              background-color: #f0fdf4;
              border: 1.5px solid #bbf7d0;
              border-radius: 12px;
              padding: 10px 16px;
              max-width: 165mm;
              width: 100%;
              margin: 10px auto 0 auto;
            }
            .instructions-title {
              font-size: 11px;
              font-weight: 800;
              color: #065f46;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              margin-bottom: 6px;
              text-align: center;
            }
            .steps-grid {
              display: flex;
              align-items: center;
              justify-content: space-around;
              font-size: 11.5px;
              color: #064e3b;
              font-weight: 600;
            }
            .step-col {
              display: flex;
              align-items: center;
              gap: 6px;
              text-align: left;
            }
            .step-num {
              background: #059669;
              color: white;
              width: 19px;
              height: 19px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: 800;
              flex-shrink: 0;
            }
            .step-arrow {
              color: #10b981;
              font-size: 15px;
            }
            .footer {
              width: 100%;
              border-top: 1px solid #e2e8f0;
              padding-top: 8px;
              margin-top: 10px;
              display: flex;
              justify-content: space-between;
              font-size: 10.5px;
              color: #94a3b8;
              font-weight: 600;
              letter-spacing: 0.04em;
            }
          </style>
        </head>
        <body>
          <div class="standee-container">
            <div class="header-section">
              <img src="/logo-maarif-hijau.png" onerror="this.onerror=null; this.src='/logo_maarif.png';" class="logo" alt="LP Ma'arif NU" />
              <div class="institution-name">LP MA'ARIF NU CILACAP</div>
              <div class="badge">PRESENSI DIGITAL RAPAT</div>
              <div class="header-divider"></div>
              <h1 class="title">${meeting.title}</h1>
              <div class="meta">
                ${dateStr ? `<span class="meta-pill">🗓️ ${dateStr}</span>` : ''}
                ${timeStr ? `<span class="meta-pill">⏰ Pukul ${timeStr} WIB</span>` : ''}
                ${locationStr ? `<span class="meta-pill">📍 ${locationStr}</span>` : ''}
              </div>
            </div>

            <div class="qr-wrapper">
              <div class="corner corner-tl"></div>
              <div class="corner corner-tr"></div>
              <div class="corner corner-bl"></div>
              <div class="corner corner-br"></div>
              ${qrSvgCleanHtml}
            </div>

            <div class="action-callout">
              <div class="action-title">SCAN QR CODE UNTUK PRESENSI</div>
              <div class="action-subtitle">Arahkan kamera HP Anda untuk mengisi data presensi kehadiran</div>
            </div>

            <div class="instructions">
              <div class="instructions-title">PANDUAN PRESENSI KEHADIRAN:</div>
              <div class="steps-grid">
                <div class="step-col">
                  <span class="step-num">1</span>
                  <span>Buka Kamera HP / Pemindai QR</span>
                </div>
                <div class="step-arrow">➜</div>
                <div class="step-col">
                  <span class="step-num">2</span>
                  <span>Arahkan ke QR Code & Buka Link</span>
                </div>
                <div class="step-arrow">➜</div>
                <div class="step-col">
                  <span class="step-num">3</span>
                  <span>Isi Data & Konfirmasi Hadir</span>
                </div>
              </div>
            </div>

            <div class="footer">
              <span>LP MA'ARIF NU CILACAP</span>
              <span>SIMMACI • Sistem Presensi Digital Rapat</span>
            </div>
          </div>
        </body>
        </html>
      `);
      doc.close();

      const triggerPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.error('Gagal mencetak dari iframe:', err);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 2000);
        }
      };

      // Tunggu logo termuat sempurna jika ada
      const imgs = iframe.contentWindow?.document.images;
      if (imgs && imgs.length > 0) {
        let loaded = 0;
        const total = imgs.length;
        const onImgDone = () => {
          loaded++;
          if (loaded >= total) setTimeout(triggerPrint, 200);
        };
        for (let i = 0; i < total; i++) {
          if (imgs[i].complete) {
            loaded++;
          } else {
            imgs[i].onload = onImgDone;
            imgs[i].onerror = onImgDone;
          }
        }
        if (loaded >= total) setTimeout(triggerPrint, 200);
      } else {
        setTimeout(triggerPrint, 200);
      }
    } catch (e) {
      console.error('Error saat cetak standee:', e);
      window.print();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 print:p-0 print:border-0 print:shadow-none print:max-w-none print:w-full print:bg-white">
        {/* Style khusus untuk cetak Standee / Poster A4 jika user tekan Ctrl+P */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 12mm;
            }
            html, body {
              overflow: visible !important;
              height: auto !important;
              background: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #root,
            [data-radix-dialog-overlay],
            .no-print,
            button {
              display: none !important;
            }
            [data-radix-portal] {
              display: block !important;
              position: static !important;
            }
            [role="dialog"] {
              display: block !important;
              position: static !important;
              transform: none !important;
              max-width: 100% !important;
              max-height: none !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
            }
            #printable-qr-standee {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: space-between !important;
              width: 100% !important;
              max-width: 185mm !important;
              min-height: 270mm !important;
              margin: 0 auto !important;
              padding: 7mm 10mm !important;
              border: 3px double #a7f3d0 !important;
              border-radius: 20px !important;
              box-shadow: none !important;
              background: white !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            #printable-qr-standee .qr-container-standee svg {
              width: 95mm !important;
              height: 95mm !important;
              max-width: 100% !important;
              max-height: 100% !important;
              display: block !important;
            }
          }
        ` }} />

        {/* Header Modal (Hidden saat print) */}
        <DialogHeader className="no-print pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <QrCode className="h-5 w-5 text-emerald-600" />
              QR Code Absensi Rapat
            </DialogTitle>
          </div>
          <p className="text-xs text-slate-500">
            Unduh gambar QR Code untuk dibagikan, atau cetak standee meja untuk ditempel di lokasi rapat.
          </p>
        </DialogHeader>

        {/* Toolbar Tombol Aksi (Hidden saat print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 py-2 bg-slate-50 rounded-xl px-3 border border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm"
              onClick={handleDownloadPng}
              disabled={isDownloading}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Unduh QR (PNG)
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-medium"
              onClick={handleDownloadCard}
              disabled={isDownloading}
            >
              <Share2 className="h-3.5 w-3.5 mr-1.5" />
              Unduh Kartu Poster (WA)
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs"
              onClick={handlePrint}
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Cetak Standee A4
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-slate-600 hover:text-slate-900"
              onClick={handleCopyLink}
            >
              {copied ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copied ? 'Tersalin' : 'Salin Link'}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-slate-600 hover:text-slate-900"
              onClick={() => window.open(qrUrl, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Buka Link
            </Button>
          </div>
        </div>

        {/* Tampilan Standee / Poster Cetak (Ditampilkan di layar sebagai preview & dicetak pada printer) */}
        <div
          id="printable-qr-standee"
          className="bg-white rounded-2xl border-2 border-emerald-100 p-6 sm:p-8 flex flex-col items-center text-center shadow-sm relative overflow-hidden"
        >
          {/* Header Resmi Tanpa Kop */}
          <div className="w-full mb-3 flex flex-col items-center">
            <img
              src="/logo-maarif-hijau.png"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith('/logo_maarif.png')) {
                  target.src = '/logo_maarif.png';
                }
              }}
              alt="Logo LP Ma'arif NU"
              className="h-14 w-auto object-contain mb-2"
            />
            <h2 className="text-xs uppercase font-extrabold tracking-widest text-emerald-800">
              LP MA'ARIF NU CILACAP
            </h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mt-1.5 mb-2">
              <QrCode className="h-3.5 w-3.5" />
              Presensi Digital Rapat
            </div>

            {/* Judul Rapat */}
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 max-w-xl leading-tight mt-1">
              {meeting.title}
            </h1>

            {/* Tanggal & Lokasi */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs sm:text-sm text-slate-600 mt-2 font-medium">
              {meeting.started_at && (
                <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                  {formatMeetingDate(meeting.started_at, 'EEEE, d MMMM yyyy')}
                </span>
              )}
              {meeting.started_at && (
                <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
                  <Clock className="h-3.5 w-3.5 text-emerald-600" />
                  Pukul {formatMeetingDate(meeting.started_at, 'HH:mm')} WIB
                </span>
              )}
              {meeting.location && (
                <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  {meeting.location}
                </span>
              )}
            </div>
          </div>

          {/* QR Code Frame Besar */}
          <div className="my-2 p-4 bg-white rounded-2xl border-4 border-emerald-600 shadow-md inline-block relative qr-container-standee">
            <QRCodeSVG
              id="standee-qr-code-svg"
              value={qrUrl}
              size={280}
              level="H"
              includeMargin={true}
              className="mx-auto"
            />
          </div>

          {/* Action Heading */}
          <div className="mt-3 mb-1">
            <p className="text-base font-extrabold text-emerald-900 tracking-wide">
              SCAN QR CODE UNTUK PRESENSI
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Arahkan kamera smartphone Anda untuk mengisi data presensi kehadiran
            </p>
          </div>

          {/* Petunjuk Pengisian 3 Langkah */}
          <div className="mt-2 max-w-md w-full bg-emerald-50/80 rounded-xl p-3 border border-emerald-200">
            <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide text-center mb-2">
              Panduan Presensi Kehadiran
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs text-emerald-800 font-semibold">
              <div className="flex flex-col items-center">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold mb-1">1</span>
                <span>Buka Kamera HP</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold mb-1">2</span>
                <span>Pindai QR Code</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold mb-1">3</span>
                <span>Kirim Kehadiran</span>
              </div>
            </div>
          </div>

          {/* Footer Standee */}
          <div className="mt-6 pt-3 border-t border-slate-200 w-full flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>LP Ma'arif NU Cilacap</span>
            <span>SIMMACI • Sistem Presensi Digital Rapat</span>
          </div>
        </div>

        {/* Info Tambahan di Bawah (No-print) */}
        <div className="no-print text-center text-xs text-slate-400 pt-1">
          Tautan link: <code className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] break-all">{qrUrl}</code>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default MeetingQrModal;
