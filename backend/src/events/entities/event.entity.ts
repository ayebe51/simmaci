import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Competition } from './competition.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  category: string; // e.g., 'Olahraga', 'Seni'

  @Column()
  type: string; // e.g., 'Individual', 'Team'

  @Column({ type: 'datetime', nullable: true})
  date: Date;

  @Column({ nullable: true })
  location: string;

  @Column({ default: 'DRAFT' })
  status: string; // DRAFT, OPEN, CLOSED, COMPLETED

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => Competition, (competition) => competition.event)
  competitions: Competition[];



  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
