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
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { School } from '../master-data/entities/school.entity';
import { Student } from '../master-data/entities/student.entity';
import { Sk } from '../sk/entities/sk.entity';
import { Teacher } from '../master-data/entities/teacher.entity';
let DashboardService = class DashboardService {
    userRepo;
    schoolRepo;
    studentRepo;
    skRepo;
    teacherRepo;
    constructor(userRepo, schoolRepo, studentRepo, skRepo, teacherRepo) {
        this.userRepo = userRepo;
        this.schoolRepo = schoolRepo;
        this.studentRepo = studentRepo;
        this.skRepo = skRepo;
        this.teacherRepo = teacherRepo;
    }
    cache = new Map();
    getCacheKey(user) {
        return `dashboard_stats_${user.id}_${user.role}_${user.unitKerja || 'all'}`;
    }
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && cached.expires > Date.now()) {
            return cached.data;
        }
        if (cached) {
            this.cache.delete(key);
        }
        return null;
    }
    setCache(key, data, ttlSeconds = 300) {
        this.cache.set(key, {
            data,
            expires: Date.now() + ttlSeconds * 1000,
        });
    }
    clearCache() {
        this.cache.clear();
    }
    async getTeacherActivityStats(unitKerja) {
        const query = this.teacherRepo.createQueryBuilder('teacher');
        if (unitKerja) {
            query.where('teacher.satminkal = :unit', { unit: unitKerja });
        }
        const total = await query.getCount();
        const active = await query
            .clone()
            .andWhere('teacher.isActive = :active', { active: true })
            .getCount();
        return {
            total,
            active,
            inactive: total - active,
            activePercentage: total > 0 ? Math.round((active / total) * 100) : 0,
        };
    }
    async getCertificationStats(unitKerja) {
        const query = this.teacherRepo.createQueryBuilder('teacher');
        if (unitKerja) {
            query.where('teacher.satminkal = :unit', { unit: unitKerja });
        }
        const total = await query.getCount();
        const certified = await query
            .clone()
            .andWhere('teacher.isCertified = :cert', { cert: true })
            .getCount();
        return {
            total,
            certified,
            uncertified: total - certified,
            certificationRate: total > 0 ? Math.round((certified / total) * 100) : 0,
        };
    }
    async getSKStatusDistribution(user) {
        const query = this.skRepo.createQueryBuilder('sk');
        if (user.role !== 'super_admin' && user.unitKerja) {
            query.where('sk.unitKerja = :unit', { unit: user.unitKerja });
        }
        const statusGroups = await query
            .select('sk.status', 'status')
            .addSelect('COUNT(sk.id)', 'count')
            .groupBy('sk.status')
            .getRawMany();
        return statusGroups.map((s) => ({
            status: s.status || 'Unknown',
            count: typeof s.count === 'string' ? parseInt(s.count) : s.count,
        }));
    }
    async getMonthlyGrowthStats(user) {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const newTeachers = 0;
        let skQuery = this.skRepo
            .createQueryBuilder('sk')
            .where('sk.createdAt >= :startDate', { startDate: firstDayOfMonth });
        if (user.role !== 'super_admin' && user.unitKerja) {
            skQuery = skQuery.andWhere('sk.unitKerja = :unit', { unit: user.unitKerja });
        }
        const newSKSubmissions = await skQuery.getCount();
        return {
            month: now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
            newTeachers,
            newSKSubmissions,
        };
    }
    async getMonthlySKTrend(user) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        let query = this.skRepo
            .createQueryBuilder('sk')
            .where('sk.createdAt >= :startDate', { startDate: sixMonthsAgo });
        if (user.role !== 'super_admin' && user.unitKerja) {
            query = query.andWhere('sk.unitKerja = :unit', { unit: user.unitKerja });
        }
        const results = await query
            .select("strftime('%Y-%m', sk.createdAt)", 'month')
            .addSelect('COUNT(sk.id)', 'count')
            .groupBy('month')
            .orderBy('month', 'ASC')
            .getRawMany();
        return results.map((r) => ({
            month: r.month,
            count: typeof r.count === 'string' ? parseInt(r.count) : r.count,
        }));
    }
    async getKecamatanDistribution(user) {
        let query = this.teacherRepo.createQueryBuilder('teacher');
        if (user.role !== 'super_admin' && user.unitKerja) {
            query = query.where('teacher.satminkal = :unit', { unit: user.unitKerja });
        }
        const results = await query
            .select('teacher.kecamatan', 'kecamatan')
            .addSelect('COUNT(teacher.id)', 'count')
            .where('teacher.kecamatan IS NOT NULL')
            .groupBy('teacher.kecamatan')
            .orderBy('count', 'DESC')
            .limit(10)
            .getRawMany();
        return results.map((r) => ({
            kecamatan: r.kecamatan || 'Unknown',
            count: typeof r.count === 'string' ? parseInt(r.count) : r.count,
        }));
    }
    async getPDPKPNUProgress(unitKerja) {
        let query = this.teacherRepo.createQueryBuilder('teacher');
        if (unitKerja) {
            query = query.where('teacher.satminkal = :unit', { unit: unitKerja });
        }
        const total = await query.getCount();
        const sudah = await query
            .clone()
            .andWhere('teacher.pdpkpnu = :status', { status: 'Sudah' })
            .getCount();
        return {
            sudah,
            belum: total - sudah,
            total,
            percentage: total > 0 ? Math.round((sudah / total) * 100) : 0,
        };
    }
    async getStats(user) {
        const cacheKey = this.getCacheKey(user);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log(`[Cache HIT] Dashboard stats for user ${user.username}`);
            return cached;
        }
        console.log(`[Cache MISS] Computing dashboard stats for user ${user.username}`);
        const startTime = Date.now();
        const stats = await this.getStatsInternal(user);
        const duration = Date.now() - startTime;
        console.log(`Dashboard stats computed in ${duration}ms`);
        this.setCache(cacheKey, stats);
        return stats;
    }
    async getStatsInternal(user) {
        if (!user) {
            throw new Error("User context is missing in DashboardService");
        }
        const stats = {
            schoolCount: 0,
            teacherCount: 0,
            studentCount: 0,
            skCount: 0,
            charts: { status: [], units: [] }
        };
        try {
            try {
                if (user.role === 'super_admin') {
                    stats.schoolCount = await this.schoolRepo.count();
                }
                else if (user.unitKerja) {
                    stats.schoolCount = await this.schoolRepo.count({ where: { nama: user.unitKerja } });
                }
            }
            catch (e) {
                console.error("Error fetching school count:", e);
                stats.schoolCount = -1;
                stats.error = e.message;
            }
            try {
                if (user.role === 'super_admin') {
                    stats.teacherCount = await this.teacherRepo.count();
                }
                else if (user.unitKerja) {
                    stats.teacherCount = await this.teacherRepo.count({ where: { satminkal: user.unitKerja } });
                }
            }
            catch (e) {
                console.error("Error fetching teacher count:", e);
                stats.teacherCount = -1;
            }
            try {
                if (user.role === 'super_admin') {
                    stats.studentCount = await this.studentRepo.count();
                }
                else if (user.unitKerja) {
                    stats.studentCount = await this.studentRepo.count({ where: { schoolId: user.unitKerja } });
                }
            }
            catch (e) {
                console.error("Error fetching student count:", e);
                stats.studentCount = -1;
            }
            try {
                if (user.role === 'super_admin') {
                    stats.skCount = await this.skRepo.count({ where: { status: 'Pending' } });
                }
                else if (user.unitKerja) {
                    stats.skCount = await this.skRepo.count({ where: { unitKerja: user.unitKerja } });
                }
                else {
                    stats.skCount = await this.skRepo.count({ where: { userId: user.id } });
                }
            }
            catch (e) {
                console.error("Error fetching sk count:", e);
                stats.skCount = -1;
            }
            try {
                const statusDistribution = await this.teacherRepo
                    .createQueryBuilder('teacher')
                    .select('teacher.status', 'status')
                    .addSelect('COUNT(teacher.id)', 'count')
                    .where('teacher.status IN (:...allowedStatuses)', {
                    allowedStatuses: ['PNS', 'Sertifikasi', 'Honorer']
                })
                    .groupBy('teacher.status')
                    .getRawMany();
                stats.charts.status = statusDistribution.map(s => ({
                    name: s.status || 'Lainnya',
                    value: typeof s.count === 'string' ? parseInt(s.count) : s.count
                }));
            }
            catch (e) {
                console.error("Error fetching status charts:", e);
            }
            try {
                let unitQuery = this.teacherRepo
                    .createQueryBuilder('teacher')
                    .select('teacher.satminkal', 'unit')
                    .addSelect('COUNT(teacher.id)', 'count')
                    .groupBy('teacher.satminkal')
                    .orderBy('count', 'DESC')
                    .limit(5);
                if (user.role !== 'super_admin' && user.unitKerja) {
                    unitQuery = unitQuery.where('teacher.satminkal = :unit', { unit: user.unitKerja });
                }
                const unitDistribution = await unitQuery.getRawMany();
                stats.charts.units = unitDistribution.map(u => ({
                    name: u.unit || 'Tanpa Unit',
                    jumlah: typeof u.count === 'string' ? parseInt(u.count) : u.count
                }));
                console.log("DEBUG: Dashboard stats calculated successfully", stats);
            }
            catch (e) {
                console.error("Error fetching unit charts:", e);
            }
            let recentActivities = [];
            try {
                let activityQuery = this.skRepo.createQueryBuilder('sk')
                    .leftJoinAndSelect('sk.user', 'user')
                    .orderBy('sk.createdAt', 'DESC')
                    .take(5);
                if (user.role !== 'super_admin' && user.unitKerja) {
                    activityQuery = activityQuery.where('sk.unitKerja = :unit', { unit: user.unitKerja });
                }
                else if (user.role !== 'super_admin' && !user.unitKerja) {
                    activityQuery = activityQuery.where('sk.userId = :uid', { uid: user.id });
                }
                const recents = await activityQuery.getMany();
                recentActivities = recents.map(sk => ({
                    id: sk.id,
                    description: `Pengajuan SK ${sk.jenis} (${sk.jenisPengajuan === 'new' ? 'Baru' : 'Perpanjangan'})`,
                    user: sk.user ? sk.user.username : (sk.nama || 'User'),
                    time: sk.createdAt
                }));
            }
            catch (e) {
                console.error("Error fetching recent activities:", e);
            }
            return {
                ...stats,
                ...(await this.getEnhancedStatsParallel(user)),
                recentActivities,
                debugUser: {
                    username: user.username,
                    role: user.role,
                    unit: user.unitKerja || 'NULL'
                }
            };
        }
        catch (e) {
            console.error("CRITICAL DASHBOARD ERROR (Main Catch):", e);
            throw e;
        }
    }
    async getEnhancedStatsParallel(user) {
        const [teacherActivity, certificationStats, skStatusDistribution, monthlyGrowth, monthlyTrend, kecamatanDistribution, pdpkpnuProgress,] = await Promise.all([
            this.getTeacherActivityStats(user.role !== 'super_admin' ? user.unitKerja : undefined),
            this.getCertificationStats(user.role !== 'super_admin' ? user.unitKerja : undefined),
            this.getSKStatusDistribution(user),
            this.getMonthlyGrowthStats(user),
            this.getMonthlySKTrend(user),
            this.getKecamatanDistribution(user),
            this.getPDPKPNUProgress(user.role !== 'super_admin' ? user.unitKerja : undefined),
        ]);
        return {
            teacherActivity,
            certificationStats,
            skStatusDistribution,
            monthlyGrowth,
            monthlyTrend,
            kecamatanDistribution,
            pdpkpnuProgress,
        };
    }
};
DashboardService = __decorate([
    Injectable(),
    __param(0, InjectRepository(User)),
    __param(1, InjectRepository(School)),
    __param(2, InjectRepository(Student)),
    __param(3, InjectRepository(Sk)),
    __param(4, InjectRepository(Teacher)),
    __metadata("design:paramtypes", [Repository,
        Repository,
        Repository,
        Repository,
        Repository])
], DashboardService);
export { DashboardService };
//# sourceMappingURL=dashboard.service.js.map