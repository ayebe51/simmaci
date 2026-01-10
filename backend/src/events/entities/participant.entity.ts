import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Competition } from './competition.entity';

@Entity('participants')
export class Participant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  competitionId: string;

  @ManyToOne(() => Competition, (competition) => competition.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competitionId' })
  competition: Competition;

  @Column()
  name: string;

  @Column({ nullable: true })
  institution: string; // Asal Sekolah / Lembaga

  @Column({ nullable: true })
  contact: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
