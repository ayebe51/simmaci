import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

@Injectable()
export class ExcelService {
  /**
   * Export teachers to Excel buffer
   */
  async exportTeachers(teachers: any[]): Promise<Buffer> {
    // Map to clean data structure
    const data = teachers.map(t => ({
      NUPTK: t.nuptk || '',
      Nama: t.nama || '',
      Status: t.status || '',
      Satminkal: t.satminkal || '',
      Kecamatan: t.kecamatan || '',
      'Mata Pelajaran': t.mapel || '',
      Jabatan: t.jabatan || '',
      PDPKPNU: t.pdpkpnu || '',
      'Nomor Telepon': t.nomorTelepon || '',
      Email: t.email || '',
      Aktif: t.isActive ? 'Ya' : 'Tidak',
      Sertifikasi: t.isCertified ? 'Ya' : 'Tidak',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Guru');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 18 }, // NUPTK
      { wch: 30 }, // Nama
      { wch: 15 }, // Status
      { wch: 25 }, // Satminkal
      { wch: 20 }, // Kecamatan
      { wch: 20 }, // Mapel
      { wch: 20 }, // Jabatan
      { wch: 12 }, // PDPKPNU
      { wch: 15 }, // Phone
      { wch: 25 }, // Email
      { wch: 8 },  // Aktif
      { wch: 12 }, // Sertifikasi
    ];

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Import teachers from Excel file with validation
   */
  async importTeachers(file: Express.Multer.File): Promise<any[]> {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

    // Limit import size to prevent DoS
    const MAX_ROWS = 1000;
    if (rawData.length > MAX_ROWS) {
      throw new BadRequestException(
        `Import melebihi batas. Maksimal ${MAX_ROWS} baris, ditemukan ${rawData.length}`
      );
    }

    // Map and sanitize data
    return rawData.map(row => ({
      nuptk: this.sanitizeString(row.NUPTK || row.nuptk || '-'),
      nama: this.sanitizeHtml(row.Nama || row.nama),
      status: this.sanitizeString(row.Status || row.status || 'Lainnya'),
      satminkal: this.sanitizeHtml(row.Satminkal || row.satminkal || '-'),
      kecamatan: this.sanitizeHtml(row.Kecamatan || row.kecamatan),
      phoneNumber: this.sanitizeString(row['Nomor Telepon'] || row.nomorTelepon || row.phoneNumber),
      pdpkpnu: this.sanitizeString(row.PDPKPNU || row.pdpkpnu || 'Belum'),
      isCertified: row.Sertifikasi === 'Ya' || row.isCertified === true,
    }));
  }

  /**
   * Generate empty template for import
   */
  async generateTeacherTemplate(): Promise<Buffer> {
    const headers = [
      {
        NUPTK: '1234567890123456',
        Nama: 'Contoh Nama Guru',
        Status: 'PNS',
        Satminkal: 'MI Maarif 01',
        Kecamatan: 'Cilacap Tengah',
        'Mata Pelajaran': 'Matematika',
        Jabatan: 'Guru',
        PDPKPNU: 'Sudah',
        'Nomor Telepon': '081234567890',
        Email: 'email@example.com',
        Aktif: 'Ya',
        Sertifikasi: 'Ya',
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(headers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Export schools to Excel
   */
  async exportSchools(schools: any[]): Promise<Buffer> {
    const data = schools.map(s => ({
      NSM: s.nsm || '',
      NPSN: s.npsn || '',
      Nama: s.nama || '',
      Alamat: s.alamat || '',
      Kecamatan: s.kecamatan || '',
      Telepon: s.telepon || '',
      Email: s.email || '',
      'Kepala Madrasah': s.kepalaMadrasah || '',
      Akreditasi: s.akreditasi || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Madrasah');

    worksheet['!cols'] = [
      { wch: 15 }, // NSM
      { wch: 12 }, // NPSN
      { wch: 30 }, // Nama
      { wch: 35 }, // Alamat
      { wch: 20 }, // Kecamatan
      { wch: 15 }, // Telepon
      { wch: 25 }, // Email
      { wch: 25 }, // Kepala
      { wch: 10 }, // Akreditasi
    ];

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Export students to Excel buffer
   */
  async exportStudents(students: any[]): Promise<Buffer> {
    const data = students.map(s => ({
      NISN: s.nisn || '',
      'Nomor Induk Maarif': s.nomorIndukMaarif || '',
      Nama: s.nama || '',
      'Jenis Kelamin': s.jenisKelamin || '',
      'Tempat Lahir': s.tempatLahir || '',
      'Tanggal Lahir': s.tanggalLahir || '',
      Alamat: s.alamat || '',
      Kecamatan: s.kecamatan || '',
      'Nama Sekolah': s.namaSekolah || '',
      Kelas: s.kelas || '',
      'Nomor Telepon': s.nomorTelepon || '',
      'Nama Wali': s.namaWali || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa');

    worksheet['!cols'] = [
      { wch: 15 }, // NISN
      { wch: 20 }, // Nomor Induk Maarif
      { wch: 30 }, // Nama
      { wch: 12 }, // Jenis Kelamin
      { wch: 20 }, // Tempat Lahir
      { wch: 15 }, // Tanggal Lahir
      { wch: 35 }, // Alamat
      { wch: 20 }, // Kecamatan
      { wch: 30 }, // Nama Sekolah
      { wch: 10 }, // Kelas
      { wch: 15 }, // Nomor Telepon
      { wch: 30 }, // Nama Wali
    ];

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Import students from Excel file with validation
   */
  async importStudents(file: Express.Multer.File): Promise<any[]> {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

    // Limit import size to prevent DoS
    const MAX_ROWS = 1000;
    if (rawData.length > MAX_ROWS) {
      throw new BadRequestException(
        `Import melebihi batas. Maksimal ${MAX_ROWS} baris, ditemukan ${rawData.length}`
      );
    }

    // Map and sanitize data
    return rawData.map((row) => ({
      nisn: this.sanitizeString(row.NISN || row.nisn || ''),
      nomorIndukMaarif: this.sanitizeString(row['Nomor Induk Maarif'] || row.nomorIndukMaarif || ''),
      nama: this.sanitizeHtml(row.Nama || row.nama),
      jenisKelamin: this.sanitizeString(row['Jenis Kelamin'] || row.jenisKelamin || 'L'),
      tempatLahir: this.sanitizeHtml(row['Tempat Lahir'] || row.tempatLahir || ''),
      tanggalLahir: this.sanitizeString(row['Tanggal Lahir'] || row.tanggalLahir || ''),
      alamat: this.sanitizeHtml(row.Alamat || row.alamat || ''),
      kecamatan: this.sanitizeHtml(row.Kecamatan || row.kecamatan || ''),
      namaSekolah: this.sanitizeHtml(row['Nama Sekolah'] || row.namaSekolah || ''),
      kelas: this.sanitizeString(row.Kelas || row.kelas || ''),
      nomorTelepon: this.sanitizeString(row['Nomor Telepon'] || row.nomorTelepon || ''),
      namaWali: this.sanitizeHtml(row['Nama Wali'] || row.namaWali || ''),
    }));
  }

  /**
   * Generate empty template for student import
   */
  async generateStudentTemplate(): Promise<Buffer> {
    const headers = [
      {
        NISN: '1234567890',
        'Nomor Induk Maarif': 'NIM-2024-001',
        Nama: 'Contoh Nama Siswa',
        'Jenis Kelamin': 'L',
        'Tempat Lahir': 'Cilacap',
        'Tanggal Lahir': '2010-01-15',
        Alamat: 'Jl. Contoh No. 123',
        Kecamatan: 'Cilacap Tengah',
        'Nama Sekolah': 'MI Maarif 01 Cilacap',
        Kelas: '6',
        'Nomor Telepon': '081234567890',
        'Nama Wali': 'Nama Orang Tua',
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(headers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Sanitize HTML to prevent XSS attacks
   */
  private sanitizeHtml(input: string | any): string {
    if (!input) return '';
    const str = String(input);
    
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitize and trim string input
   */
  private sanitizeString(input: string | any): string {
    if (!input) return '';
    return String(input).trim();
  }
}
