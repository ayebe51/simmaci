import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Competition } from './competition.entity';
import { Participant } from './participant.entity';

@Entity('results')
export class Result {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  competitionId: string;

  @ManyToOne(() => Competition, (competition) => competition.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competitionId' })
  competition: Competition;

  @Column()
  participantId: string;

  @ManyToOne(() => Participant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participantId' })
  participant: Participant;

  @Column({ type: 'float', nullable: true })
  score?: number;

  @Column({ nullable: true })
  rank?: number; // 1, 2, 3 etc.

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
