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
import { settingApi } from '@/lib/api';
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
  const [kopUrl, setKopUrl] = useState<string>('');
  const [kopCandidates, setKopCandidates] = useState<string[]>([]);
  const [kopCandidateIndex, setKopCandidateIndex] = useState<number>(0);

  // Ambil URL QR Walk-In
  const qrRaw = meeting.qr_umum_url || meeting.qr_umum_token || '';
  const qrUrl = qrRaw.startsWith('http')
    ? qrRaw
    : qrRaw.startsWith('/')
    ? `${window.location.origin}${qrRaw}`
    : qrRaw
    ? `${window.location.origin}/meetings/${meeting.id}/walk-in?token=${qrRaw}`
    : `${window.location.origin}/meetings/${meeting.id}/walk-in`;

  // Fetch KOP resmi template dari setting
  useEffect(() => {
    const fetchKop = async () => {
      try {
        let val: string | null = null;
        try {
          const res = await settingApi.get('kop_surat_meeting');
          val = res?.data?.value ?? res?.value ?? null;
        } catch {
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
              `${apiUrl.replace(/\/api$/, '')}/storage/${cleanPath}`,
              `/storage/${cleanPath}`,
            ];
            setKopCandidates(candidateUrls);
            setKopUrl(candidateUrls[0]);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat template kop surat resmi:', err);
      }
    };

    if (isOpen) {
      fetchKop();
    }
  }, [isOpen]);

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
      await downloadQrCardImage({
        text: qrUrl,
        title: meeting.title,
        dateText: dateStr,
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
      const qrSvgEl = standeeEl?.querySelector('svg');

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

      // Header Kop: image jika ada, atau fallback teks resmi
      const kopHtml = kopUrl
        ? `<div style="width: 100%; max-width: 650px; display: flex; justify-content: center; border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px;">
            <img src="${kopUrl}" alt="Kop Surat Resmi LP Ma'arif NU Cilacap" style="max-height: 100px; max-width: 100%; object-fit: contain;" />
           </div>`
        : `<div style="width: 100%; border-bottom: 4px double #065f46; padding-bottom: 12px; margin-bottom: 16px; text-align: center;">
            <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #047857; margin: 0 0 4px 0;">
              PENGURUS CABANG NAHDLATUL ULAMA KABUPATEN CILACAP
            </p>
            <h2 style="font-size: 22px; font-weight: 900; color: #064e3b; margin: 0 0 4px 0; letter-spacing: -0.02em;">
              LEMBAGA PENDIDIKAN MA'ARIF NU CILACAP
            </h2>
            <p style="font-size: 11px; color: #475569; margin: 0;">
              Jl. Masjid No. 09 Kel. Sidanegara, Kec. Cilacap Tengah, Kab. Cilacap, Jawa Tengah 53223
            </p>
           </div>`;

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
              margin: 10mm 15mm;
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
              max-width: 190mm;
              min-height: 265mm;
              margin: 0 auto;
              padding: 6mm 8mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              text-align: center;
              background: #ffffff;
            }
            .badge {
              display: inline-block;
              padding: 5px 16px;
              border-radius: 9999px;
              background-color: #d1fae5;
              color: #065f46;
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              margin-bottom: 8px;
            }
            .title {
              font-size: 24px;
              font-weight: 900;
              color: #0f172a;
              margin: 4px 0 10px 0;
              line-height: 1.3;
              max-width: 650px;
            }
            .meta {
              display: flex;
              flex-wrap: wrap;
              justify-content: center;
              gap: 16px;
              font-size: 13px;
              color: #475569;
              font-weight: 600;
              margin-bottom: 12px;
            }
            .qr-wrapper {
              background: white;
              border: 4px solid #059669;
              border-radius: 20px;
              padding: 16px;
              box-shadow: 0 4px 10px rgba(0,0,0,0.06);
              display: inline-block;
              margin: 8px 0;
            }
            .instructions {
              background-color: #f0fdf4;
              border: 1.5px solid #a7f3d0;
              border-radius: 14px;
              padding: 14px 24px;
              max-width: 480px;
              margin: 12px auto 0 auto;
              text-align: left;
            }
            .instructions-title {
              font-size: 11px;
              font-weight: 800;
              color: #064e3b;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              margin: 0 0 6px 0;
            }
            .instructions ol {
              font-size: 12px;
              color: #065f46;
              margin: 0;
              padding-left: 18px;
              line-height: 1.6;
            }
            .footer {
              width: 100%;
              border-top: 1px solid #e2e8f0;
              padding-top: 12px;
              margin-top: 16px;
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              color: #94a3b8;
            }
          </style>
        </head>
        <body>
          <div class="standee-container">
            <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
              ${kopHtml}
              <div class="badge">PRESENSI DIGITAL RAPAT</div>
              <h1 class="title">${meeting.title}</h1>
              <div class="meta">
                ${dateStr ? `<span>📅 ${dateStr}</span>` : ''}
                ${timeStr ? `<span>⏰ Pukul ${timeStr} WIB</span>` : ''}
                ${locationStr ? `<span>📍 ${locationStr}</span>` : ''}
              </div>
            </div>

            <div class="qr-wrapper">
              ${qrSvgEl.outerHTML}
            </div>

            <div class="instructions">
              <p class="instructions-title">Petunjuk Presensi Kehadiran:</p>
              <ol>
                <li>Buka kamera smartphone atau aplikasi pemindai QR Code</li>
                <li>Arahkan kamera ke QR Code di atas</li>
                <li>Klik tautan yang muncul untuk membuka formulir kehadiran</li>
                <li>Isi nama, instansi, jabatan, lalu klik <strong>Kirim Kehadiran</strong></li>
              </ol>
            </div>

            <div class="footer">
              <span>LP Ma'arif NU Cilacap</span>
              <span>Sistem Informasi Manajemen Madrasah & Rapat Digital (SIMMACI)</span>
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

      // Tunggu gambar (kop surat) termuat sempurna jika ada
      const imgs = iframe.contentWindow?.document.images;
      if (imgs && imgs.length > 0) {
        let loaded = 0;
        const total = imgs.length;
        const onImgDone = () => {
          loaded++;
          if (loaded >= total) setTimeout(triggerPrint, 250);
        };
        for (let i = 0; i < total; i++) {
          if (imgs[i].complete) {
            loaded++;
          } else {
            imgs[i].onload = onImgDone;
            imgs[i].onerror = onImgDone;
          }
        }
        if (loaded >= total) setTimeout(triggerPrint, 250);
      } else {
        setTimeout(triggerPrint, 250);
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
              max-width: 190mm !important;
              min-height: 265mm !important;
              margin: 0 auto !important;
              padding: 6mm 4mm !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
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
          className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 flex flex-col items-center text-center shadow-sm relative overflow-hidden"
        >
          {/* Header Kop Surat Template Resmi */}
          <div className="w-full mb-6 flex flex-col items-center">
            {kopUrl ? (
              <div className="w-full max-w-2xl flex justify-center border-b-2 border-slate-800 pb-3 mb-4">
                <img
                  src={kopUrl}
                  alt="Kop Surat Resmi LP Ma'arif NU Cilacap"
                  className="max-h-24 sm:max-h-28 object-contain"
                  onError={() => {
                    if (kopCandidateIndex + 1 < kopCandidates.length) {
                      const nextIndex = kopCandidateIndex + 1;
                      setKopCandidateIndex(nextIndex);
                      setKopUrl(kopCandidates[nextIndex]);
                    } else {
                      setKopUrl('');
                    }
                  }}
                />
              </div>
            ) : (
              <div className="w-full border-b-4 border-double border-emerald-800 pb-4 mb-5">
                <p className="text-xs uppercase font-bold tracking-widest text-emerald-700">
                  PENGURUS CABANG NAHDLATUL ULAMA KABUPATEN CILACAP
                </p>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-emerald-900 mt-0.5">
                  LEMBAGA PENDIDIKAN MA'ARIF NU CILACAP
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Jl. Masjid No. 09 Kel. Sidanegara, Kec. Cilacap Tengah, Kab. Cilacap, Jawa Tengah 53223
                </p>
              </div>
            )}

            {/* Badge Absensi */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
              <QrCode className="h-3.5 w-3.5" />
              Presensi Digital Rapat
            </div>

            {/* Judul Rapat */}
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 max-w-xl leading-tight">
              {meeting.title}
            </h1>

            {/* Tanggal & Lokasi */}
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm text-slate-600 mt-2 font-medium">
              {meeting.started_at && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                  {formatMeetingDate(meeting.started_at, 'EEEE, d MMMM yyyy')}
                </span>
              )}
              {meeting.started_at && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-emerald-600" />
                  Pukul {formatMeetingDate(meeting.started_at, 'HH:mm')} WIB
                </span>
              )}
              {meeting.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  {meeting.location}
                </span>
              )}
            </div>
          </div>

          {/* QR Code Frame Besar */}
          <div className="my-2 p-4 bg-white rounded-2xl border-4 border-emerald-600 shadow-md inline-block">
            <QRCodeSVG
              value={qrUrl}
              size={240}
              level="H"
              includeMargin={true}
              className="mx-auto"
            />
          </div>

          {/* Petunjuk Pengisian */}
          <div className="mt-5 max-w-md bg-emerald-50/80 rounded-xl p-3 border border-emerald-200">
            <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
              Petunjuk Presensi Kehadiran:
            </p>
            <ol className="text-left text-xs text-emerald-800 list-decimal list-inside space-y-1 mt-1.5 leading-relaxed">
              <li>Buka kamera smartphone atau aplikasi pemindai QR Code</li>
              <li>Arahkan kamera ke QR Code di atas</li>
              <li>Klik tautan yang muncul untuk membuka formulir kehadiran</li>
              <li>Isi nama, instansi, jabatan, lalu klik <strong>Kirim Kehadiran</strong></li>
            </ol>
          </div>

          {/* Footer Standee */}
          <div className="mt-6 pt-4 border-t border-slate-200 w-full flex items-center justify-between text-[11px] text-slate-400">
            <span>LP Ma'arif NU Cilacap</span>
            <span>Sistem Informasi Manajemen Madrasah & Rapat Digital (SIMMACI)</span>
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
