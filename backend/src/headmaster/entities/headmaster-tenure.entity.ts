import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Teacher } from '../../master-data/entities/teacher.entity';
import { School } from '../../master-data/entities/school.entity';

export enum HeadmasterStatus {
  DRAFT = 'Draft',
  SUBMITTED = 'Submitted',
  VERIFIED = 'Verified',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  ACTIVE = 'Active',
  EXPIRED = 'Expired',
}

@Entity()
export class HeadmasterTenure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Teacher, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacherId' })
  teacher: Teacher;

  @Column()
  teacherId: string;

  @ManyToOne(() => School, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schoolId' })
  school: School;

  @Column()
  schoolId: string;

  @Column({ default: 1 })
  periode: number; // 1, 2, or 3

  @Column({ nullable: true })
  skNumber: string;

  @Column({ type: 'date' })
  tmt: Date;

  @Column({ type: 'date' })
  endDate: Date; // Calculated TMT + 4 years

  @Column({
    type: 'simple-enum',
    enum: HeadmasterStatus,
    default: HeadmasterStatus.DRAFT,
  })
  status: HeadmasterStatus;

  @Column({ type: 'simple-json', nullable: true })
  documents: {
    fitAndProper?: string;
    performanceReview?: string;
    recommendation?: string;
  };

  @Column({ nullable: true })
  keterangan: string;

  @Column({ nullable: true })
  suratPermohonanUrl: string;

  @Column({ nullable: true })
  suratPermohonanNumber: string;

  @Column({ type: 'date', nullable: true })
  suratPermohonanDate: Date;

  @Column({ nullable: true })
  digitalSignatureUrl: string; // Tanda tangan digital

  @Column({ nullable: true })
  skUrl: string; // Final SK File (PDF)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
