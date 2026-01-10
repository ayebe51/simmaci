import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { School } from '../master-data/entities/school.entity';
import { Student } from '../master-data/entities/student.entity';
import { Sk } from '../sk/entities/sk.entity';
import { Teacher } from '../master-data/entities/teacher.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(School) private schoolRepo: Repository<School>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Sk) private skRepo: Repository<Sk>,
    @InjectRepository(Teacher) private teacherRepo: Repository<Teacher>,
  ) {}

  // Phase 3: Performance Optimization - Caching
  private cache = new Map<string, { data: any; expires: number }>();

  private getCacheKey(user: User): string {
    return `dashboard_stats_${user.id}_${user.role}_${user.unitKerja || 'all'}`;
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    // Remove expired entry
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCache(key: string, data: any, ttlSeconds = 300): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Clear dashboard cache (call when data changes)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get active vs inactive teacher statistics
   */
  async getTeacherActivityStats(unitKerja?: string) {
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

  /**
   * Get teacher certification statistics
   */
  async getCertificationStats(unitKerja?: string) {
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

  /**
   * Get SK status distribution
   */
  async getSKStatusDistribution(user: User) {
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

  /**
   * Get monthly growth statistics (new teachers & SKs this month)
   */
  async getMonthlyGrowthStats(user: User) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Count new teachers - note: Teacher entity doesn't have createdAt yet
    // We'll add it in next step, for now return 0
    const newTeachers = 0;
    
    // New SK submissions this month
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

  /**
   * Get monthly SK submission trend (last 6 months)
   * For line chart visualization
   */
  async getMonthlySKTrend(user: User) {
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

  /**
   * Get teacher distribution by kecamatan
   * For bar chart visualization (top 10)
   */
  async getKecamatanDistribution(user: User) {
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

  /**
   * Get PDPKPNU completion progress
   * Shows ratio of teachers who completed PDPKPNU training
   */
  async getPDPKPNUProgress(unitKerja?: string) {
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

  async getStats(user: User) {
    // Phase 3: Check cache first
    const cacheKey = this.getCacheKey(user);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[Cache HIT] Dashboard stats for user ${user.username}`);
      return cached;
    }

    console.log(`[Cache MISS] Computing dashboard stats for user ${user.username}`);
    const startTime = Date.now();

    // Compute stats
    const stats = await this.getStatsInternal(user);

    // Cache result
    const duration = Date.now() - startTime;
    console.log(`Dashboard stats computed in ${duration}ms`);
    this.setCache(cacheKey, stats);

    return stats;
  }

  private async getStatsInternal(user: User) {
    if (!user) {
        throw new Error("User context is missing in DashboardService");
    }
    const stats = {
        schoolCount: 0,
        teacherCount: 0,
        studentCount: 0,
        skCount: 0,
        charts: { status: [] as {name: string, value: number}[], units: [] as {name: string, jumlah: number}[] }
    };

    try {
        // 1. Schools Count
        try {
            if (user.role === 'super_admin') {
                stats.schoolCount = await this.schoolRepo.count();
            } else if (user.unitKerja) {
                stats.schoolCount = await this.schoolRepo.count({ where: { nama: user.unitKerja } });
            }
        } catch (e: any) {
            console.error("Error fetching school count:", e);
            stats.schoolCount = -1; // Indicate error
            (stats as any).error = e.message; // Inject error for frontend debug
        }

        // 2. Teachers Count
        try {
            if (user.role === 'super_admin') {
                stats.teacherCount = await this.teacherRepo.count();
            } else if (user.unitKerja) {
                stats.teacherCount = await this.teacherRepo.count({ where: { satminkal: user.unitKerja } });
            }
        } catch (e) {
            console.error("Error fetching teacher count:", e);
            stats.teacherCount = -1;
        }

        // 3. Students Count
        try {
            if (user.role === 'super_admin') {
                stats.studentCount = await this.studentRepo.count();
            } else if (user.unitKerja) {
                stats.studentCount = await this.studentRepo.count({ where: { schoolId: user.unitKerja } });
            }
        } catch (e) {
            console.error("Error fetching student count:", e);
            stats.studentCount = -1;
        }

        // 4. SK Count
        try {
            if (user.role === 'super_admin') {
                stats.skCount = await this.skRepo.count({ where: { status: 'Pending' } });
            } else if (user.unitKerja) {
                stats.skCount = await this.skRepo.count({ where: { unitKerja: user.unitKerja } });
            } else {
                stats.skCount = await this.skRepo.count({ where: { userId: user.id } });
            }
        } catch (e) {
             console.error("Error fetching sk count:", e);
             stats.skCount = -1;
        }

        // 5. Chart Data: Teacher Status Distribution (Filter: PNS, Sertifikasi, Honorer only)
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
        } catch (e) {
            console.error("Error fetching status charts:", e);
        }

        // 6. Chart Data: Teacher Unit Kerja Distribution (Top 5)
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
        } catch (e) {
            console.error("Error fetching unit charts:", e);
        }

        // 7. Recent Activities (Top 5 Latest SKs)
        let recentActivities = [] as any[];
        try {
             let activityQuery = this.skRepo.createQueryBuilder('sk')
                .leftJoinAndSelect('sk.user', 'user')
                .orderBy('sk.createdAt', 'DESC')
                .take(5);
            
            if (user.role !== 'super_admin' && user.unitKerja) {
                activityQuery = activityQuery.where('sk.unitKerja = :unit', { unit: user.unitKerja });
            } else if (user.role !== 'super_admin' && !user.unitKerja) {
                // If regular user with no unit? (Should not happen for operator, but maybe for individual)
                activityQuery = activityQuery.where('sk.userId = :uid', { uid: user.id });
            }

            const recents = await activityQuery.getMany();
            recentActivities = recents.map(sk => ({
                id: sk.id,
                description: `Pengajuan SK ${sk.jenis} (${sk.jenisPengajuan === 'new' ? 'Baru' : 'Perpanjangan'})`,
                user: sk.user ? sk.user.username : (sk.nama || 'User'),
                time: sk.createdAt
            }));

        } catch (e) {
            console.error("Error fetching recent activities:", e);
        }

        return {
            ...stats,
            // Phase 3: Parallel execution of enhanced statistics
            ...(await this.getEnhancedStatsParallel(user)),
            recentActivities,
            debugUser: {
                username: user.username,
                role: user.role,
                unit: user.unitKerja || 'NULL'
            }
        };
    } catch (e) {
        console.error("CRITICAL DASHBOARD ERROR (Main Catch):", e);
        throw e;
    }
  }

  /**
   * Phase 3: Parallel execution of enhanced statistics methods
   */
  private async getEnhancedStatsParallel(user: User) {
    const [
      teacherActivity,
      certificationStats,
      skStatusDistribution,
      monthlyGrowth,
      monthlyTrend,
      kecamatanDistribution,
      pdpkpnuProgress,
    ] = await Promise.all([
      this.getTeacherActivityStats(
        user.role !== 'super_admin' ? user.unitKerja : undefined,
      ),
      this.getCertificationStats(
        user.role !== 'super_admin' ? user.unitKerja : undefined,
      ),
      this.getSKStatusDistribution(user),
      this.getMonthlyGrowthStats(user),
      this.getMonthlySKTrend(user),
      this.getKecamatanDistribution(user),
      this.getPDPKPNUProgress(
        user.role !== 'super_admin' ? user.unitKerja : undefined,
      ),
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
}
