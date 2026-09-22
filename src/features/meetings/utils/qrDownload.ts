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
      errorCorrectionLevel: 'M',
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
export interface QrCardOptions {
  text: string;
  title: string;
  subtitle?: string;
  dateText?: string;
  timeText?: string;
  locationText?: string;
  filename?: string;
}

/**
 * Safely draw a rounded rectangle on canvas with fallback
 */
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

/**
 * Word-wrap text to multiple lines based on maximum width
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Safely load an image from URL with a timeout
 */
function loadImageWithTimeout(
  src: string,
  timeoutMs: number = 2000
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(img);
      }
    };

    img.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    };

    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = src;
  });
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
  timeText,
  locationText,
  filename,
}: QrCardOptions): Promise<void> {
  try {
    // Generate ultra high resolution QR code data with Level M (optimasi HP entry-level)
    const rawQrDataUrl = await QRCode.toDataURL(text, {
      width: 1024,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a', // Slate-900 (High contrast untuk kamera HP murah)
        light: '#ffffff',
      },
    });

    // Create offscreen canvas (Standard 4:5 mobile poster format)
    const canvas = document.createElement('canvas');
    const width = 1080;
    const height = 1350;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      // Fallback to pure QR if canvas context is not available
      return downloadQrCodeImage(text, filename);
    }

    // Pre-load QR Code Image
    const qrImg = await loadImageWithTimeout(rawQrDataUrl, 3000);
    if (!qrImg) {
      return downloadQrCodeImage(text, filename);
    }

    // Attempt to load official LP Ma'arif logo
    const logoImg =
      (await loadImageWithTimeout('/logo-maarif-hijau.png', 2000)) ||
      (await loadImageWithTimeout('/logo_maarif.png', 1500)) ||
      (await loadImageWithTimeout('/logo-icon-192.png', 1000));

    // 1. Background gradient (Soft emerald gradient)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#ecfdf5'); // emerald-50
    bgGradient.addColorStop(0.3, '#f8fafc'); // slate-50
    bgGradient.addColorStop(0.8, '#f0fdf4');
    bgGradient.addColorStop(1, '#ecfdf5');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Outer decorative border with matched rounded corners
    ctx.strokeStyle = '#a7f3d0'; // emerald-200
    ctx.lineWidth = 4;
    drawRoundRect(ctx, 20, 20, width - 40, height - 40, 32);
    ctx.stroke();

    // 2. Main White Card Container
    const cardMargin = 42;
    const cardX = cardMargin;
    const cardY = cardMargin;
    const cardWidth = width - cardMargin * 2;
    const cardHeight = height - cardMargin * 2;
    const cardRadius = 26;
    const cardBottom = cardY + cardHeight;

    // Card shadow
    ctx.save();
    ctx.shadowColor = 'rgba(6, 78, 59, 0.08)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#ffffff';
    drawRoundRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
    ctx.fill();
    ctx.restore();

    // Card border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    drawRoundRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
    ctx.stroke();

    // Top decorative accent bar on card
    ctx.save();
    drawRoundRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
    ctx.clip();
    const topBarGradient = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY);
    topBarGradient.addColorStop(0, '#047857');
    topBarGradient.addColorStop(0.5, '#10b981');
    topBarGradient.addColorStop(1, '#047857');
    ctx.fillStyle = topBarGradient;
    ctx.fillRect(cardX, cardY, cardWidth, 8);
    ctx.restore();

    // 3. Header Section
    let currentY = cardY + 34;
    ctx.textAlign = 'center';

    // Official Logo with Natural Aspect Ratio
    if (logoImg) {
      const naturalW = logoImg.naturalWidth || logoImg.width || 100;
      const naturalH = logoImg.naturalHeight || logoImg.height || 100;
      const imgAspect = naturalW / naturalH;
      const targetH = 68;
      const targetW = Math.round(targetH * imgAspect);
      ctx.drawImage(logoImg, (width - targetW) / 2, currentY, targetW, targetH);
      currentY += targetH + 14;
    } else {
      currentY += 10;
    }

    // Institution Name
    ctx.fillStyle = '#065f46'; // emerald-800
    ctx.font = 'bold 24px "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText("LP MA'ARIF NU CILACAP", width / 2, currentY);
    currentY += 28;

    // Subtitle Pill Badge
    const badgeText = subtitle.toUpperCase();
    ctx.font = 'bold 13px "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const badgeWidth = Math.min(cardWidth - 80, ctx.measureText(badgeText).width + 32);
    const badgeHeight = 28;
    const badgeX = (width - badgeWidth) / 2;
    const badgeY = currentY - 18;

    ctx.fillStyle = '#ecfdf5';
    ctx.strokeStyle = '#a7f3d0';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#047857'; // emerald-700
    ctx.fillText(badgeText, width / 2, currentY + 1);
    currentY += 26;

    // Subtle horizontal divider with center diamond
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardX + 60, currentY);
    ctx.lineTo(cardX + cardWidth - 60, currentY);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(width / 2, currentY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    currentY += 32;

    // 4. Meeting Title (Word-wrapped, no truncation)
    const maxTitleWidth = cardWidth - 120; // ~876px
    let titleFontSize = 34;
    ctx.font = `bold ${titleFontSize}px "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    let titleLines = wrapText(ctx, title || 'Agenda Rapat', maxTitleWidth);

    // Dynamic auto-scaling font size for long titles
    if (titleLines.length > 2) {
      titleFontSize = 30;
      ctx.font = `bold ${titleFontSize}px "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      titleLines = wrapText(ctx, title || 'Agenda Rapat', maxTitleWidth);
    }
    if (titleLines.length > 3) {
      titleFontSize = 26;
      ctx.font = `bold ${titleFontSize}px "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      titleLines = wrapText(ctx, title || 'Agenda Rapat', maxTitleWidth);
    }

    const titleLineHeight = Math.round(titleFontSize * 1.3);
    ctx.fillStyle = '#0f172a'; // slate-900
    for (const line of titleLines) {
      ctx.fillText(line, width / 2, currentY);
      currentY += titleLineHeight;
    }
    currentY += 6;

    // 5. Meta Info (Date, Time, Location) - Clean badges with NO overflow
    const dateTimeStr = [dateText, timeText].filter(Boolean).join('  •  ');
    if (dateTimeStr) {
      ctx.font = '600 17px "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const dtWidth = Math.min(cardWidth - 80, ctx.measureText(dateTimeStr).width + 36);
      const dtHeight = 32;
      const dtX = (width - dtWidth) / 2;
      const dtY = currentY;

      ctx.fillStyle = '#f8fafc'; // slate-50
      ctx.strokeStyle = '#e2e8f0'; // slate-200
      ctx.lineWidth = 1;
      drawRoundRect(ctx, dtX, dtY, dtWidth, dtHeight, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#334155'; // slate-700
      ctx.fillText(dateTimeStr, width / 2, dtY + 21);
      currentY += dtHeight + 10;
    }

    if (locationText) {
      ctx.font = '500 16px "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const maxLocWidth = cardWidth - 140;
      const locLines = wrapText(ctx, `📍 ${locationText}`, maxLocWidth);
      ctx.fillStyle = '#475569'; // slate-600
      for (const locLine of locLines.slice(0, 2)) {
        ctx.fillText(locLine, width / 2, currentY + 16);
        currentY += 22;
      }
      currentY += 6;
    }

    // 6. Calculate Bottom Section Positions
    const footerTextY = cardBottom - 26;
    const footerDividerY = footerTextY - 20;
    const stepBoxHeight = 54;
    const stepBoxY = footerDividerY - 16 - stepBoxHeight;
    const manualUrlY = stepBoxY - 12;
    const instrSubtitleY = manualUrlY - 18;
    const instrTitleY = instrSubtitleY - 24;
    const bottomAreaTop = instrTitleY - 26;

    // 7. Middle QR Code Section (Vertically Centered between Meta and Bottom Section)
    const availableQrHeight = bottomAreaTop - currentY;
    const targetQrFrameSize = Math.min(520, Math.max(380, availableQrHeight - 20));
    const qrFramePadding = 20;
    const qrDisplaySize = targetQrFrameSize - qrFramePadding * 2;
    const qrFrameY = currentY + (availableQrHeight - targetQrFrameSize) / 2;
    const qrFrameX = (width - targetQrFrameSize) / 2;
    const qrX = qrFrameX + qrFramePadding;
    const qrY = qrFrameY + qrFramePadding;

    // Draw QR Frame
    ctx.save();
    ctx.shadowColor = 'rgba(5, 150, 105, 0.12)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#ffffff';
    drawRoundRect(ctx, qrFrameX, qrFrameY, targetQrFrameSize, targetQrFrameSize, 22);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#059669'; // emerald-600
    ctx.lineWidth = 3.5;
    drawRoundRect(ctx, qrFrameX, qrFrameY, targetQrFrameSize, targetQrFrameSize, 22);
    ctx.stroke();

    // Corner scanner accent brackets on QR frame
    const bracketLen = 22;
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Top-left bracket
    ctx.beginPath();
    ctx.moveTo(qrFrameX + 8, qrFrameY + 8 + bracketLen);
    ctx.lineTo(qrFrameX + 8, qrFrameY + 8);
    ctx.lineTo(qrFrameX + 8 + bracketLen, qrFrameY + 8);
    ctx.stroke();

    // Top-right bracket
    ctx.beginPath();
    ctx.moveTo(qrFrameX + targetQrFrameSize - 8 - bracketLen, qrFrameY + 8);
    ctx.lineTo(qrFrameX + targetQrFrameSize - 8, qrFrameY + 8);
    ctx.lineTo(qrFrameX + targetQrFrameSize - 8, qrFrameY + 8 + bracketLen);
    ctx.stroke();

    // Bottom-left bracket
    ctx.beginPath();
    ctx.moveTo(qrFrameX + 8, qrFrameY + targetQrFrameSize - 8 - bracketLen);
    ctx.lineTo(qrFrameX + 8, qrFrameY + targetQrFrameSize - 8);
    ctx.lineTo(qrFrameX + 8 + bracketLen, qrFrameY + targetQrFrameSize - 8);
    ctx.stroke();

    // Bottom-right bracket
    ctx.beginPath();
    ctx.moveTo(qrFrameX + targetQrFrameSize - 8 - bracketLen, qrFrameY + targetQrFrameSize - 8);
    ctx.lineTo(qrFrameX + targetQrFrameSize - 8, qrFrameY + targetQrFrameSize - 8);
    ctx.lineTo(qrFrameX + targetQrFrameSize - 8, qrFrameY + targetQrFrameSize - 8 - bracketLen);
    ctx.stroke();

    // Draw QR code image inside frame
    ctx.drawImage(qrImg, qrX, qrY, qrDisplaySize, qrDisplaySize);

    // 8. Render Bottom Section Elements
    // Instruction Heading
    ctx.fillStyle = '#065f46'; // emerald-800
    ctx.font = 'bold 23px "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('SCAN QR CODE UNTUK PRESENSI', width / 2, instrTitleY);

    // Instruction Subtitle
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.font = '400 16px "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Arahkan kamera HP Anda untuk mengisi data presensi kehadiran', width / 2, instrSubtitleY);

    // Teks tautan manual bagi peserta yang kameranya bermasalah
    ctx.fillStyle = '#047857'; // emerald-700
    ctx.font = '600 14px "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Atau ketik di browser: ${text}`, width / 2, manualUrlY);

    // 3-Step Quick Guide Box (Fills bottom void beautifully)
    const stepBoxWidth = cardWidth - 100; // ~896px
    const stepBoxX = (width - stepBoxWidth) / 2;

    ctx.fillStyle = '#f0fdf4'; // emerald-50
    ctx.strokeStyle = '#bbf7d0'; // emerald-200
    ctx.lineWidth = 1;
    drawRoundRect(ctx, stepBoxX, stepBoxY, stepBoxWidth, stepBoxHeight, 14);
    ctx.fill();
    ctx.stroke();

    // 3 Steps inside box
    const stepY = stepBoxY + 31;
    const col1X = width / 2 - 275;
    const col2X = width / 2;
    const col3X = width / 2 + 275;

    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 14px "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('1. Buka Kamera HP', col1X, stepY);
    ctx.fillText('2. Pindai QR Code', col2X, stepY);
    ctx.fillText('3. Kirim Kehadiran', col3X, stepY);

    // Arrows between steps
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 16px "Plus Jakarta Sans", "Inter", sans-serif';
    ctx.fillText('➜', (col1X + col2X) / 2, stepY);
    ctx.fillText('➜', (col2X + col3X) / 2, stepY);

    // Footer divider
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 80, footerDividerY);
    ctx.lineTo(cardX + cardWidth - 80, footerDividerY);
    ctx.stroke();

    // Footer Branding Text
    ctx.fillStyle = '#94a3b8'; // slate-400
    ctx.font = '500 13px "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('SIMMACI • Sistem Informasi Presensi LP Ma\'arif NU Kabupaten Cilacap', width / 2, footerTextY);

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

