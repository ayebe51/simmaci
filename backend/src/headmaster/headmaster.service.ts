import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HeadmasterTenure, HeadmasterStatus } from './entities/headmaster-tenure.entity';
import { User } from '../users/entities/user.entity';
import { Teacher } from '../master-data/entities/teacher.entity';

@Injectable()
export class HeadmasterService {
  constructor(
    @InjectRepository(HeadmasterTenure)
    private repo: Repository<HeadmasterTenure>,
    @InjectRepository(Teacher)
    private teacherRepo: Repository<Teacher>,
  ) {}

  async create(data: Partial<HeadmasterTenure>, _user: User) {
    // Basic validation
    if (!data.periode || data.periode > 3) {
      throw new BadRequestException('Maksimal menjabat adalah 3 periode.');
    }

    if (!data.teacherId) throw new BadRequestException('Guru wajib dipilih.');

    // Check for double jabatan
    const existingActive = await this.repo.findOne({
      where: {
        teacherId: data.teacherId,
        status: HeadmasterStatus.ACTIVE,
      },
    });

    if (existingActive) {
      throw new BadRequestException(
        'Guru ini masih menjabat aktif sebagai kepala madrasah di tempat lain/periode berjalan.',
      );
    }

    // Auto calculate End Date (4 years)
    if (!data.tmt) throw new BadRequestException('TMT wajib diisi.');

    const tmt = new Date(data.tmt);
    const endDate = new Date(tmt);
    endDate.setFullYear(tmt.getFullYear() + 4);

    const tenure = this.repo.create({
      ...data,
      endDate,
      status: HeadmasterStatus.SUBMITTED, // Default to SUBMITTED for review
    });

    return this.repo.save(tenure);
  }

  async findAll() {
    return this.repo.find({
      order: { createdAt: 'DESC' },
      relations: ['teacher', 'school'],
    });
  }

  async findOne(id: string) {
    return this.repo.findOne({
      where: { id },
      relations: ['teacher', 'school'],
    });
  }

  async verify(id: string) {
    await this.repo.update(id, { status: HeadmasterStatus.VERIFIED });
    return this.repo.findOneBy({ id });
  }

  async approve(id: string, signatureUrl?: string, skUrl?: string) {
    // This is for Yayasan Chairman
    const updateData: Partial<HeadmasterTenure> = { status: HeadmasterStatus.APPROVED };
    if (signatureUrl) updateData.digitalSignatureUrl = signatureUrl;
    if (skUrl) updateData.skUrl = skUrl;

    await this.repo.update(id, updateData);

    // Automatis Update Jabatan Guru
    const tenure = await this.repo.findOne({
      where: { id },
      relations: ['teacher'],
    });

    if (tenure && tenure.teacher) {
      tenure.teacher.jabatan = 'Kepala Madrasah';
      await this.teacherRepo.save(tenure.teacher);
    }

    return tenure;
  }

  async reject(id: string, reason: string) {
    await this.repo.update(id, {
      status: HeadmasterStatus.REJECTED,
      keterangan: reason,
    });
    return this.repo.findOneBy({ id });
  }

  async verifyPublic(id: string) {
    const tenure = await this.repo.findOne({
      where: { id },
      relations: ['teacher', 'school'],
      select: {
        id: true,
        status: true,
        skNumber: true,
        tmt: true,
        endDate: true,
        digitalSignatureUrl: true,
        teacher: {
          id: true,
          nama: true,
          nuptk: true,
          status: true,
        },
        school: {
          id: true,
          nama: true,
          npsn: true,
        },
      },
    });

    if (!tenure) return null;
    return tenure;
  }
}
