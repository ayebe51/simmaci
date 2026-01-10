import XLSX from 'xlsx';
import fs from 'fs';

console.log('Testing template generation...');

// Data contoh untuk template
const templateData = [
  {
    'NUPTK': '1234567890123456',
    'Nama': 'Ahmad Sudarsono, S.Pd',
    'Status': 'PNS',
    'Satminkal': 'MI Maarif 01 Cilacap',
    'Kecamatan': 'Cilacap Tengah',
    'Mata Pelajaran': 'Matematika',
    'Jabatan': 'Guru Kelas',
    'PDPKPNU': 'Sudah',
    'Nomor Telepon': '081234567890',
    'Email': 'ahmad.sudarsono@example.com',
    'Aktif': 'Ya',
    'Sertifikasi': 'Ya'
  },
  {
    'NUPTK': '9876543210987654',
    'Nama': 'Siti Nurhaliza, S.Pd.I',
    'Status': 'GTY',
    'Satminkal': 'MTs Maarif 02 Majenang',
    'Kecamatan': 'Majenang',
    'Mata Pelajaran': 'Bahasa Arab',
    'Jabatan': 'Guru Mapel',
    'PDPKPNU': 'Belum',
    'Nomor Telepon': '082345678901',
    'Email': 'siti.nurhaliza@example.com',
    'Aktif': 'Ya',
    'Sertifikasi': 'Tidak'
  },
  {
    'NUPTK': 'MAARIF-2024-001',
    'Nama': 'Budi Santoso, S.S',
    'Status': 'Honorer',
    'Satminkal': 'MA Maarif Kroya',
    'Kecamatan': 'Kroya',
    'Mata Pelajaran': 'Bahasa Inggris',
    'Jabatan': 'Guru Mapel',
    'PDPKPNU': 'Belum',
    'Nomor Telepon': '083456789012',
    'Email': 'budi.santoso@example.com',
    'Aktif': 'Ya',
    'Sertifikasi': 'Tidak'
  }
];

// Instruksi penggunaan
const instructionsData = [
  {
    'KOLOM': 'NUPTK',
    'WAJIB': 'Opsional',
    'FORMAT': 'Text (16 digit) atau Nomor Ma\'arif',
    'CONTOH': '1234567890123456',
    'KETERANGAN': 'Nomor Unik Pendidik dan Tenaga Kependidikan'
  },
  {
    'KOLOM': 'Nama',
    'WAJIB': 'WAJIB',
    'FORMAT': 'Text',
    'CONTOH': 'Ahmad Sudarsono, S.Pd',
    'KETERANGAN': 'Nama lengkap guru beserta gelar'
  },
  {
    'KOLOM': 'Status',
    'WAJIB': 'WAJIB',
    'FORMAT': 'PNS / GTY / GTT / Honorer',
    'CONTOH': 'PNS',
    'KETERANGAN': 'Status kepegawaian guru'
  }
];

// Buat workbook
const workbook = XLSX.utils.book_new();

// Sheet 1: Template dengan contoh data
const templateSheet = XLSX.utils.json_to_sheet(templateData);
templateSheet['!cols'] = [
  { wch: 18 }, { wch: 30 }, { wch: 10 }, { wch: 30 }, { wch: 20 },
  { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 30 },
  { wch: 8 }, { wch: 12 }
];
XLSX.utils.book_append_sheet(workbook, templateSheet, 'Template Data Guru');

// Sheet 2: Instruksi
const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
instructionsSheet['!cols'] = [
  { wch: 18 }, { wch: 10 }, { wch: 35 }, { wch: 35 }, { wch: 60 }
];
XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instruksi');

// Sheet 3: Form Kosong
const emptyTemplate = [{
  'NUPTK': '', 'Nama': '', 'Status': '', 'Satminkal': '', 'Kecamatan': '',
  'Mata Pelajaran': '', 'Jabatan': '', 'PDPKPNU': '', 'Nomor Telepon': '',
  'Email': '', 'Aktif': 'Ya', 'Sertifikasi': ''
}];
const emptySheet = XLSX.utils.json_to_sheet(emptyTemplate);
emptySheet['!cols'] = templateSheet['!cols'];
XLSX.utils.book_append_sheet(workbook, emptySheet, 'Form Kosong');

// Save file
const outputPath = 'TEMPLATE_IMPORT_DATA_GURU_FIXED.xlsx';
XLSX.writeFile(workbook, outputPath);

console.log(`✅ Template created: ${outputPath}`);
console.log(`📊 File size: ${fs.statSync(outputPath).size} bytes`);
console.log('\n💡 Try opening this file in Excel to verify it works!');
