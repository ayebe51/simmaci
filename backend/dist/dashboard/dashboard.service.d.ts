import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { School } from '../master-data/entities/school.entity';
import { Student } from '../master-data/entities/student.entity';
import { Sk } from '../sk/entities/sk.entity';
import { Teacher } from '../master-data/entities/teacher.entity';
export declare class DashboardService {
    private userRepo;
    private schoolRepo;
    private studentRepo;
    private skRepo;
    private teacherRepo;
    constructor(userRepo: Repository<User>, schoolRepo: Repository<School>, studentRepo: Repository<Student>, skRepo: Repository<Sk>, teacherRepo: Repository<Teacher>);
    private cache;
    private getCacheKey;
    private getFromCache;
    private setCache;
    clearCache(): void;
    getTeacherActivityStats(unitKerja?: string): Promise<{
        total: number;
        active: number;
        inactive: number;
        activePercentage: number;
    }>;
    getCertificationStats(unitKerja?: string): Promise<{
        total: number;
        certified: number;
        uncertified: number;
        certificationRate: number;
    }>;
    getSKStatusDistribution(user: User): Promise<{
        status: any;
        count: any;
    }[]>;
    getMonthlyGrowthStats(user: User): Promise<{
        month: string;
        newTeachers: number;
        newSKSubmissions: number;
    }>;
    getMonthlySKTrend(user: User): Promise<{
        month: any;
        count: any;
    }[]>;
    getKecamatanDistribution(user: User): Promise<{
        kecamatan: any;
        count: any;
    }[]>;
    getPDPKPNUProgress(unitKerja?: string): Promise<{
        sudah: number;
        belum: number;
        total: number;
        percentage: number;
    }>;
    getStats(user: User): Promise<any>;
    private getStatsInternal;
    private getEnhancedStatsParallel;
}
