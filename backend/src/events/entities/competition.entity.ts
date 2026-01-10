import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { Participant } from './participant.entity';
import { Result } from './result.entity';

@Entity('competitions')
export class Competition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventId: string;

  @ManyToOne(() => Event, (event) => event.competitions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column()
  name: string; // e.g. "Lari 100m", "Pidato Bahasa Arab"

  @Column()
  category: string; // 'Olahraga', 'Seni', 'Akademik'

  @Column()
  type: string; // 'Individual', 'Team'

  @Column({ nullable: true })
  certificateTemplate: string; // Path to custom template image

  @Column({ type: 'datetime', nullable: true })
  date: Date;

  @Column({ nullable: true })
  location: string;

  @OneToMany(() => Participant, (participant) => participant.competition)
  participants: Participant[];

  @OneToMany(() => Result, (result) => result.competition)
  results: Result[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
