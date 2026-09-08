import QRCode from 'qrcode';
import { toast } from 'sonner';

/**
 * Clean string for safe file naming
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/*?:"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60);
}

/**
 * Triggers a browser download of a data URL or Blob
 */
export function triggerBrowserDownload(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Download pure high-resolution QR code PNG image
 */
export async function downloadQrCodeImage(
  text: string,
  filename: string = 'QR_Absensi.png'
): Promise<void> {
  try {
    const safeName = filename.endsWith('.png') ? filename : `${filename}.png`;
    const dataUrl = await QRCode.toDataURL(text, {
      width: 1024,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    triggerBrowserDownload(dataUrl, safeName);
    toast.success('QR Code berhasil diunduh (PNG)');
  } catch (err) {
    console.error('Failed to generate/download QR code:', err);
    toast.error('Gagal mengunduh QR Code');
    throw err;
  }
}

/**
 * Download stylish framed QR Code Card PNG with meeting title & instructions
 * Perfect for sharing directly to WhatsApp groups or social media
 */
export async function downloadQrCardImage({
  text,
  title,
  subtitle = "Sistem Absensi Digital LP Ma'arif NU Cilacap",
  dateText,
  locationText,
  filename,
}: {
  text: string;
  title: string;
  subtitle?: string;
  dateText?: string;
  locationText?: string;
  filename?: string;
}): Promise<void> {
  try {
    const rawQrDataUrl = await QRCode.toDataURL(text, {
      width: 800,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#047857', // Emerald-700
        light: '#ffffff',
      },
    });

    // Create an offscreen canvas
    const canvas = document.createElement('canvas');
    const width = 1080;
    const height = 1350; // 4:5 Instagram/WA friendly portrait ratio
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      // Fallback to pure QR if canvas context is not available
      return downloadQrCodeImage(text, filename);
    }

    // 1. Background gradient (Soft emerald to white)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#ecfdf5'); // emerald-50
    bgGradient.addColorStop(0.3, '#f0fdf4');
    bgGradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Outer decorative border
    ctx.strokeStyle = '#a7f3d0'; // emerald-200
    ctx.lineWidth = 12;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    // Inner subtle card
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 15;
    const cardMarginX = 70;
    const cardTop = 70;
    const cardWidth = width - cardMarginX * 2;
    const cardHeight = height - 140;
    ctx.beginPath();
    ctx.roundRect(cardMarginX, cardTop, cardWidth, cardHeight, 28);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 2. Header: Badge / Subtitle
    ctx.textAlign = 'center';
    ctx.fillStyle = '#065f46'; // emerald-800
    ctx.font = 'bold 30px "Plus Jakarta Sans", "Inter", sans-serif';
    ctx.fillText("LP MA'ARIF NU CILACAP", width / 2, 140);

    ctx.fillStyle = '#059669'; // emerald-600
    ctx.font = '600 20px "Plus Jakarta Sans", "Inter", sans-serif';
    ctx.fillText(subtitle.toUpperCase(), width / 2, 175);

    // Horizontal divider
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(140, 205);
    ctx.lineTo(width - 140, 205);
    ctx.stroke();

    // 3. Meeting Title (Wrapped up to 2 lines)
    ctx.fillStyle = '#1e293b'; // slate-800
    ctx.font = 'bold 38px "Plus Jakarta Sans", "Inter", sans-serif';
    const words = title.split(' ');
    let line1 = '';
    let line2 = '';
    for (const word of words) {
      if ((line1 + ' ' + word).length < 32 && !line2) {
        line1 += (line1 ? ' ' : '') + word;
      } else {
        line2 += (line2 ? ' ' : '') + word;
      }
    }

    let currentY = 265;
    ctx.fillText(line1, width / 2, currentY);
    if (line2) {
      currentY += 48;
      ctx.fillText(line2.slice(0, 36) + (line2.length > 36 ? '...' : ''), width / 2, currentY);
    }

    // 4. Meta Info (Date & Location if present)
    if (dateText || locationText) {
      currentY += 40;
      ctx.fillStyle = '#475569';
      ctx.font = '500 22px "Plus Jakarta Sans", "Inter", sans-serif';
      const metaText = [dateText, locationText].filter(Boolean).join('  ·  ');
      ctx.fillText(metaText, width / 2, currentY);
    }

    // 5. Draw QR Code in Center Box
    const qrImg = new Image();
    await new Promise((resolve, reject) => {
      qrImg.onload = resolve;
      qrImg.onerror = reject;
      qrImg.src = rawQrDataUrl;
    });

    const qrSize = 540;
    const qrX = (width - qrSize) / 2;
    const qrY = currentY + 35;

    // QR container box
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 20);
    ctx.fill();
    ctx.stroke();

    // Draw QR image
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // 6. Bottom Instructions
    const footerY = qrY + qrSize + 60;
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 26px "Plus Jakarta Sans", "Inter", sans-serif';
    ctx.fillText('SCAN QR CODE UNTUK PRESENSI', width / 2, footerY);

    ctx.fillStyle = '#64748b';
    ctx.font = '400 20px "Plus Jakarta Sans", "Inter", sans-serif';
    ctx.fillText('Arahkan kamera HP Anda untuk mengisi data kehadiran', width / 2, footerY + 34);

    // Convert to DataURL and trigger download
    const finalDataUrl = canvas.toDataURL('image/png');
    const safeTitle = sanitizeFilename(title || 'Rapat');
    const finalFilename = filename || `QR_Absensi_${safeTitle}.png`;

    triggerBrowserDownload(finalDataUrl, finalFilename);
    toast.success('Kartu QR Absensi berhasil diunduh (PNG)');
  } catch (err) {
    console.error('Failed to generate QR card:', err);
    // Fallback to simple QR
    return downloadQrCodeImage(text, filename);
  }
}
