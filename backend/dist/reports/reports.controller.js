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
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';
let ReportsController = class ReportsController {
    reportsService;
    constructor(reportsService) {
        this.reportsService = reportsService;
    }
    async getTeacherSummary(unitKerja, kecamatan) {
        return this.reportsService.getTeacherSummary(unitKerja, kecamatan);
    }
    async getSKSummary(unitKerja, startDate, endDate) {
        return this.reportsService.getSKSummary(unitKerja, startDate, endDate);
    }
    async getMonthlyStats(year) {
        return this.reportsService.getMonthlyStats(year);
    }
};
__decorate([
    Get('teacher-summary'),
    __param(0, Query('unitKerja')),
    __param(1, Query('kecamatan')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getTeacherSummary", null);
__decorate([
    Get('sk-summary'),
    __param(0, Query('unitKerja')),
    __param(1, Query('startDate')),
    __param(2, Query('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getSKSummary", null);
__decorate([
    Get('monthly-stats'),
    __param(0, Query('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getMonthlyStats", null);
ReportsController = __decorate([
    Controller('reports'),
    UseGuards(JwtAuthGuard),
    __metadata("design:paramtypes", [typeof (_a = typeof ReportsService !== "undefined" && ReportsService) === "function" ? _a : Object])
], ReportsController);
export { ReportsController };
//# sourceMappingURL=reports.controller.js.map