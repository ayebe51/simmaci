import { VercelRequest, VercelResponse } from '@vercel/node';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { query } from '../_lib/db';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      jenisSk,      // GTY, GTT, Kamad, Tendik
      nomorSk,
      nama,
      nuptk,
      unitKerja,
      jabatan,
      tanggalPenetapan,
    } = req.body;

    // Validation
    if (!jenisSk || !nama) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate QR Code
    const qrCodeUrl = `https://sim-maarif-fullstack.vercel.app/sk/${nomorSk}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl);

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="SK-${jenisSk}-${nama}.pdf"`);
      res.send(pdfBuffer);
    });

    // Header - Logo & Title
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('LEMBAGA PENDIDIKAN MA\'ARIF NU', { align: 'center' })
       .fontSize(16)
       .text('CABANG CILACAP', { align: 'center' })
       .moveDown(0.5);

    doc.fontSize(14)
       .font('Helvetica')
       .text('Jl. KH. Azhar Manaf No. 15, Cilacap', { align: 'center' })
       .moveDown(2);

    // SK Title
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('SURAT KEPUTUSAN', { align: 'center' })
       .fontSize(12)
       .text(`Nomor: ${nomorSk}`, { align: 'center' })
       .moveDown(1);

    // Tentang
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('TENTANG', { align: 'center' })
       .moveDown(0.5);

    const tentang = jenisSk === 'GTY' ? 'PENGANGKATAN GURU TETAP YAYASAN'
      : jenisSk === 'GTT' ? 'PENGANGKATAN GURU TIDAK TETAP'
      : jenisSk === 'Kamad' ? 'PENGANGKATAN KEPALA MADRASAH'
      : 'PENGANGKATAN TENAGA KEPENDIDIKAN';

    doc.fontSize(11)
       .font('Helvetica')
       .text(tentang, { align: 'center' })
       .moveDown(2);

    // Menimbang
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Menimbang:', { continued: false })
       .font('Helvetica')
       .text('a. Bahwa dalam rangka meningkatkan kualitas pendidikan...', { indent: 20 })
       .text('b. Bahwa berdasarkan pertimbangan tersebut...', { indent: 20 })
       .moveDown(1);

    // Memutuskan
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('MEMUTUSKAN:', { align: 'center' })
       .moveDown(0.5);

    doc.font('Helvetica-Bold')
       .text('Menetapkan:', { continued: false })
       .moveDown(0.5);

    // Data Pegawai
    const data = [
      ['Nama', ':', nama],
      ['NUPTK', ':', nuptk || '-'],
      ['Unit Kerja', ':', unitKerja || '-'],
      ['Jabatan', ':', jabatan || tentang],
    ];

    data.forEach(([label, colon, value]) => {
      doc.font('Helvetica')
         .text(`${label.padEnd(20)} ${colon} ${value}`, { indent: 20 });
    });

    doc.moveDown(1);

    // Ketentuan
    doc.font('Helvetica')
       .text('Dengan ketentuan sebagai berikut:', { indent: 20 })
       .text('1. Melaksanakan tugas sesuai dengan peraturan yang berlaku', { indent: 30 })
       .text('2. Mematuhi tata tertib dan disiplin yang ditetapkan', { indent: 30 })
       .text('3. Surat Keputusan ini berlaku sejak tanggal ditetapkan', { indent: 30 })
       .moveDown(2);

    // Tanggal & TTD
    doc.fontSize(10)
       .text(`Ditetapkan di Cilacap`, { align: 'right' })
       .text(`Pada tanggal ${tanggalPenetapan || new Date().toLocaleDateString('id-ID')}`, { align: 'right' })
       .moveDown(0.5)
       .font('Helvetica-Bold')
       .text('Ketua LP Ma\'arif NU Cilacap', { align: 'right' })
       .moveDown(3)
       .text('(_____________________)', { align: 'right' });

    // QR Code (bottom left)
    const qrImage = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
    doc.image(qrImage, 50, doc.page.height - 150, { width: 80 });
    doc.fontSize(8)
       .font('Helvetica')
       .text('Scan untuk verifikasi', 50, doc.page.height - 60, { width: 80, align: 'center' });

    doc.end();

    // Also save metadata to database (optional)
    try {
      await query(
        `INSERT INTO sk_documents (nomor_sk, jenis_sk, nama, nuptk, unit_kerja, tanggal_penetapan, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (nomor_sk) DO NOTHING`,
        [nomorSk, jenisSk, nama, nuptk, unitKerja, tanggalPenetapan]
      );
    } catch (dbError) {
      console.warn('Failed to save SK metadata to database:', dbError);
      // Continue anyway - PDF generation is more important
    }

  } catch (error) {
    console.error('SK generation error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate SK',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
