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
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { PermissionsService } from '../auth/permissions.service';
let UsersService = class UsersService {
    usersRepository;
    permissionsService;
    constructor(usersRepository, permissionsService) {
        this.usersRepository = usersRepository;
        this.permissionsService = permissionsService;
    }
    async findOne(username) {
        return this.usersRepository.findOne({ where: { username } });
    }
    async create(userData) {
        if (!userData.password) {
            throw new Error("Password is required");
        }
        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(userData.password, salt);
        const role = userData.role || 'operator_madrasah';
        const permissions = this.permissionsService.getRolePermissions(role);
        const user = this.usersRepository.create({
            ...userData,
            password: hashedPassword,
            role: role,
            permissions: permissions,
        });
        return this.usersRepository.save(user);
    }
    async createSuperAdmin(userData) {
        console.log('Creating Super Admin:', userData.username);
        if (!userData.username) {
            throw new Error('Username is required');
        }
        const existing = await this.findOne(userData.username);
        if (existing) {
            console.log('User exists. Deleting to ensure clean state...');
            await this.usersRepository.remove(existing);
        }
        console.log('Creating new Super Admin entry...');
        if (!userData.password) {
            throw new Error('Password is required');
        }
        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(userData.password, salt);
        const permissions = this.permissionsService.getRolePermissions('super_admin');
        const user = this.usersRepository.create({
            ...userData,
            password: hashedPassword,
            role: 'super_admin',
            permissions: permissions,
        });
        const saved = await this.usersRepository.save(user);
        console.log('Super Admin Created:', saved.username);
        return saved;
    }
    async findAll() {
        return this.usersRepository.find();
    }
};
UsersService = __decorate([
    Injectable(),
    __param(0, InjectRepository(User)),
    __metadata("design:paramtypes", [Repository, typeof (_a = typeof PermissionsService !== "undefined" && PermissionsService) === "function" ? _a : Object])
], UsersService);
export { UsersService };
//# sourceMappingURL=users.service.js.map