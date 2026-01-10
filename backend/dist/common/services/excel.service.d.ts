export declare class ExcelService {
    exportTeachers(teachers: any[]): Promise<Buffer>;
    importTeachers(file: Express.Multer.File): Promise<any[]>;
    generateTeacherTemplate(): Promise<Buffer>;
    exportSchools(schools: any[]): Promise<Buffer>;
    exportStudents(students: any[]): Promise<Buffer>;
    importStudents(file: Express.Multer.File): Promise<any[]>;
    generateStudentTemplate(): Promise<Buffer>;
    private sanitizeHtml;
    private sanitizeString;
}
