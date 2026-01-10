import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Phase 3: Performance - Indexes on frequently queried fields
@Entity()
@Index('idx_sk_status', ['status'])
@Index('idx_sk_unitKerja', ['unitKerja'])
@Index('idx_sk_userId', ['userId'])
@Index('idx_sk_createdAt', ['createdAt'])
export class Sk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  jenis: string; // SK Kepala Madrasah, GTY, GTT, etc.

  @Column()
  jenisPengajuan: string; // new, renew

  @Column({ nullable: true })
  nomorSurat: string; // Generated on approval or submission

  @Column()
  nama: string;

  @Column({ nullable: true })
  niy: string;

  @Column({ nullable: true })
  jabatan: string;

  @Column()
  unitKerja: string;

  @Column({ nullable: true })
  keterangan: string;

  @Column({ default: 'Pending' })
  status: string; // Pending, Approved, Rejected

  @Column({ nullable: true })
  fileUrl: string; // URL to generated/uploaded PDF

  @Column({ nullable: true })
  suratPermohonanUrl: string; // URL File Surat Permohonan

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
