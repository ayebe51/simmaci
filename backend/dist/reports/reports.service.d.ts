import { Repository } from 'typeorm';
import { Teacher } from '../master-data/entities/teacher.entity';
import { Sk } from '../sk/entities/sk.entity';
export declare class ReportsService {
    private teacherRepo;
    private skRepo;
    constructor(teacherRepo: Repository<Teacher>, skRepo: Repository<Sk>);
    getTeacherSummary(unitKerja?: string, kecamatan?: string): Promise<{
        total: number;
        byStatus: Teacher;
        byCertification: {
            certified: number;
            uncertified: number;
        };
        byPDPKPNU: {
            sudah: number;
            belum: number;
        };
        byKecamatan: Teacher;
    }>;
    getSKSummary(unitKerja?: string, startDate?: string, endDate?: string): Promise<{
        total: number;
        byStatus: Sk;
        byType: Sk;
        period: {
            from: string;
            to: string;
        };
    }>;
    getMonthlyStats(year?: string): Promise<{
        year: string;
        monthlyData: {
            month: number;
            monthName: string;
            count: number;
            approved: number;
            pending: number;
            rejected: number;
        }[];
        total: number;
    }>;
}
