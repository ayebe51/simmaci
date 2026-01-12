import { VercelRequest, VercelResponse } from '@vercel/node';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import * as fs from 'fs';
import * as path from 'path';
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
      tempatPenetapan = 'Cilacap',
    } = req.body;

    // Validation
    if (!jenisSk || !nama || !nomorSk) {
      return res.status(400).json({ error: 'Missing required fields: jenisSk, nama, nomorSk' });
    }

    // Load appropriate template based on SK type
    const templateName = `sk-${jenisSk.toLowerCase()}-template.docx`;
    const templatePath = path.join(process.cwd(), 'public', 'templates', templateName);
    
    // Fallback to generic template if specific not found
    const fallbackPath = path.join(process.cwd(), 'public', 'templates', 'sk-template.docx');
    
    let content: Buffer;
    try {
      content = fs.readFileSync(templatePath);
    } catch (err) {
      console.log(`Template ${templateName} not found, using fallback`);
      content = fs.readFileSync(fallbackPath);
    }

    // Load template
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Prepare data for template placeholders
    const templateData = {
      NOMOR_SK: nomorSk,
      JENIS_SK: jenisSk,
      NAMA: nama,
      NUPTK: nuptk || '-',
      UNIT_KERJA: unitKerja || '-',
      JABATAN: jabatan || getDefaultJabatan(jenisSk),
      TANGGAL_PENETAPAN: tanggalPenetapan || getCurrentDate(),
      TEMPAT_PENETAPAN: tempatPenetapan,
      TAHUN: new Date().getFullYear().toString(),
      BULAN: getCurrentMonth(),
      TANGGAL: new Date().getDate().toString(),
    };

    // Fill template with data
    doc.setData(templateData);
    doc.render();

    // Generate DOCX buffer
    const docxBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    // Save SK metadata to database
    try {
      await query(
        `INSERT INTO sk_documents (nomor_sk, jenis_sk, nama, nuptk, unit_kerja, jabatan, tanggal_penetapan, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (nomor_sk) DO UPDATE SET
           updated_at = NOW(),
           nama = EXCLUDED.nama,
           unit_kerja = EXCLUDED.unit_kerja`,
        [nomorSk, jenisSk, nama, nuptk, unitKerja, jabatan, tanggalPenetapan]
      );
    } catch (dbError) {
      console.warn('Failed to save SK metadata:', dbError);
      // Continue anyway - document generation is more important
    }

    // Return DOCX file
    // Note: PDF conversion attempted but may timeout in serverless
    // User can convert DOCX to PDF locally
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="SK-${jenisSk}-${nama.replace(/\s+/g, '_')}.docx"`);
    return res.send(docxBuffer);

  } catch (error) {
    console.error('SK generation error:', error);
    
    // Detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    return res.status(500).json({ 
      error: 'Failed to generate SK',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    });
  }
}

// Helper functions
function getDefaultJabatan(jenisSk: string): string {
  switch (jenisSk) {
    case 'GTY': return 'Guru Tetap Yayasan';
    case 'GTT': return 'Guru Tidak Tetap';
    case 'Kamad': return 'Kepala Madrasah';
    case 'Tendik': return 'Tenaga Kependidikan';
    default: return 'Pegawai';
  }
}

function getCurrentDate(): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const now = new Date();
  return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

function getCurrentMonth(): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return months[new Date().getMonth()];
}
