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
var _a, _b, _c;
import { Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException, StreamableFile, Header } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MasterDataService } from './master-data.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { ExcelService } from '../common/services/excel.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
let MasterDataController = class MasterDataController {
    masterDataService;
    excelService;
    constructor(masterDataService, excelService) {
        this.masterDataService = masterDataService;
        this.excelService = excelService;
    }
    async getSchools() {
        return this.masterDataService.findAllSchools();
    }
    async createSchool(data) {
        return this.masterDataService.createSchool(data);
    }
    async getSchoolDetail(id) {
        return this.masterDataService.getSchoolById(id);
    }
    async getSchoolTeachers(id) {
        return this.masterDataService.getTeachersBySchool(id);
    }
    async exportTeachers(unitKerja, kecamatan, isCertified) {
        const buffer = await this.masterDataService.exportTeachers(unitKerja, kecamatan, isCertified);
        return new StreamableFile(buffer);
    }
    async exportSchools() {
        const buffer = await this.masterDataService.exportSchools();
        return new StreamableFile(buffer);
    }
    async getTeachers(unitKerja, kecamatan, isCertified, search, status, pdpkpnu) {
        return this.masterDataService.findAllTeachers(unitKerja, kecamatan, isCertified, search, status, pdpkpnu);
    }
    async createTeacher(createTeacherDto) {
        return this.masterDataService.createTeacher(createTeacherDto);
    }
    async importTeachers(file) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        try {
            const teachers = await this.excelService.importTeachers(file);
            const results = await this.masterDataService.bulkCreateTeachers(teachers);
            return {
                success: true,
                imported: results.success.length,
                total: teachers.length,
                errors: results.errors,
                message: `Successfully imported ${results.success.length} of ${teachers.length} teachers`,
            };
        }
        catch (error) {
            throw new BadRequestException(`Import failed: ${error.message}`);
        }
    }
    async downloadTeacherTemplate() {
        const buffer = await this.excelService.generateTeacherTemplate();
        return new StreamableFile(buffer);
    }
    async exportStudents(schoolId) {
        const buffer = await this.masterDataService.exportStudents(schoolId);
        return new StreamableFile(buffer);
    }
    async downloadStudentTemplate() {
        const buffer = await this.excelService.generateStudentTemplate();
        return new StreamableFile(buffer);
    }
    async importStudents(file) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        try {
            const students = await this.excelService.importStudents(file);
            const result = await this.masterDataService.bulkCreateStudents(students);
            return {
                message: `Successfully imported ${result.success.length} of ${students.length} students`,
                created: result.success.length,
                errors: result.errors,
                total: students.length
            };
        }
        catch (error) {
            throw new BadRequestException(`Import failed: ${error.message}`);
        }
    }
    async getStudents(schoolId) {
        return this.masterDataService.findAllStudents(schoolId);
    }
    async createStudent(data) {
        return this.masterDataService.createStudent(data);
    }
    async updateSchool(id, data) {
        return this.masterDataService.updateSchool(id, data);
    }
    async updateTeacher(id, data) {
        return this.masterDataService.updateTeacher(id, data);
    }
    async deleteTeacher(id) {
        return this.masterDataService.deleteTeacher(id);
    }
    async deleteTeachers() {
        return this.masterDataService.deleteAllTeachers();
    }
    async upsertTeachers(data) {
        return this.masterDataService.upsertTeachers(data);
    }
    async importSchools(file) {
        return this.masterDataService.importSchools(file.buffer);
    }
    async uploadFile(file) {
        if (!file)
            throw new BadRequestException('No file uploaded');
        return this.masterDataService.uploadFile(file);
    }
};
__decorate([
    Get('schools'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "getSchools", null);
__decorate([
    Post('schools'),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "createSchool", null);
__decorate([
    Get('schools/:id'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "getSchoolDetail", null);
__decorate([
    Get('schools/:id/teachers'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "getSchoolTeachers", null);
__decorate([
    Get('teachers/export'),
    Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    Header('Content-Disposition', 'attachment; filename=Data_Guru.xlsx'),
    __param(0, Query('unitKerja')),
    __param(1, Query('kecamatan')),
    __param(2, Query('isCertified')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "exportTeachers", null);
__decorate([
    Get('schools/export'),
    Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    Header('Content-Disposition', 'attachment; filename=Data_Madrasah.xlsx'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "exportSchools", null);
__decorate([
    Get('teachers'),
    __param(0, Query('unitKerja')),
    __param(1, Query('kecamatan')),
    __param(2, Query('isCertified')),
    __param(3, Query('search')),
    __param(4, Query('status')),
    __param(5, Query('pdpkpnu')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "getTeachers", null);
__decorate([
    Post('teachers'),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_c = typeof CreateTeacherDto !== "undefined" && CreateTeacherDto) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "createTeacher", null);
__decorate([
    Post('teachers/import'),
    UseInterceptors(FileInterceptor('file', {
        limits: {
            fileSize: 5 * 1024 * 1024,
        },
        fileFilter: (req, file, cb) => {
            const allowedMimes = [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
            ];
            if (allowedMimes.includes(file.mimetype)) {
                cb(null, true);
            }
            else {
                cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
            }
        },
    })),
    __param(0, UploadedFile()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "importTeachers", null);
__decorate([
    Get('teachers/template'),
    Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    Header('Content-Disposition', 'attachment; filename=Template_Import_Guru.xlsx'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "downloadTeacherTemplate", null);
__decorate([
    Get('students/export'),
    Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    Header('Content-Disposition', 'attachment; filename=Data_Siswa.xlsx'),
    __param(0, Query('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "exportStudents", null);
__decorate([
    Get('students/template'),
    Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    Header('Content-Disposition', 'attachment; filename=Template_Import_Siswa.xlsx'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "downloadStudentTemplate", null);
__decorate([
    Post('students/import'),
    UseInterceptors(FileInterceptor('file', {
        limits: {
            fileSize: 5 * 1024 * 1024,
        },
        fileFilter: (req, file, cb) => {
            const allowedMimes = [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
            ];
            if (allowedMimes.includes(file.mimetype)) {
                cb(null, true);
            }
            else {
                cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
            }
        },
    })),
    __param(0, UploadedFile()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "importStudents", null);
__decorate([
    Get('students'),
    __param(0, Query('schoolId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "getStudents", null);
__decorate([
    Post('students'),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "createStudent", null);
__decorate([
    Put('schools/:id'),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "updateSchool", null);
__decorate([
    Put('teachers/:id'),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "updateTeacher", null);
__decorate([
    Delete('teachers/:id'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "deleteTeacher", null);
__decorate([
    Delete('teachers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "deleteTeachers", null);
__decorate([
    Post('teachers/upsert'),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "upsertTeachers", null);
__decorate([
    Post('schools/import'),
    UseInterceptors(FileInterceptor('file')),
    __param(0, UploadedFile()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "importSchools", null);
__decorate([
    Post('upload'),
    UseInterceptors(FileInterceptor('file')),
    __param(0, UploadedFile()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MasterDataController.prototype, "uploadFile", null);
MasterDataController = __decorate([
    Controller('master-data'),
    UseGuards(JwtAuthGuard),
    __metadata("design:paramtypes", [typeof (_a = typeof MasterDataService !== "undefined" && MasterDataService) === "function" ? _a : Object, typeof (_b = typeof ExcelService !== "undefined" && ExcelService) === "function" ? _b : Object])
], MasterDataController);
export { MasterDataController };
//# sourceMappingURL=master-data.controller.js.map