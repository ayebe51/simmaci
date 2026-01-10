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
var _a, _b, _c, _d, _e, _f;
import { Controller, Get, Post, Body, Patch, Param, Delete, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as express from 'express';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto } from './dto/create-event.dto';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { RegisterParticipantDto } from './dto/register-participant.dto';
import { InputResultDto } from './dto/input-result.dto';
let EventsController = class EventsController {
    eventsService;
    constructor(eventsService) {
        this.eventsService = eventsService;
    }
    create(createEventDto) {
        return this.eventsService.create(createEventDto);
    }
    findAll() {
        return this.eventsService.findAll();
    }
    findOne(id) {
        return this.eventsService.findOne(id);
    }
    update(id, updateEventDto) {
        return this.eventsService.update(id, updateEventDto);
    }
    remove(id) {
        return this.eventsService.remove(id);
    }
    createCompetition(id, createCompetitionDto) {
        return this.eventsService.createCompetition(id, createCompetitionDto);
    }
    findCompetition(id) {
        return this.eventsService.findCompetition(id);
    }
    removeCompetition(id) {
        return this.eventsService.removeCompetition(id);
    }
    registerParticipant(id, dto) {
        return this.eventsService.registerParticipant(id, dto);
    }
    removeParticipant(participantId) {
        return this.eventsService.removeParticipant(participantId);
    }
    inputResult(id, dto) {
        return this.eventsService.inputResult(id, dto);
    }
    getMedalTally(id) {
        return this.eventsService.getMedalTally(id);
    }
    async uploadTemplate(id, file) {
        return this.eventsService.uploadTemplate(id, file.path);
    }
    async importResults(id, file) {
        if (!file)
            throw new Error('File not provided');
        return this.eventsService.importResults(id, file.buffer);
    }
    async downloadCertificate(competitionId, participantId, res) {
        const stream = await this.eventsService.generateCertificate(competitionId, participantId);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="sertifikat-${participantId}.pdf"`,
        });
        stream.pipe(res);
    }
};
__decorate([
    Post(),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_b = typeof CreateEventDto !== "undefined" && CreateEventDto) === "function" ? _b : Object]),
    __metadata("design:returntype", void 0)
], EventsController.prototype, "create", null);
__decorate([
    Get(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EventsController.prototype, "findAll", null);
__decorate([
    Get(':id'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EventsController.prototype, "findOne", null);
__decorate([
    Patch(':id'),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_c = typeof UpdateEventDto !== "undefined" && UpdateEventDto) === "function" ? _c : Object]),
    __metadata("design:returntype", void 0)
], EventsController.prototype, "update", null);
__decorate([
    Delete(':id'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EventsController.prototype, "remove", null);
__decorate([
    Post(':id/competitions'),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_d = typeof CreateCompetitionDto !== "undefined" && CreateCompetitionDto) === "function" ? _d : Object]),
    __metadata("design:returntype", void 0)
], EventsController.prototype, "createCompetition", null);
__decorate([
    Get('competitions/:id'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EventsController.prototype, "findCompetition", null);
__decorate([
    Delete('competitions/:id'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EventsController.prototype, "removeCompetition", null);
__decorate([
    Post('competitions/:id/participants'),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_e = typeof RegisterParticipantDto !== "undefined" && RegisterParticipantDto) === "function" ? _e : Object]),
    __metadata("design:returntype", void 0)
], EventsController.prototype, "registerParticipant", null);
__decorate([
    Delete('participants/:participantId'),
    __param(0, Param('participantId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EventsController.prototype, "removeParticipant", null);
__decorate([
    Post('competitions/:id/results'),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_f = typeof InputResultDto !== "undefined" && InputResultDto) === "function" ? _f : Object]),
    __metadata("design:returntype", void 0)
], EventsController.prototype, "inputResult", null);
__decorate([
    Get(':id/tally'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EventsController.prototype, "getMedalTally", null);
__decorate([
    Post('/competitions/:id/template'),
    UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads/templates',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                return cb(null, `${randomName}${extname(file.originalname)}`);
            }
        })
    })),
    __param(0, Param('id')),
    __param(1, UploadedFile()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "uploadTemplate", null);
__decorate([
    Post('/competitions/:id/results/import'),
    UseInterceptors(FileInterceptor('file')),
    __param(0, Param('id')),
    __param(1, UploadedFile()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "importResults", null);
__decorate([
    Get('competitions/:id/certificates/:participantId'),
    __param(0, Param('id')),
    __param(1, Param('participantId')),
    __param(2, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "downloadCertificate", null);
EventsController = __decorate([
    Controller('events'),
    __metadata("design:paramtypes", [typeof (_a = typeof EventsService !== "undefined" && EventsService) === "function" ? _a : Object])
], EventsController);
export { EventsController };
//# sourceMappingURL=events.controller.js.map