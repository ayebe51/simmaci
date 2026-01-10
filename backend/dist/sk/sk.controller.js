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
import { Controller, Get, Post, Put, Body, UseGuards, Request, Param, NotFoundException } from '@nestjs/common';
import { SkService } from './sk.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
let SkController = class SkController {
    skService;
    constructor(skService) {
        this.skService = skService;
    }
    create(data, req) {
        return this.skService.create(data, req.user);
    }
    findAll(req) {
        return this.skService.findAll(req.user);
    }
    findOne(id) {
        return this.skService.findOne(id);
    }
    update(id, data) {
        return this.skService.update(id, data);
    }
    deleteAll() {
        return this.skService.deleteAll();
    }
};
__decorate([
    Post(),
    __param(0, Body()),
    __param(1, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SkController.prototype, "create", null);
__decorate([
    Get(),
    __param(0, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SkController.prototype, "findAll", null);
__decorate([
    Get(':id'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SkController.prototype, "findOne", null);
__decorate([
    Put(':id'),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SkController.prototype, "update", null);
__decorate([
    Post('delete-all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SkController.prototype, "deleteAll", null);
SkController = __decorate([
    Controller('sk'),
    UseGuards(JwtAuthGuard),
    __metadata("design:paramtypes", [typeof (_a = typeof SkService !== "undefined" && SkService) === "function" ? _a : Object])
], SkController);
export { SkController };
let SkPublicController = class SkPublicController {
    skService;
    constructor(skService) {
        this.skService = skService;
    }
    async verifyPublic(id) {
        const result = await this.skService.verifyPublic(id);
        if (!result) {
            throw new NotFoundException('Data tidak ditemukan');
        }
        return result;
    }
};
__decorate([
    Get('verify/:id'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SkPublicController.prototype, "verifyPublic", null);
SkPublicController = __decorate([
    Controller('sk'),
    __metadata("design:paramtypes", [typeof (_b = typeof SkService !== "undefined" && SkService) === "function" ? _b : Object])
], SkPublicController);
export { SkPublicController };
//# sourceMappingURL=sk.controller.js.map