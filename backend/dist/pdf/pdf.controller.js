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
import { Controller, Post, Body, Res, Header } from '@nestjs/common';
import { PdfService } from './pdf.service';
let PdfController = class PdfController {
    pdfService;
    constructor(pdfService) {
        this.pdfService = pdfService;
    }
    async generateSk(data, res) {
        const doc = await this.pdfService.createPdfStream(data);
        doc.pipe(res);
    }
};
__decorate([
    Post('generate/sk'),
    Header('Content-Type', 'application/pdf'),
    Header('Content-Disposition', 'attachment; filename=surat_keputusan.pdf'),
    __param(0, Body()),
    __param(1, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PdfController.prototype, "generateSk", null);
PdfController = __decorate([
    Controller('pdf'),
    __metadata("design:paramtypes", [typeof (_a = typeof PdfService !== "undefined" && PdfService) === "function" ? _a : Object])
], PdfController);
export { PdfController };
//# sourceMappingURL=pdf.controller.js.map