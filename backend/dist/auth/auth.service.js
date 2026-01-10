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
var _a, _b;
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PermissionsService } from './permissions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
let AuthService = class AuthService {
    usersService;
    jwtService;
    permissionsService;
    usersRepository;
    constructor(usersService, jwtService, permissionsService, usersRepository) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.permissionsService = permissionsService;
        this.usersRepository = usersRepository;
    }
    async validateUser(username, pass) {
        const user = await this.usersService.findOne(username);
        if (!user) {
            console.log('ValidateUser: User not found', username);
            return null;
        }
        try {
            const isMatch = await bcrypt.compare(pass, user.password);
            console.log(`ValidateUser: ${username} found. Password match? ${isMatch}`);
            if (user && isMatch) {
                const { password, ...result } = user;
                return result;
            }
        }
        catch (e) {
            console.error("Bcrypt Error:", e);
            throw new Error(`Password validation error: ${e.message}`);
        }
        return null;
    }
    async login(user) {
        try {
            let permissions = user.permissions;
            if (!permissions || permissions.length === 0) {
                console.warn(`User ${user.username} has no permissions. Auto-assigning...`);
                permissions = this.permissionsService.getRolePermissions(user.role);
                await this.usersRepository.update(user.id, { permissions });
            }
            const payload = {
                username: user.username,
                sub: user.id,
                role: user.role,
                unitKerja: user.unitKerja,
                kecamatan: user.kecamatan,
                permissions: permissions
            };
            return {
                access_token: this.jwtService.sign(payload),
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    name: user.name,
                    unitKerja: user.unitKerja,
                    kecamatan: user.kecamatan,
                    permissions: permissions
                }
            };
        }
        catch (e) {
            console.error("JWT Error:", e);
            throw new Error(`Token generation error: ${e.message}`);
        }
    }
    async checkUsers() {
        const users = await this.usersService.findAll();
        return {
            count: users.length,
            users: users.map(u => ({
                id: u.id,
                username: u.username,
                role: u.role,
            }))
        };
    }
    async register(data) {
        return this.usersService.create(data);
    }
    async createDefaultAdmin() {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Cannot create default admin in production. Create admin manually.');
        }
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword) {
            throw new Error('ADMIN_PASSWORD environment variable not set. Cannot create admin.');
        }
        const admin = await this.usersService.createSuperAdmin({
            username: 'admin',
            password: adminPassword,
            name: 'Super Administrator'
        });
        return {
            message: "Super Admin created/updated successfully",
            username: 'admin',
        };
    }
};
AuthService = __decorate([
    Injectable(),
    __param(3, InjectRepository(User)),
    __metadata("design:paramtypes", [typeof (_a = typeof UsersService !== "undefined" && UsersService) === "function" ? _a : Object, JwtService, typeof (_b = typeof PermissionsService !== "undefined" && PermissionsService) === "function" ? _b : Object, Repository])
], AuthService);
export { AuthService };
//# sourceMappingURL=auth.service.js.map