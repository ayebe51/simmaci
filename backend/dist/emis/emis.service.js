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
import { Student } from '../master-data/entities/student.entity';
let EmisService = class EmisService {
    studentRepo;
    constructor(studentRepo) {
        this.studentRepo = studentRepo;
    }
    async importStudents(data, user) {
        const students = data.map(item => ({
            nisn: item.nisn || null,
            name: item.name,
            gender: item.gender,
            class: item.kelas || item.class,
            fatherName: item.fatherName || item.nama_ayah,
            motherName: item.motherName || item.nama_ibu,
            nik: item.nik,
            address: item.address,
            birthPlace: item.birthPlace,
            birthDate: item.birthDate,
            schoolId: user.unitKerja
        }));
        const saved = [];
        for (const s of students) {
            if (s.nisn) {
                const existing = await this.studentRepo.findOne({ where: { nisn: s.nisn } });
                if (existing) {
                    await this.studentRepo.update(existing.id, s);
                    continue;
                }
            }
            const newStudent = this.studentRepo.create(s);
            await this.studentRepo.save(newStudent);
            saved.push(newStudent);
        }
        return { count: saved.length };
    }
};
EmisService = __decorate([
    Injectable(),
    __param(0, InjectRepository(Student)),
    __metadata("design:paramtypes", [Repository])
], EmisService);
export { EmisService };
//# sourceMappingURL=emis.service.js.map