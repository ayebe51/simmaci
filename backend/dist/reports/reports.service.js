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
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teacher } from '../master-data/entities/teacher.entity';
import { Sk } from '../sk/entities/sk.entity';
let ReportsService = class ReportsService {
    teacherRepo;
    skRepo;
    constructor(teacherRepo, skRepo) {
        this.teacherRepo = teacherRepo;
        this.skRepo = skRepo;
    }
    async getTeacherSummary(unitKerja, kecamatan) {
        const query = this.teacherRepo.createQueryBuilder('teacher');
        if (unitKerja) {
            query.where('teacher.satminkal = :unitKerja', { unitKerja });
        }
        if (kecamatan) {
            query.andWhere('teacher.kecamatan = :kecamatan', { kecamatan });
        }
        const teachers = await query.getMany();
        const total = teachers.length;
        const byStatus = teachers.reduce((acc, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1;
            return acc;
        }, {});
        const certified = teachers.filter(t => t.isCertified).length;
        const uncertified = total - certified;
        const pdpkpnuSudah = teachers.filter(t => t.pdpkpnu === 'Sudah').length;
        const pdpkpnuBelum = total - pdpkpnuSudah;
        const byKecamatan = teachers.reduce((acc, t) => {
            const kec = t.kecamatan || 'Tidak Diketahui';
            acc[kec] = (acc[kec] || 0) + 1;
            return acc;
        }, {});
        return {
            total,
            byStatus,
            byCertification: {
                certified,
                uncertified,
            },
            byPDPKPNU: {
                sudah: pdpkpnuSudah,
                belum: pdpkpnuBelum,
            },
            byKecamatan,
        };
    }
    async getSKSummary(unitKerja, startDate, endDate) {
        const query = this.skRepo.createQueryBuilder('sk');
        if (unitKerja) {
            query.where('sk.unitKerja = :unitKerja', { unitKerja });
        }
        if (startDate) {
            query.andWhere('sk.createdAt >= :startDate', {
                startDate: new Date(startDate),
            });
        }
        if (endDate) {
            query.andWhere('sk.createdAt <= :endDate', {
                endDate: new Date(endDate),
            });
        }
        const sks = await query.getMany();
        const total = sks.length;
        const byStatus = sks.reduce((acc, sk) => {
            acc[sk.status] = (acc[sk.status] || 0) + 1;
            return acc;
        }, {});
        const byType = sks.reduce((acc, sk) => {
            acc[sk.jenis] = (acc[sk.jenis] || 0) + 1;
            return acc;
        }, {});
        return {
            total,
            byStatus,
            byType,
            period: {
                from: startDate || 'all',
                to: endDate || 'now',
            },
        };
    }
    async getMonthlyStats(year) {
        const targetYear = year || new Date().getFullYear().toString();
        const startDate = new Date(`${targetYear}-01-01`);
        const endDate = new Date(`${targetYear}-12-31`);
        const sks = await this.skRepo
            .createQueryBuilder('sk')
            .where('sk.createdAt >= :startDate', { startDate })
            .andWhere('sk.createdAt <= :endDate', { endDate })
            .getMany();
        const monthlyData = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            monthName: new Date(2024, i).toLocaleString('id-ID', { month: 'long' }),
            count: 0,
            approved: 0,
            pending: 0,
            rejected: 0,
        }));
        sks.forEach(sk => {
            const month = new Date(sk.createdAt).getMonth();
            monthlyData[month].count++;
            if (sk.status === 'Approved')
                monthlyData[month].approved++;
            else if (sk.status === 'Pending')
                monthlyData[month].pending++;
            else if (sk.status === 'Rejected')
                monthlyData[month].rejected++;
        });
        return {
            year: targetYear,
            monthlyData,
            total: sks.length,
        };
    }
};
ReportsService = __decorate([
    Injectable(),
    __param(0, InjectRepository(Teacher)),
    __param(1, InjectRepository(Sk)),
    __metadata("design:paramtypes", [Repository,
        Repository])
], ReportsService);
export { ReportsService };
//# sourceMappingURL=reports.service.js.map