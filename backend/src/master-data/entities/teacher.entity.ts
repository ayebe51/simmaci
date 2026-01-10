import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

// Phase 3: Performance - Indexes on frequently queried fields
@Entity()
@Index('idx_teacher_satminkal', ['satminkal'])
@Index('idx_teacher_isActive', ['isActive'])
@Index('idx_teacher_isCertified', ['isCertified'])
@Index('idx_teacher_pdpkpnu', ['pdpkpnu'])
@Index('idx_teacher_kecamatan', ['kecamatan'])
@Index('idx_teacher_status', ['status'])
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  nuptk: string; // Or PegID

  @Column()
  nama: string;

  @Column()
  status: string; // PNS, Sertifikasi, Honorer

  @Column()
  satminkal: string;

  @Column({ nullable: true })
  kecamatan: string;

  @Column({ nullable: true })
  mapel: string;

  @Column({ nullable: true })
  jabatan: string; // e.g. Guru, Kepala Madrasah

  @Column({ default: 'Belum' })
  pdpkpnu: string; // Sudah / Belum

  // New fields from Excel
  @Column({ nullable: true })
  gender: string; // L / P

  @Column({ nullable: true })
  birthPlace: string;

  @Column({ nullable: true })
  birthDate: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ default: false })
  isCertified: boolean;

  @Column({ nullable: true })
  pendidikanTerakhir: string;

  @Column({ nullable: true })
  tmt: string; // Tanggal Mulai Tugas

  @Column({ default: true })
  isActive: boolean; // Status aktif/non-aktif guru

  @Column({ nullable: true })
  suratPermohonanUrl: string; // URL File Surat Permohonan
}
