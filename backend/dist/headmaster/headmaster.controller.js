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
import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, Res, NotFoundException } from '@nestjs/common';
import { HeadmasterService } from './headmaster.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PdfService } from '../pdf/pdf.service';
let HeadmasterController = class HeadmasterController {
    service;
    pdfService;
    constructor(service, pdfService) {
        this.service = service;
        this.pdfService = pdfService;
    }
    create(data, req) {
        return this.service.create(data, req.user);
    }
    findAll() {
        return this.service.findAll();
    }
    ping() {
        return "pong";
    }
    async downloadPdf(id, res) {
        console.log("DEBUG: downloadPdf called with ID:", id);
        const tenure = await this.service.findOne(id);
        if (!tenure) {
            console.log("DEBUG: Tenure not found for ID:", id);
            throw new NotFoundException(`Data SK tidak ditemukan (${id})`);
        }
        try {
            console.log("DEBUG: Generating PDF for Tenure:", tenure.id);
            const buffer = await this.pdfService.generateSkKepala(tenure);
            console.log("DEBUG: PDF Generated successfully. Size:", buffer.length);
            const safeName = (tenure.teacher?.nama || 'Madrasah').replace(/[^a-zA-Z0-9]/g, '_');
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=SK_Kepala_${safeName}.pdf`,
                'Content-Length': buffer.length.toString(),
            });
            res.send(buffer);
        }
        catch (e) {
            console.error("PDF Fail:", e);
            res.status(500).json({ message: "Gagal generate PDF", error: e.message });
        }
    }
    async verifyPublic(id) {
        const result = await this.service.verifyPublic(id);
        if (!result)
            throw new NotFoundException('Data tidak ditemukan');
        return result;
    }
    verify(id) {
        return this.service.verify(id);
    }
    approve(id, body) {
        return this.service.approve(id, body?.signatureUrl, body?.skUrl);
    }
    reject(id, body) {
        return this.service.reject(id, body.reason);
    }
};
__decorate([
    Post(),
    __param(0, Body()),
    __param(1, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], HeadmasterController.prototype, "create", null);
__decorate([
    Get(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HeadmasterController.prototype, "findAll", null);
__decorate([
    Get('ping'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HeadmasterController.prototype, "ping", null);
__decorate([
    Get(':id/pdf'),
    __param(0, Param('id')),
    __param(1, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], HeadmasterController.prototype, "downloadPdf", null);
__decorate([
    Get(':id/public-verify'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HeadmasterController.prototype, "verifyPublic", null);
__decorate([
    Patch(':id/verify'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], HeadmasterController.prototype, "verify", null);
__decorate([
    Patch(':id/approve'),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], HeadmasterController.prototype, "approve", null);
__decorate([
    Patch(':id/reject'),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], HeadmasterController.prototype, "reject", null);
HeadmasterController = __decorate([
    Controller('headmaster'),
    UseGuards(JwtAuthGuard),
    __metadata("design:paramtypes", [typeof (_a = typeof HeadmasterService !== "undefined" && HeadmasterService) === "function" ? _a : Object, typeof (_b = typeof PdfService !== "undefined" && PdfService) === "function" ? _b : Object])
], HeadmasterController);
export { HeadmasterController };
//# sourceMappingURL=headmaster.controller.js.map