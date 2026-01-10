import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('approval_history')
export class ApprovalHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  skId: string;

  @Column()
  skNumber: string; // For easy reference

  @Column()
  skType: string; // 'pengangkatan', 'mutasi', etc.

  @Column()
  approvedBy: string; // User ID

  @Column()
  approvedByName: string;

  @Column()
  approvedByRole: string;

  @Column()
  status: string; // 'pending' | 'approved' | 'rejected' | 'revised'

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}
