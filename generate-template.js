const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Script untuk generate template Excel Import Data Guru
 * Template ini sesuai dengan format yang diharapkan backend
 */

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
    'CONTOH': '1234567890123456 atau MAARIF-2024-001',
    'KETERANGAN': 'Nomor Unik Pendidik dan Tenaga Kependidikan, atau nomor internal Ma\'arif jika belum punya NUPTK'
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
  },
  {
    'KOLOM': 'Satminkal',
    'WAJIB': 'WAJIB',
    'FORMAT': 'Text',
    'CONTOH': 'MI Maarif 01 Cilacap',
    'KETERANGAN': 'Nama satuan pendidikan tempat mengajar'
  },
  {
    'KOLOM': 'Kecamatan',
    'WAJIB': 'Opsional',
    'FORMAT': 'Text',
    'CONTOH': 'Cilacap Tengah',
    'KETERANGAN': 'Nama kecamatan lokasi sekolah'
  },
  {
    'KOLOM': 'Mata Pelajaran',
    'WAJIB': 'Opsional',
    'FORMAT': 'Text',
    'CONTOH': 'Matematika',
    'KETERANGAN': 'Mata pelajaran yang diampu (untuk guru mapel)'
  },
  {
    'KOLOM': 'Jabatan',
    'WAJIB': 'Opsional',
    'FORMAT': 'Text',
    'CONTOH': 'Guru Kelas / Guru Mapel / Kepala Sekolah',
    'KETERANGAN': 'Jabatan guru di sekolah'
  },
  {
    'KOLOM': 'PDPKPNU',
    'WAJIB': 'Opsional',
    'FORMAT': 'Sudah / Belum',
    'CONTOH': 'Sudah',
    'KETERANGAN': 'Status PD PKPNU (Pengurus Daerah Persatuan Keluarga Pondok Nurul Ulum)'
  },
  {
    'KOLOM': 'Nomor Telepon',
    'WAJIB': 'Opsional',
    'FORMAT': 'Text (081234567890)',
    'CONTOH': '081234567890',
    'KETERANGAN': 'Nomor HP/WA guru (format Indonesia)'
  },
  {
    'KOLOM': 'Email',
    'WAJIB': 'Opsional',
    'FORMAT': 'Email',
    'CONTOH': 'nama@example.com',
    'KETERANGAN': 'Alamat email guru'
  },
  {
    'KOLOM': 'Aktif',
    'WAJIB': 'Opsional',
    'FORMAT': 'Ya / Tidak',
    'CONTOH': 'Ya',
    'KETERANGAN': 'Status aktif mengajar (default: Ya)'
  },
  {
    'KOLOM': 'Sertifikasi',
    'WAJIB': 'Opsional',
    'FORMAT': 'Ya / Tidak',
    'CONTOH': 'Ya',
    'KETERANGAN': 'Status sertifikasi guru (sudah sertifikasi atau belum)'
  }
];

// Buat workbook
const workbook = XLSX.utils.book_new();

// Sheet 1: Template dengan contoh data
const templateSheet = XLSX.utils.json_to_sheet(templateData);

// Set lebar kolom untuk template
templateSheet['!cols'] = [
  { wch: 18 }, // NUPTK
  { wch: 30 }, // Nama
  { wch: 10 }, // Status
  { wch: 30 }, // Satminkal
  { wch: 20 }, // Kecamatan
  { wch: 20 }, // Mata Pelajaran
  { wch: 15 }, // Jabatan
  { wch: 12 }, // PDPKPNU
  { wch: 15 }, // Nomor Telepon
  { wch: 30 }, // Email
  { wch: 8 },  // Aktif
  { wch: 12 }  // Sertifikasi
];

XLSX.utils.book_append_sheet(workbook, templateSheet, 'Template Data Guru');

// Sheet 2: Instruksi
const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);

// Set lebar kolom untuk instruksi
instructionsSheet['!cols'] = [
  { wch: 18 }, // KOLOM
  { wch: 10 }, // WAJIB
  { wch: 35 }, // FORMAT
  { wch: 35 }, // CONTOH
  { wch: 60 }  // KETERANGAN
];

XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instruksi');

// Sheet 3: Template kosong untuk diisi
const emptyTemplate = [
  {
    'NUPTK': '',
    'Nama': '',
    'Status': '',
    'Satminkal': '',
    'Kecamatan': '',
    'Mata Pelajaran': '',
    'Jabatan': '',
    'PDPKPNU': '',
    'Nomor Telepon': '',
    'Email': '',
    'Aktif': 'Ya',
    'Sertifikasi': ''
  }
];

const emptySheet = XLSX.utils.json_to_sheet(emptyTemplate);
emptySheet['!cols'] = templateSheet['!cols']; // Sama dengan template

XLSX.utils.book_append_sheet(workbook, emptySheet, 'Form Kosong');

// Simpan file
const outputPath = path.join(__dirname, 'TEMPLATE_IMPORT_DATA_GURU.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log('✅ Template Excel berhasil dibuat!');
console.log(`📄 Lokasi file: ${outputPath}`);
console.log('\n📋 Template terdiri dari 3 sheet:');
console.log('   1. Template Data Guru - Contoh data yang sudah terisi');
console.log('   2. Instruksi - Penjelasan lengkap setiap kolom');
console.log('   3. Form Kosong - Sheet kosong siap diisi');
console.log('\n💡 Cara menggunakan:');
console.log('   - Buka sheet "Form Kosong"');
console.log('   - Isi data guru sesuai format di sheet "Instruksi"');
console.log('   - Upload file melalui menu Import di aplikasi');
