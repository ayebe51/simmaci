import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  nisn: string; // National Student ID

  @Column()
  name: string;

  @Column({ nullable: true })
  gender: string; // L/P

  @Column({ nullable: true })
  class: string;

  @Column({ nullable: true })
  fatherName: string;

  @Column({ nullable: true })
  motherName: string;

  @Column({ nullable: true })
  schoolId: string; // unitKerja from User

  @Column({ nullable: true })
  nik: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  birthPlace: string;

  @Column({ nullable: true })
  birthDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
