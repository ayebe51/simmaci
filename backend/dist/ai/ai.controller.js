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
import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RagService } from './services/rag.service';
class AiQueryDto {
    question;
}
__decorate([
    IsString(),
    __metadata("design:type", String)
], AiQueryDto.prototype, "question", void 0);
let AiController = class AiController {
    ragService;
    constructor(ragService) {
        this.ragService = ragService;
    }
    async naturalLanguageQuery(dto) {
        return this.ragService.query(dto.question);
    }
    getSuggestedQuestions() {
        return {
            questions: [
                'Berapa jumlah guru yang belum sertifikasi?',
                'Tampilkan SK yang menunggu approval',
                'Siapa kepala madrasah yang masa jabatannya akan habis tahun ini?',
                'Berapa guru honorer di setiap kecamatan?',
                'SK apa saja yang diajukan bulan ini?',
            ],
        };
    }
};
__decorate([
    Post('query'),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AiQueryDto]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "naturalLanguageQuery", null);
__decorate([
    Get('suggested-questions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AiController.prototype, "getSuggestedQuestions", null);
AiController = __decorate([
    Controller('ai'),
    UseGuards(JwtAuthGuard),
    __metadata("design:paramtypes", [typeof (_a = typeof RagService !== "undefined" && RagService) === "function" ? _a : Object])
], AiController);
export { AiController };
//# sourceMappingURL=ai.controller.js.map