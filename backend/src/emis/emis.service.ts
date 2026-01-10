import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../master-data/entities/student.entity';

@Injectable()
export class EmisService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>
  ) {}

  async importStudents(data: any[], user: any) {
      // Map and Bulk Insert/Upsert
      // Assumption: Data is array of objects { name, nisn, class, ... }
      const students = data.map(item => ({
          nisn: item.nisn || null,
          name: item.name,
          gender: item.gender,
          class: item.kelas || item.class,
          fatherName: item.fatherName || item.nama_ayah,
          motherName: item.motherName || item.nama_ibu,
          nik: item.nik,
          address: item.address,
          birthPlace: item.birthPlace,
          birthDate: item.birthDate,
          schoolId: user.unitKerja // Link to operator's school
      }));

      // Use upsert to avoid duplicates by NISN if exists, otherwise save.
      // SQLite/TypeORM upsert support might vary, simple save/create for now.
      // Ideally check existence by NISN.
      
      const saved = [];
      for (const s of students) {
          // Simple check to prevent duplicate NISN for same school? 
          // Or just allow duplicates for now in this demo phase.
          // Let's use save which updates if id exists, but we don't have IDs.
          // If NISN is unique, we can check.
          if (s.nisn) {
              const existing = await this.studentRepo.findOne({ where: { nisn: s.nisn } });
              if (existing) {
                  await this.studentRepo.update(existing.id, s);
                  continue;
              }
          }
          const newStudent = this.studentRepo.create(s);
          await this.studentRepo.save(newStudent);
          saved.push(newStudent);
      }
      return { count: saved.length };
  }
}
