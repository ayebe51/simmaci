var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
let ExcelService = class ExcelService {
    async exportTeachers(teachers) {
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
        worksheet['!cols'] = [
            { wch: 18 },
            { wch: 30 },
            { wch: 15 },
            { wch: 25 },
            { wch: 20 },
            { wch: 20 },
            { wch: 20 },
            { wch: 12 },
            { wch: 15 },
            { wch: 25 },
            { wch: 8 },
            { wch: 12 },
        ];
        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }
    async importTeachers(file) {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet);
        const MAX_ROWS = 1000;
        if (rawData.length > MAX_ROWS) {
            throw new BadRequestException(`Import melebihi batas. Maksimal ${MAX_ROWS} baris, ditemukan ${rawData.length}`);
        }
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
    async generateTeacherTemplate() {
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
    async exportSchools(schools) {
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
            { wch: 15 },
            { wch: 12 },
            { wch: 30 },
            { wch: 35 },
            { wch: 20 },
            { wch: 15 },
            { wch: 25 },
            { wch: 25 },
            { wch: 10 },
        ];
        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }
    async exportStudents(students) {
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
            { wch: 15 },
            { wch: 20 },
            { wch: 30 },
            { wch: 12 },
            { wch: 20 },
            { wch: 15 },
            { wch: 35 },
            { wch: 20 },
            { wch: 30 },
            { wch: 10 },
            { wch: 15 },
            { wch: 30 },
        ];
        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }
    async importStudents(file) {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet);
        const MAX_ROWS = 1000;
        if (rawData.length > MAX_ROWS) {
            throw new BadRequestException(`Import melebihi batas. Maksimal ${MAX_ROWS} baris, ditemukan ${rawData.length}`);
        }
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
    async generateStudentTemplate() {
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
    sanitizeHtml(input) {
        if (!input)
            return '';
        const str = String(input);
        return str
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
    sanitizeString(input) {
        if (!input)
            return '';
        return String(input).trim();
    }
};
ExcelService = __decorate([
    Injectable()
], ExcelService);
export { ExcelService };
//# sourceMappingURL=excel.service.js.map