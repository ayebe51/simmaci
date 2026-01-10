var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { School } from './entities/school.entity';
import { Teacher } from './entities/teacher.entity';
import { Student } from './entities/student.entity';
import { ExcelService } from '../common/services/excel.service';
let MasterDataService = class MasterDataService {
    schoolRepo;
    teacherRepo;
    studentRepo;
    excelService;
    constructor(schoolRepo, teacherRepo, studentRepo, excelService) {
        this.schoolRepo = schoolRepo;
        this.teacherRepo = teacherRepo;
        this.studentRepo = studentRepo;
        this.excelService = excelService;
    }
    logDebug(msg) {
        try {
            const logPath = path.join(process.cwd(), 'import_debug.log');
            fs.appendFileSync(logPath, msg + '\n');
        }
        catch (e) {
            console.error("Failed to write to debug log", e);
        }
    }
    async findAllSchools() {
        return this.schoolRepo.find({ order: { nama: 'ASC' } });
    }
    async createSchool(data) {
        const school = this.schoolRepo.create({
            nsm: data.nsm,
            npsn: data.npsn,
            nama: data.nama,
            alamat: data.alamat,
            kecamatan: data.kecamatan,
            kepala: data.kepala,
        });
        return this.schoolRepo.save(school);
    }
    async getSchoolById(id) {
        const school = await this.schoolRepo.findOneBy({ id });
        if (!school) {
            throw new Error('School not found');
        }
        return school;
    }
    async getTeachersBySchool(schoolId) {
        const school = await this.getSchoolById(schoolId);
        const teachers = await this.teacherRepo.find({
            where: { satminkal: school.nama }
        });
        return teachers.map(t => ({
            id: t.id,
            nip: t.nuptk,
            nama: t.nama,
            status: t.status,
            mapel: t.mapel,
            sertifikasi: t.isCertified,
            isActive: t.isActive,
            phoneNumber: t.phoneNumber,
            kecamatan: t.kecamatan
        }));
    }
    async upsertSchools(data) {
        return this.schoolRepo.save(data);
    }
    async findAllTeachers(unitKerja, kecamatan, isCertified, search, status, pdpkpnu) {
        const query = this.teacherRepo.createQueryBuilder('teacher');
        if (search) {
            query.andWhere('(teacher.nama LIKE :search OR teacher.nuptk LIKE :search)', { search: `%${search}%` });
        }
        if (unitKerja) {
            query.andWhere('teacher.satminkal = :unitKerja', { unitKerja });
        }
        if (kecamatan) {
            query.andWhere('teacher.kecamatan = :kecamatan', { kecamatan });
        }
        if (isCertified !== undefined && isCertified !== '') {
            const certStatus = isCertified === 'true';
            query.andWhere('teacher.isCertified = :certStatus', { certStatus });
        }
        if (status) {
            query.andWhere('teacher.status = :status', { status });
        }
        if (pdpkpnu) {
            query.andWhere('teacher.pdpkpnu = :pdpkpnu', { pdpkpnu });
        }
        query.orderBy('teacher.nama', 'ASC');
        const teachers = await query.getMany();
        return teachers.map(t => ({
            id: t.id,
            nuptk: t.nuptk,
            nama: t.nama,
            status: t.status,
            satminkal: t.satminkal,
            mapel: t.mapel,
            pdpkpnu: t.pdpkpnu,
            isCertified: t.isCertified,
            isActive: t.isActive ?? true,
            phoneNumber: t.phoneNumber,
            gender: t.gender,
            pendidikanTerakhir: t.pendidikanTerakhir,
            tmt: t.tmt,
            kecamatan: t.kecamatan,
            birthPlace: t.birthPlace,
            birthDate: t.birthDate
        }));
    }
    async createTeacher(data) {
        const teacher = this.teacherRepo.create({
            nuptk: data.nuptk,
            nama: data.nama,
            status: data.status,
            satminkal: data.satminkal,
            kecamatan: data.kecamatan || '',
            pdpkpnu: data.pdpkpnu || 'Belum',
            isCertified: data.isCertified === true,
            phoneNumber: data.phoneNumber || null,
            birthPlace: data.birthPlace || null,
            birthDate: data.birthDate || null,
            mapel: '-',
            jabatan: '-',
            isActive: true,
        });
        return this.teacherRepo.save(teacher);
    }
    async bulkCreateTeachers(teachersData) {
        const results = [];
        const errors = [];
        for (const data of teachersData) {
            try {
                const existing = await this.teacherRepo.findOne({
                    where: { nuptk: data.nuptk },
                });
                if (existing) {
                    errors.push({
                        nuptk: data.nuptk,
                        nama: data.nama,
                        error: 'NUPTK sudah terdaftar',
                    });
                    continue;
                }
                const created = this.teacherRepo.create(data);
                const [saved] = [await this.teacherRepo.save(created)].flat();
                results.push(saved);
            }
            catch (error) {
                errors.push({
                    nuptk: data.nuptk,
                    nama: data.nama,
                    error: error.message,
                });
            }
        }
        if (errors.length > 0) {
            console.log(`Import completed with ${errors.length} errors:`, errors);
        }
        return { success: results, errors };
    }
    async deleteTeacher(id) {
        await this.teacherRepo.delete(id);
        return { success: true };
    }
    async deleteAllTeachers() {
        await this.teacherRepo.clear();
        return { success: true, message: 'All teachers deleted' };
    }
    async uploadFile(file) {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, file.buffer);
        return { url: `/uploads/${filename}`, filename };
    }
    async upsertTeachers(data) {
        try {
            fs.writeFileSync('d:/SIMMACI/debug_upsert.txt', `Starting Upsert: ${new Date().toISOString()}\n`);
        }
        catch { }
        const log = (msg) => { try {
            fs.appendFileSync('d:/SIMMACI/debug_upsert.txt', msg + '\n');
        }
        catch { } };
        const savedTeachers = [];
        const uniqueData = new Map();
        try {
            log(`Processing ${data.length} records.`);
            if (data.length > 0) {
                log(`[DEBUG SAMPLE] Name: ${data[0].nama}, TMT: ${data[0].tmt}, Edu: ${data[0].pendidikanTerakhir}`);
            }
            for (const item of data) {
                if (!item.nama)
                    continue;
                const key = item.nuptk && !item.nuptk.startsWith('TMP-')
                    ? item.nuptk
                    : `${item.nama}_${item.satminkal}`;
                if (!uniqueData.has(key)) {
                    uniqueData.set(key, item);
                }
            }
            const processedItems = Array.from(uniqueData.values());
            log(`Unique Items: ${processedItems.length}`);
            for (const item of processedItems) {
                try {
                    let existing = null;
                    if (item.nuptk && !item.nuptk.startsWith('TMP-')) {
                        existing = await this.teacherRepo.findOneBy({ nuptk: item.nuptk });
                    }
                    if (!existing) {
                        existing = await this.teacherRepo.findOneBy({
                            nama: item.nama,
                            satminkal: item.satminkal
                        });
                    }
                    if (existing) {
                        existing.status = item.status || existing.status;
                        existing.pdpkpnu = item.pdpkpnu || existing.pdpkpnu;
                        existing.isCertified = item.isCertified !== undefined ? item.isCertified : existing.isCertified;
                        Object.assign(existing, {
                            ...item,
                            id: existing.id
                        });
                        await this.teacherRepo.save(existing);
                        savedTeachers.push(existing);
                    }
                    else {
                        const newTeacher = this.teacherRepo.create(item);
                        const saved = await this.teacherRepo.save(newTeacher);
                        savedTeachers.push(saved);
                    }
                }
                catch (innerErr) {
                    console.error(`[Backend] Error upserting specific teacher (${item.nama}):`, innerErr.message);
                    log(`ERROR for ${item.nama}: ${innerErr.message}`);
                }
            }
        }
        catch (err) {
            console.error("[Backend] CRITICAL ERROR in upsertTeachers:", err);
            log(`CRITICAL ERROR: ${err.message}`);
            throw err;
        }
        return savedTeachers;
    }
    async findAllStudents(schoolId) {
        const where = schoolId ? { schoolId } : {};
        const students = await this.studentRepo.find({ where, order: { name: 'ASC' } });
        return students.map(s => ({
            id: s.id,
            nisn: s.nisn,
            nama: s.name,
            jk: s.gender,
            kelas: s.class,
            sekolah: s.schoolId,
        }));
    }
    async createStudent(data) {
        const student = this.studentRepo.create({
            nisn: data.nisn,
            name: data.nama,
            gender: data.jk,
            class: data.kelas,
            schoolId: data.sekolah,
        });
        return this.studentRepo.save(student);
    }
    async upsertStudents(data) {
        return this.studentRepo.save(data);
    }
    async updateSchool(id, data) {
        await this.schoolRepo.update(id, data);
        return this.schoolRepo.findOneBy({ id });
    }
    async updateTeacher(id, data) {
        await this.teacherRepo.update(id, data);
        return this.teacherRepo.findOneBy({ id });
    }
    async importSchools(fileBuffer) {
        const logs = [];
        const log = (msg) => { console.log(msg); logs.push(msg); };
        try {
            log('Starting School Import...');
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            log(`Total rows in sheet: ${rows.length}`);
            let headerRowIndex = -1;
            let isUserFormat = false;
            for (let i = 0; i < Math.min(rows.length, 10); i++) {
                const rowString = JSON.stringify(rows[i] || []).toLowerCase();
                log(`Checking row ${i}: ${rowString}`);
                if (rowString.includes('nama satuan pendidikan') || rowString.includes('nsm/nss')) {
                    headerRowIndex = i;
                    isUserFormat = true;
                    log(`Format detected at row ${i}`);
                    break;
                }
            }
            const schools = [];
            if (isUserFormat) {
                log('Processing User Format');
                const rawHeader = rows[headerRowIndex] || [];
                const header = Array.from(rawHeader).map(h => String(h || '').trim().toLowerCase());
                log(`Header: ${JSON.stringify(header)}`);
                const idxKec = header.findIndex(h => h === 'kecamatan');
                const idxNama = header.findIndex(h => h === 'nama satuan pendidikan');
                const idxNsm = header.findIndex(h => h.includes('nsm') || h.includes('nss'));
                const idxNpsn = header.findIndex(h => h === 'npsn');
                let idxJamiyyah = header.findIndex(h => h.includes("jam'iyyah") || h.includes("jama'ah"));
                const idxStatus = header.findIndex(h => h === 'status');
                const idxKepala = header.findIndex(h => h.includes('nama kepala'));
                const idxWa = header.findIndex(h => h.includes('nomor wa') || h.includes('no wa'));
                if (idxJamiyyah === -1 && idxStatus !== -1) {
                    for (let k = headerRowIndex + 1; k < Math.min(rows.length, headerRowIndex + 6); k++) {
                        const val = String(rows[k]?.[idxStatus] || '').toLowerCase();
                        if (val.includes("jam'iyyah") || val.includes("jama'ah") || val.includes('afiliasi')) {
                            console.log("Detected Jam'iyyah data in 'Status' column");
                            idxJamiyyah = idxStatus;
                            break;
                        }
                    }
                }
                log(`Indices - Nama: ${idxNama}, NSM: ${idxNsm}, NPSN: ${idxNpsn}, Status: ${idxStatus}, Jamiyyah: ${idxJamiyyah}`);
                const skippedInfo = { missingNsm: 0, emptyRow: 0 };
                let processedCount = 0;
                for (let i = headerRowIndex + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) {
                        skippedInfo.emptyRow++;
                        continue;
                    }
                    const rawNsm = row[idxNsm];
                    if (!rawNsm) {
                        skippedInfo.missingNsm++;
                        if (skippedInfo.missingNsm <= 5)
                            log(`Skipping row ${i} due to missing NSM. Row content: ${JSON.stringify(row)}`);
                        continue;
                    }
                    processedCount++;
                    const nsm = String(rawNsm).trim();
                    let school = await this.schoolRepo.findOneBy({ nsm });
                    if (!school) {
                        school = new School();
                        school.nsm = nsm;
                    }
                    school.nama = row[idxNama] ? String(row[idxNama]).trim() : 'Tanpa Nama';
                    school.npsn = row[idxNpsn] ? String(row[idxNpsn]).trim() : '-';
                    school.kecamatan = row[idxKec] ? String(row[idxKec]).trim() : '-';
                    school.status = row[idxStatus] ? String(row[idxStatus]).trim() : '-';
                    school.kepala = row[idxKepala] ? String(row[idxKepala]).trim() : '-';
                    school.noHpKepala = row[idxWa] ? String(row[idxWa]).trim() : '-';
                    school.statusJamiyyah = row[idxJamiyyah] ? String(row[idxJamiyyah]).trim() : '-';
                    school.alamat = school.kecamatan;
                    schools.push(school);
                }
            }
            else {
                const data = XLSX.utils.sheet_to_json(worksheet);
                log('Standard Format Fallback (logic skipped for brevity in debug wrap)');
                for (const row of data) {
                    const nsm = row['NSM'] ? String(row['NSM']) : null;
                    if (!nsm)
                        continue;
                    let school = await this.schoolRepo.findOneBy({ nsm });
                    if (!school) {
                        school = new School();
                        school.nsm = nsm;
                    }
                    school.npsn = row['NPSN'] ? String(row['NPSN']) : '-';
                    school.nama = row['Nama Lembaga'] || row['Nama'] || 'Tanpa Nama';
                    school.alamat = row['Alamat'] || '-';
                    school.kecamatan = row['Kecamatan'] || '-';
                    school.kepala = row['Kepala Madrasah'] || row['Kepala'] || '-';
                    schools.push(school);
                }
            }
            log(`Prepared ${schools.length} schools for saving.`);
            const saved = await this.schoolRepo.save(schools);
            log(`Successfully saved ${saved.length} schools.`);
            fs.writeFileSync('d:/SIMMACI/debug_school_import.log', logs.join('\n'));
            return { success: true, count: saved.length };
        }
        catch (err) {
            log(`ERROR: ${err.message}`);
            log(err.stack);
            fs.writeFileSync('d:/SIMMACI/debug_school_import.log', logs.join('\n'));
            throw err;
        }
    }
    async importTeachers(fileBuffer) {
        try {
            this.logDebug('--- Starting Teacher Import ---');
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            this.logDebug(`Total rows in sheet: ${rows.length}`);
            let headerRowIndex = 0;
            let isUserFormat = false;
            for (let i = 0; i < Math.min(rows.length, 10); i++) {
                const r = rows[i] || [];
                const str = r.map(c => String(c || '').toLowerCase()).join(' ');
                this.logDebug(`Scanning row ${i}: ${str}`);
                if (str.includes('nama madrasah') && str.includes('nama lengkap')) {
                    headerRowIndex = i;
                    isUserFormat = true;
                    this.logDebug(`Header detected at row ${i}`);
                    break;
                }
            }
            const teachers = [];
            if (isUserFormat) {
                this.logDebug(`Importing User Format Teachers (Header at row ${headerRowIndex})...`);
                const headerRow = rows[headerRowIndex];
                this.logDebug(`Header Row: ${JSON.stringify(headerRow)}`);
                if (!headerRow || !Array.isArray(headerRow)) {
                    console.error('CRITICAL: Header row is invalid or empty');
                    return [];
                }
                let idxNama = -1;
                let idxMadrasah = -1;
                let idxJk = -1;
                let idxTempatLahir = -1;
                let idxTanggalLahir = -1;
                let idxPhone = -1;
                let idxSerdik = -1;
                let idxPkpnu = -1;
                let idxKecamatan = -1;
                const clean = (s) => String(s || '').trim().toLowerCase();
                try {
                    headerRow.forEach((val, idx) => {
                        if (!val)
                            return;
                        const v = clean(val);
                        if (v.includes('nama madrasah'))
                            idxMadrasah = idx;
                        else if (v.includes('nama lengkap') || v === 'nama')
                            idxNama = idx;
                        else if (v === 'jk' || v.includes('jenis kelamin'))
                            idxJk = idx;
                        else if (v.includes('tempat lahir'))
                            idxTempatLahir = idx;
                        else if (v.includes('tanggal lahir') || v.includes('tgl lahir'))
                            idxTanggalLahir = idx;
                        else if (v.includes('no hp') || v.includes('nomor hp'))
                            idxPhone = idx;
                        else if (v.includes('sertifikasi'))
                            idxSerdik = idx;
                        else if (v.includes('sertifikasi'))
                            idxSerdik = idx;
                        else if (v.includes('pkpnu'))
                            idxPkpnu = idx;
                        else if (v.includes('kecamatan'))
                            idxKecamatan = idx;
                    });
                }
                catch (err) {
                    console.error('Error during header scanning:', err);
                }
                this.logDebug(`Column Mapping: ${JSON.stringify({ idxMadrasah, idxNama, idxSerdik, idxPkpnu })}`);
                if (idxNama === -1)
                    idxNama = 1;
                if (idxMadrasah === -1)
                    idxMadrasah = 0;
                if (idxJk === -1)
                    idxJk = 2;
                const subHeaderRow = rows[headerRowIndex + 1];
                this.logDebug(`SubHeader Row: ${JSON.stringify(subHeaderRow)}`);
                if (subHeaderRow && Array.isArray(subHeaderRow)) {
                    if (idxSerdik !== -1) {
                        const valAtIdx = clean(subHeaderRow[idxSerdik]);
                        const valNext = clean(subHeaderRow[idxSerdik + 1]);
                        if (['sudah', 'ya', 'v'].includes(valAtIdx)) {
                        }
                        else if (['sudah', 'ya', 'v'].includes(valNext)) {
                            idxSerdik = idxSerdik + 1;
                            this.logDebug(`Adjusted idxSerdik to ${idxSerdik}`);
                        }
                    }
                    if (idxPkpnu !== -1) {
                        const valAtIdx = clean(subHeaderRow[idxPkpnu]);
                        const valNext = clean(subHeaderRow[idxPkpnu + 1]);
                        if (['sudah', 'ya', 'v'].includes(valAtIdx)) {
                        }
                        else if (['sudah', 'ya', 'v'].includes(valNext)) {
                            idxPkpnu = idxPkpnu + 1;
                            this.logDebug(`Adjusted idxPkpnu to ${idxPkpnu}`);
                        }
                    }
                    if (idxKecamatan === -1) {
                        subHeaderRow.forEach((val, idx) => {
                            if (clean(val).includes('kecamatan')) {
                                idxKecamatan = idx;
                                this.logDebug(`Found Kecamatan in Sub-Header at ${idx}`);
                            }
                        });
                    }
                }
                if (idxSerdik === -1)
                    idxSerdik = 8;
                if (idxPkpnu === -1)
                    idxPkpnu = 10;
                if (idxPhone === -1)
                    idxPhone = 12;
                for (let i = headerRowIndex + 2; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0)
                        continue;
                    const madrasahName = String(row[idxMadrasah] || '').trim();
                    const nama = String(row[idxNama] || '').trim();
                    if (!nama)
                        continue;
                    const jk = String(row[idxJk] || '');
                    const birthPlace = idxTempatLahir !== -1 ? String(row[idxTempatLahir] || '') : '';
                    const birthDate = idxTanggalLahir !== -1 ? String(row[idxTanggalLahir] || '') : '';
                    const valPkpnu = clean(row[idxPkpnu]);
                    const pkpnuSudah = ['ya', 'sudah', 'v'].includes(valPkpnu);
                    const isSerdik = ['ya', 'sudah', 'v'].includes(clean(row[idxSerdik]));
                    if (i < headerRowIndex + 7) {
                        this.logDebug(`Row ${i}: Name=${nama}, PKPNU_RAW='${row[idxPkpnu]}', PKPNU_CLEAN='${valPkpnu}', SUDAH=${pkpnuSudah}`);
                    }
                    const phone = String(row[idxPhone] || '');
                    let teacher = await this.teacherRepo.findOneBy({
                        nama: nama,
                        satminkal: madrasahName
                    });
                    if (!teacher) {
                        teacher = new Teacher();
                        teacher.nama = nama;
                        teacher.satminkal = madrasahName;
                        teacher.nuptk = 'TMP-' + Date.now() + Math.floor(Math.random() * 1000);
                        teacher.nuptk = 'TMP-' + Date.now() + Math.floor(Math.random() * 1000);
                    }
                    if (idxKecamatan !== -1) {
                        teacher.kecamatan = String(row[idxKecamatan] || '').trim();
                    }
                    else if (!teacher.kecamatan || teacher.kecamatan === '-') {
                    }
                    teacher.gender = jk;
                    teacher.birthPlace = birthPlace;
                    teacher.birthDate = birthDate;
                    teacher.status = isSerdik ? 'Sertifikasi' : 'Honorer';
                    teacher.isCertified = isSerdik;
                    teacher.phoneNumber = phone;
                    teacher.pdpkpnu = pkpnuSudah ? 'Sudah' : 'Belum';
                    teachers.push(teacher);
                    await this.teacherRepo.save(teacher);
                }
                this.logDebug(`Saved ${teachers.length} teachers.`);
            }
            else {
                const data = XLSX.utils.sheet_to_json(worksheet);
                for (const row of data) {
                    const nuptk = row['NUPTK'] || row['PegID'] ? String(row['NUPTK'] || row['PegID']) : null;
                    if (!nuptk)
                        continue;
                    let teacher = await this.teacherRepo.findOneBy({ nuptk });
                    if (!teacher) {
                        teacher = new Teacher();
                        teacher.nuptk = nuptk;
                    }
                    teacher.nama = row['Nama'] || 'Tanpa Nama';
                    teacher.status = row['Status'] || 'Lainnya';
                    teacher.satminkal = row['Satminkal'] || row['Unit Kerja'] || '-';
                    teacher.kecamatan = row['Kecamatan'] || '-';
                    teacher.mapel = row['Mapel'] || row['Mata Pelajaran'] || '-';
                    teachers.push(teacher);
                }
            }
            console.log('Saving teachers:', teachers.length);
            await this.teacherRepo.save(teachers);
            return { success: true, count: teachers.length };
        }
        catch (err) {
            console.error('CRITICAL IMPORT ERROR:', err);
            throw err;
        }
    }
    async exportTeachers(unitKerja, kecamatan, isCertified) {
        const teachers = await this.findAllTeachers(unitKerja, kecamatan, isCertified);
        const data = teachers.map((t) => ({
            'NUPTK': t.nuptk,
            'Status': t.status,
            'Sertifikasi': t.isCertified ? 'Ya' : 'Tidak',
            'Nama': t.nama,
            'Kecamatan': t.kecamatan,
            'Unit Kerja': t.satminkal,
            'Mapel': t.mapel,
            'PDPKPNU': t.pdpkpnu,
            'No HP': t.phoneNumber,
            'Status Aktif': t.isActive ? 'Aktif' : 'Non-Aktif'
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Guru');
        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }
    async exportSchools() {
        const schools = await this.findAllSchools();
        const data = schools.map((s) => ({
            'NSM': s.nsm,
            'NPSN': s.npsn,
            'Nama Sekolah': s.nama,
            'Alamat': s.alamat,
            'Kecamatan': s.kecamatan,
            'Kepala Sekolah': s.kepala,
            'No HP Kepala': s.noHpKepala,
            'Status Jamiyyah': s.statusJamiyyah
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Madrasah');
        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }
    async exportStudents(schoolId) {
        let students;
        if (schoolId) {
            students = await this.studentRepo.find({ where: { schoolId: schoolId } });
        }
        else {
            students = await this.studentRepo.find();
        }
        const data = students.map((s) => ({
            'NISN': s.nisn,
            'Nama': s.name,
            'Jenis Kelamin': s.gender,
            'Kelas': s.class,
            'Tempat Lahir': s.birthPlace,
            'Tanggal Lahir': s.birthDate,
            'Alamat': s.address,
            'NIK': s.nik,
            'Nama Ayah': s.fatherName,
            'Nama Ibu': s.motherName,
            'School ID': s.schoolId,
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa');
        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }
    async bulkCreateStudents(studentsData) {
        const results = [];
        const errors = [];
        for (const data of studentsData) {
            try {
                const student = this.studentRepo.create(data);
                const saved = await this.studentRepo.save(student);
                results.push(saved);
            }
            catch (error) {
                errors.push({
                    nisn: data.nisn,
                    nama: data.nama,
                    error: error.message,
                });
            }
        }
        return { success: results, errors };
    }
};
MasterDataService = __decorate([
    Injectable(),
    __param(0, InjectRepository(School)),
    __param(1, InjectRepository(Teacher)),
    __param(2, InjectRepository(Student)),
    __metadata("design:paramtypes", [Repository,
        Repository,
        Repository, typeof (_a = typeof ExcelService !== "undefined" && ExcelService) === "function" ? _a : Object])
], MasterDataService);
export { MasterDataService };
//# sourceMappingURL=master-data.service.js.map