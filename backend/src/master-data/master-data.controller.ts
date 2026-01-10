import { Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException, StreamableFile, Header } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MasterDataService } from './master-data.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { ExcelService } from '../common/services/excel.service';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';  // SECURITY: Add auth guard

@Controller('master-data')
@UseGuards(JwtAuthGuard)  // SECURITY: Protect ALL master-data endpoints
export class MasterDataController {
  constructor(
    private readonly masterDataService: MasterDataService,
    private readonly excelService: ExcelService,
  ) {}

  @Get('schools')
  async getSchools() {
    return this.masterDataService.findAllSchools();
  }

  @Post('schools')
  async createSchool(@Body() data: any) {
    return this.masterDataService.createSchool(data);
  }

  @Get('schools/:id')
  async getSchoolDetail(@Param('id') id: string) {
    return this.masterDataService.getSchoolById(id);
  }

  @Get('schools/:id/teachers')
  async getSchoolTeachers(@Param('id') id: string) {
    return this.masterDataService.getTeachersBySchool(id);
  }

  @Get('teachers/export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename=Data_Guru.xlsx')
  async exportTeachers(
      @Query('unitKerja') unitKerja?: string,
      @Query('kecamatan') kecamatan?: string,
      @Query('isCertified') isCertified?: string
  ): Promise<StreamableFile> {
      const buffer = await this.masterDataService.exportTeachers(unitKerja, kecamatan, isCertified);
      return new StreamableFile(buffer);
  }

  @Get('schools/export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename=Data_Madrasah.xlsx')
  async exportSchools(): Promise<StreamableFile> {
      const buffer = await this.masterDataService.exportSchools();
      return new StreamableFile(buffer);
  }

  // Phase A: Enhanced search with multiple filters
  @Get('teachers')
  async getTeachers(
      @Query('unitKerja') unitKerja?: string,
      @Query('kecamatan') kecamatan?: string,
      @Query('isCertified') isCertified?: string,
      @Query('search') search?: string,
      @Query('status') status?: string,
      @Query('pdpkpnu') pdpkpnu?: string,
  ) {
    return this.masterDataService.findAllTeachers(
      unitKerja,
      kecamatan,
      isCertified,
      search,
      status,
      pdpkpnu,
    );
  }

  // Phase A: Updated with validation
  @Post('teachers')
  async createTeacher(@Body() createTeacherDto: CreateTeacherDto) {
    return this.masterDataService.createTeacher(createTeacherDto);
  }

  // Phase A: Excel Import endpoint with file validation
  @Post('teachers/import')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      // Only accept Excel files
      const allowedMimes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
      ];
      
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
      }
    },
  }))
  async importTeachers(@UploadedFile() file: Express.Multer.File) {
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
    } catch (error) {
      throw new BadRequestException(`Import failed: ${error.message}`);
    }
  }

  // Phase A: Download import template
  @Get('teachers/template')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename=Template_Import_Guru.xlsx')
  async downloadTeacherTemplate(): Promise<StreamableFile> {
    const buffer = await this.excelService.generateTeacherTemplate();
    return new StreamableFile(buffer);
  }


  // STUDENT ROUTES - Specific routes MUST come before generic routes!
  
  // Export endpoint (specific)
  @Get('students/export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename=Data_Siswa.xlsx')
  async exportStudents(@Query('schoolId') schoolId?: string): Promise<StreamableFile> {
    const buffer = await this.masterDataService.exportStudents(schoolId);
    return new StreamableFile(buffer);
  }

  // Template download (specific)
  @Get('students/template')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename=Template_Import_Siswa.xlsx')
  async downloadStudentTemplate(): Promise<StreamableFile> {
    const buffer = await this.excelService.generateStudentTemplate();
    return new StreamableFile(buffer);
  }

  // Import endpoint (specific) with file validation
  @Post('students/import')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      // Only accept Excel files
      const allowedMimes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
      ];
      
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
      }
    },
  }))
  async importStudents(@UploadedFile() file: Express.Multer.File) {
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
    } catch (error: any) {
      throw new BadRequestException(`Import failed: ${error.message}`);
    }
  }

  // Generic GET students (must be AFTER specific routes)
  @Get('students')
  async getStudents(@Query('schoolId') schoolId?: string) {
    return this.masterDataService.findAllStudents(schoolId);
  }

  // CREATE student
  @Post('students')
  async createStudent(@Body() data: any) {
    return this.masterDataService.createStudent(data);
  }

  @Put('schools/:id')
  async updateSchool(@Param('id') id: string, @Body() data: any) {
    return this.masterDataService.updateSchool(id, data);
  }

  @Put('teachers/:id')
  async updateTeacher(@Param('id') id: string, @Body() data: any) {
    return this.masterDataService.updateTeacher(id, data);
  }

  @Delete('teachers/:id')
  async deleteTeacher(@Param('id') id: string) {
      return this.masterDataService.deleteTeacher(id);
  }

  @Delete('teachers')
  async deleteTeachers() {
      return this.masterDataService.deleteAllTeachers();
  }

  @Post('teachers/upsert')
  async upsertTeachers(@Body() data: any[]) {
    return this.masterDataService.upsertTeachers(data);
  }

  @Post('schools/import')
  @UseInterceptors(FileInterceptor('file'))
  async importSchools(@UploadedFile() file: Express.Multer.File) {

    return this.masterDataService.importSchools(file.buffer);
  }


  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
      if (!file) throw new BadRequestException('No file uploaded');
      return this.masterDataService.uploadFile(file);
  }
}
