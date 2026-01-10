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
import * as fs from 'fs';
import { Sk } from './entities/sk.entity';
let SkService = class SkService {
    skRepo;
    constructor(skRepo) {
        this.skRepo = skRepo;
    }
    async create(data, user) {
        try {
            const sk = this.skRepo.create({
                ...data,
                user,
                unitKerja: user.unitKerja || data.unitKerja,
            });
            const saved = await this.skRepo.save(sk);
            return saved;
        }
        catch (e) {
            const errorMsg = `[SK CREATE ERROR] User: ${user.id} | Data: ${JSON.stringify(data)} | Error: ${e.message}`;
            console.error(errorMsg);
            fs.appendFileSync('d:/SIMMACI/debug_sk_error.txt', `\n${errorMsg}`);
            throw e;
        }
    }
    async findAll(user) {
        if (user.role === 'super_admin' || user.role === 'admin_pusat') {
            return this.skRepo.find({ order: { createdAt: 'DESC' }, relations: ['user'] });
        }
        return this.skRepo.find({
            where: { userId: user.id },
            order: { createdAt: 'DESC' }
        });
    }
    async findOne(id) {
        return this.skRepo.findOne({ where: { id }, relations: ['user'] });
    }
    async deleteAll() {
        try {
            await this.skRepo.delete({});
        }
        catch (e) {
            try {
                fs.writeFileSync('d:/SIMMACI/debug_sk_error.txt', `Delete method failed: ${e.message}\nTrying raw SQL...`);
                await this.skRepo.query('DELETE FROM sk');
            }
            catch (inner) {
                const msg = `Delete Error: ${e.message} | Inner: ${inner.message}`;
                fs.appendFileSync('d:/SIMMACI/debug_sk_error.txt', `\nCritial: ${msg}`);
                console.error(msg);
                throw new Error(msg);
            }
        }
    }
    async update(id, data) {
        try {
            await this.skRepo.update(id, data);
            const updated = await this.findOne(id);
            if (!updated)
                throw new Error("SK Not Found");
            return updated;
        }
        catch (e) {
            fs.appendFileSync('d:/SIMMACI/debug_sk_error.txt', `\n[UPDATE FAIL] ID: ${id} | DATA: ${JSON.stringify(data)} | ERR: ${e.message}`);
            throw e;
        }
    }
    async verifyPublic(id) {
        const sk = await this.skRepo.findOne({
            where: { id },
            select: {
                id: true,
                jenis: true,
                nama: true,
                niy: true,
                status: true,
                nomorSurat: true,
                unitKerja: true,
                createdAt: true,
            },
        });
        if (!sk)
            return null;
        return {
            id: sk.id,
            skNumber: sk.nomorSurat,
            status: sk.status,
            teacher: {
                nama: sk.nama,
                nuptk: sk.niy || '-',
            },
            jenis: sk.jenis,
            unitKerja: sk.unitKerja,
            createdAt: sk.createdAt,
        };
    }
};
SkService = __decorate([
    Injectable(),
    __param(0, InjectRepository(Sk)),
    __metadata("design:paramtypes", [Repository])
], SkService);
export { SkService };
//# sourceMappingURL=sk.service.js.map