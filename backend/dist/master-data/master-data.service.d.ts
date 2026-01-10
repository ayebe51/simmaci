import { Repository } from 'typeorm';
import { School } from './entities/school.entity';
import { Teacher } from './entities/teacher.entity';
import { Student } from './entities/student.entity';
import { ExcelService } from '../common/services/excel.service';
export declare class MasterDataService {
    private schoolRepo;
    private teacherRepo;
    private studentRepo;
    private excelService;
    constructor(schoolRepo: Repository<School>, teacherRepo: Repository<Teacher>, studentRepo: Repository<Student>, excelService: ExcelService);
    private logDebug;
    findAllSchools(): Promise<School[]>;
    createSchool(data: any): Promise<any>;
    getSchoolById(id: string): Promise<any>;
    getTeachersBySchool(schoolId: string): Promise<{
        id: any;
        nip: any;
        nama: any;
        status: any;
        mapel: any;
        sertifikasi: any;
        isActive: any;
        phoneNumber: any;
        kecamatan: any;
    }[]>;
    upsertSchools(data: Partial<School>[]): Promise<any[]>;
    findAllTeachers(unitKerja?: string, kecamatan?: string, isCertified?: string, search?: string, status?: string, pdpkpnu?: string): Promise<{
        id: any;
        nuptk: any;
        nama: any;
        status: any;
        satminkal: any;
        mapel: any;
        pdpkpnu: any;
        isCertified: any;
        isActive: any;
        phoneNumber: any;
        gender: any;
        pendidikanTerakhir: any;
        tmt: any;
        kecamatan: any;
        birthPlace: any;
        birthDate: any;
    }[]>;
    createTeacher(data: any): Promise<any>;
    bulkCreateTeachers(teachersData: any[]): Promise<{
        success: Teacher[];
        errors: any[];
    }>;
    deleteTeacher(id: string): Promise<{
        success: boolean;
    }>;
    deleteAllTeachers(): Promise<{
        success: boolean;
        message: string;
    }>;
    uploadFile(file: Express.Multer.File): Promise<{
        url: string;
        filename: string;
    }>;
    upsertTeachers(data: Partial<Teacher>[]): Promise<Teacher[]>;
    findAllStudents(schoolId?: string): Promise<{
        id: any;
        nisn: any;
        nama: any;
        jk: any;
        kelas: any;
        sekolah: any;
    }[]>;
    createStudent(data: any): Promise<any>;
    upsertStudents(data: Partial<Student>[]): Promise<any[]>;
    updateSchool(id: string, data: Partial<School>): Promise<any>;
    updateTeacher(id: string, data: Partial<Teacher>): Promise<any>;
    importSchools(fileBuffer: Buffer): Promise<{
        success: boolean;
        count: number;
    }>;
    importTeachers(fileBuffer: Buffer): Promise<never[] | {
        success: boolean;
        count: number;
    }>;
    exportTeachers(unitKerja?: string, kecamatan?: string, isCertified?: string): Promise<any>;
    exportSchools(): Promise<any>;
    exportStudents(schoolId?: string): Promise<any>;
    bulkCreateStudents(studentsData: any[]): Promise<{
        success: Student[];
        errors: any[];
    }>;
}
