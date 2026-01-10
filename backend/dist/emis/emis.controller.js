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
import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { EmisService } from './emis.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
let EmisController = class EmisController {
    emisService;
    constructor(emisService) {
        this.emisService = emisService;
    }
    async import(data, req) {
        return this.emisService.importStudents(data, req.user);
    }
};
__decorate([
    Post('import'),
    UseGuards(JwtAuthGuard),
    __param(0, Body()),
    __param(1, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], EmisController.prototype, "import", null);
EmisController = __decorate([
    Controller('emis'),
    __metadata("design:paramtypes", [typeof (_a = typeof EmisService !== "undefined" && EmisService) === "function" ? _a : Object])
], EmisController);
export { EmisController };
//# sourceMappingURL=emis.controller.js.map