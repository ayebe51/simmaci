import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

// Phase 3: Performance - Index on school name for faster lookups
@Entity()
@Index('idx_school_nama', ['nama'])
export class School {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  nsm: string;

  @Column()
  npsn: string;

  @Column()
  nama: string;

  @Column()
  alamat: string;

  @Column()
  kecamatan: string;

  @Column()
  kepala: string;

  @Column({ nullable: true })
  status: string;

  @Column({ nullable: true })
  noHpKepala: string;

  @Column({ nullable: true })
  statusJamiyyah: string;

  @Column({ nullable: true })
  akreditasi: string;
}
