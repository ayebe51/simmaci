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
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HeadmasterTenure, HeadmasterStatus } from './entities/headmaster-tenure.entity';
import { Teacher } from '../master-data/entities/teacher.entity';
let HeadmasterService = class HeadmasterService {
    repo;
    teacherRepo;
    constructor(repo, teacherRepo) {
        this.repo = repo;
        this.teacherRepo = teacherRepo;
    }
    async create(data, _user) {
        if (!data.periode || data.periode > 3) {
            throw new BadRequestException('Maksimal menjabat adalah 3 periode.');
        }
        if (!data.teacherId)
            throw new BadRequestException('Guru wajib dipilih.');
        const existingActive = await this.repo.findOne({
            where: {
                teacherId: data.teacherId,
                status: HeadmasterStatus.ACTIVE,
            },
        });
        if (existingActive) {
            throw new BadRequestException('Guru ini masih menjabat aktif sebagai kepala madrasah di tempat lain/periode berjalan.');
        }
        if (!data.tmt)
            throw new BadRequestException('TMT wajib diisi.');
        const tmt = new Date(data.tmt);
        const endDate = new Date(tmt);
        endDate.setFullYear(tmt.getFullYear() + 4);
        const tenure = this.repo.create({
            ...data,
            endDate,
            status: HeadmasterStatus.SUBMITTED,
        });
        return this.repo.save(tenure);
    }
    async findAll() {
        return this.repo.find({
            order: { createdAt: 'DESC' },
            relations: ['teacher', 'school'],
        });
    }
    async findOne(id) {
        return this.repo.findOne({
            where: { id },
            relations: ['teacher', 'school'],
        });
    }
    async verify(id) {
        await this.repo.update(id, { status: HeadmasterStatus.VERIFIED });
        return this.repo.findOneBy({ id });
    }
    async approve(id, signatureUrl, skUrl) {
        const updateData = { status: HeadmasterStatus.APPROVED };
        if (signatureUrl)
            updateData.digitalSignatureUrl = signatureUrl;
        if (skUrl)
            updateData.skUrl = skUrl;
        await this.repo.update(id, updateData);
        const tenure = await this.repo.findOne({
            where: { id },
            relations: ['teacher'],
        });
        if (tenure && tenure.teacher) {
            tenure.teacher.jabatan = 'Kepala Madrasah';
            await this.teacherRepo.save(tenure.teacher);
        }
        return tenure;
    }
    async reject(id, reason) {
        await this.repo.update(id, {
            status: HeadmasterStatus.REJECTED,
            keterangan: reason,
        });
        return this.repo.findOneBy({ id });
    }
    async verifyPublic(id) {
        const tenure = await this.repo.findOne({
            where: { id },
            relations: ['teacher', 'school'],
            select: {
                id: true,
                status: true,
                skNumber: true,
                tmt: true,
                endDate: true,
                digitalSignatureUrl: true,
                teacher: {
                    id: true,
                    nama: true,
                    nuptk: true,
                    status: true,
                },
                school: {
                    id: true,
                    nama: true,
                    npsn: true,
                },
            },
        });
        if (!tenure)
            return null;
        return tenure;
    }
};
HeadmasterService = __decorate([
    Injectable(),
    __param(0, InjectRepository(HeadmasterTenure)),
    __param(1, InjectRepository(Teacher)),
    __metadata("design:paramtypes", [Repository,
        Repository])
], HeadmasterService);
export { HeadmasterService };
//# sourceMappingURL=headmaster.service.js.map