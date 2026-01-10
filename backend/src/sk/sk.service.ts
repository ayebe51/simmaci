import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { Sk } from './entities/sk.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class SkService {
  constructor(
    @InjectRepository(Sk)
    private readonly skRepo: Repository<Sk>,
  ) {}

  async create(data: Partial<Sk>, user: User): Promise<Sk> {
    try {
      // Let TypeORM automatically handle userId from user relation
      const sk = this.skRepo.create({
        ...data,
        user, // TypeORM will set userId automatically
        unitKerja: user.unitKerja || data.unitKerja, // Prefer user's unit, fallback to input
      });
      
      const saved = await this.skRepo.save(sk);
      return saved;
    } catch (e: any) {
      // Log error for debugging
      const errorMsg = `[SK CREATE ERROR] User: ${user.id} | Data: ${JSON.stringify(data)} | Error: ${e.message}`;
      console.error(errorMsg);
      fs.appendFileSync('d:/SIMMACI/debug_sk_error.txt', `\n${errorMsg}`);
      throw e;
    }
  }

  async findAll(user: User): Promise<Sk[]> {
    if (user.role === 'super_admin' || user.role === 'admin_pusat') {
        return this.skRepo.find({ order: { createdAt: 'DESC' }, relations: ['user'] });
    }
    // Operator only sees their own or their unit's SKs
    return this.skRepo.find({ 
        where: { userId: user.id }, 
        order: { createdAt: 'DESC' } 
    });
  }

  async findOne(id: string): Promise<Sk | null> {
    return this.skRepo.findOne({ where: { id }, relations: ['user'] });
  }

  async deleteAll(): Promise<void> {
    try {
        await this.skRepo.delete({});
    } catch (e: any) {
        try {
             // Debug log
             fs.writeFileSync('d:/SIMMACI/debug_sk_error.txt', `Delete method failed: ${e.message}\nTrying raw SQL...`);
             await this.skRepo.query('DELETE FROM sk'); 
        } catch (inner: any) {
             const msg = `Delete Error: ${e.message} | Inner: ${inner.message}`;
             fs.appendFileSync('d:/SIMMACI/debug_sk_error.txt', `\nCritial: ${msg}`);
             console.error(msg);
             throw new Error(msg);
        }
    }
  }
  async update(id: string, data: Partial<Sk>): Promise<Sk> {
      try {
          await this.skRepo.update(id, data);
          const updated = await this.findOne(id);
          if (!updated) throw new Error("SK Not Found");
          return updated;
      } catch (e: any) {
          fs.appendFileSync('d:/SIMMACI/debug_sk_error.txt', `\n[UPDATE FAIL] ID: ${id} | DATA: ${JSON.stringify(data)} | ERR: ${e.message}`);
          throw e;
      }
  }

  async verifyPublic(id: string) {
    const sk = await this.skRepo.findOne({
      where: { id },
      select: {
        id: true,
        jenis: true,
        nama: true,
        niy: true,
        status: true,
        nomorSurat: true,
        unitKerja: true,
        createdAt: true,
      },
    });

    if (!sk) return null;

    // Return data formatted for verification page
    return {
      id: sk.id,
      skNumber: sk.nomorSurat,
      status: sk.status,
      teacher: {
        nama: sk.nama,
        nuptk: sk.niy || '-',
      },
      jenis: sk.jenis,
      unitKerja: sk.unitKerja,
      createdAt: sk.createdAt,
    };
  }
}
