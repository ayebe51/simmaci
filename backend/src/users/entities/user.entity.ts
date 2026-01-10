import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string; // Hashed

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  unitKerja: string;

  @Column({ default: 'operator' })
  role: string; // 'super_admin' | 'admin_pusat' | 'operator_madrasah' | 'kepala_madrasah'

  @Column({ nullable: true })
  kecamatan: string; // For filtering by kecamatan

  @Column('simple-array', { nullable: true })
  permissions: string[]; // Permission array

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
