import { StreamableFile } from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { ExcelService } from '../common/services/excel.service';
export declare class MasterDataController {
    private readonly masterDataService;
    private readonly excelService;
    constructor(masterDataService: MasterDataService, excelService: ExcelService);
    getSchools(): Promise<any>;
    createSchool(data: any): Promise<any>;
    getSchoolDetail(id: string): Promise<any>;
    getSchoolTeachers(id: string): Promise<any>;
    exportTeachers(unitKerja?: string, kecamatan?: string, isCertified?: string): Promise<StreamableFile>;
    exportSchools(): Promise<StreamableFile>;
    getTeachers(unitKerja?: string, kecamatan?: string, isCertified?: string, search?: string, status?: string, pdpkpnu?: string): Promise<any>;
    createTeacher(createTeacherDto: CreateTeacherDto): Promise<any>;
    importTeachers(file: Express.Multer.File): Promise<{
        success: boolean;
        imported: any;
        total: any;
        errors: any;
        message: string;
    }>;
    downloadTeacherTemplate(): Promise<StreamableFile>;
    exportStudents(schoolId?: string): Promise<StreamableFile>;
    downloadStudentTemplate(): Promise<StreamableFile>;
    importStudents(file: Express.Multer.File): Promise<{
        message: string;
        created: any;
        errors: any;
        total: any;
    }>;
    getStudents(schoolId?: string): Promise<any>;
    createStudent(data: any): Promise<any>;
    updateSchool(id: string, data: any): Promise<any>;
    updateTeacher(id: string, data: any): Promise<any>;
    deleteTeacher(id: string): Promise<any>;
    deleteTeachers(): Promise<any>;
    upsertTeachers(data: any[]): Promise<any>;
    importSchools(file: Express.Multer.File): Promise<any>;
    uploadFile(file: Express.Multer.File): Promise<any>;
}
