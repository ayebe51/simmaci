import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teacher } from '../master-data/entities/teacher.entity';
import { Sk } from '../sk/entities/sk.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Teacher)
    private teacherRepo: Repository<Teacher>,
    @InjectRepository(Sk)
    private skRepo: Repository<Sk>,
  ) {}

  async getTeacherSummary(unitKerja?: string, kecamatan?: string) {
    const query = this.teacherRepo.createQueryBuilder('teacher');

    if (unitKerja) {
      query.where('teacher.satminkal = :unitKerja', { unitKerja });
    }
    if (kecamatan) {
      query.andWhere('teacher.kecamatan = :kecamatan', { kecamatan });
    }

    const teachers = await query.getMany();
    const total = teachers.length;

    // Group by status
    const byStatus = teachers.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by certification
    const certified = teachers.filter(t => t.isCertified).length;
    const uncertified = total - certified;

    // Group by PDPKPNU
    const pdpkpnuSudah = teachers.filter(t => t.pdpkpnu === 'Sudah').length;
    const pdpkpnuBelum = total - pdpkpnuSudah;

    // Group by kecamatan
    const byKecamatan = teachers.reduce((acc, t) => {
      const kec = t.kecamatan || 'Tidak Diketahui';
      acc[kec] = (acc[kec] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      byStatus,
      byCertification: {
        certified,
        uncertified,
      },
      byPDPKPNU: {
        sudah: pdpkpnuSudah,
        belum: pdpkpnuBelum,
      },
      byKecamatan,
    };
  }

  async getSKSummary(unitKerja?: string, startDate?: string, endDate?: string) {
    const query = this.skRepo.createQueryBuilder('sk');

    if (unitKerja) {
      query.where('sk.unitKerja = :unitKerja', { unitKerja });
    }

    if (startDate) {
      query.andWhere('sk.createdAt >= :startDate', {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      query.andWhere('sk.createdAt <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    const sks = await query.getMany();
    const total = sks.length;

    // Group by status
    const byStatus = sks.reduce((acc, sk) => {
      acc[sk.status] = (acc[sk.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by type
    const byType = sks.reduce((acc, sk) => {
      acc[sk.jenis] = (acc[sk.jenis] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      byStatus,
      byType,
      period: {
        from: startDate || 'all',
        to: endDate || 'now',
      },
    };
  }

  async getMonthlyStats(year?: string) {
    const targetYear = year || new Date().getFullYear().toString();
    const startDate = new Date(`${targetYear}-01-01`);
    const endDate = new Date(`${targetYear}-12-31`);

    const sks = await this.skRepo
      .createQueryBuilder('sk')
      .where('sk.createdAt >= :startDate', { startDate })
      .andWhere('sk.createdAt <= :endDate', { endDate })
      .getMany();

    // Group by month
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(2024, i).toLocaleString('id-ID', { month: 'long' }),
      count: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    }));

    sks.forEach(sk => {
      const month = new Date(sk.createdAt).getMonth();
      monthlyData[month].count++;
      
      if (sk.status === 'Approved') monthlyData[month].approved++;
      else if (sk.status === 'Pending') monthlyData[month].pending++;
      else if (sk.status === 'Rejected') monthlyData[month].rejected++;
    });

    return {
      year: targetYear,
      monthlyData,
      total: sks.length,
    };
  }
}
