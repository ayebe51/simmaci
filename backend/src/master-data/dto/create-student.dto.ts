import { IsString, IsNotEmpty, IsEnum, IsOptional, Length, Matches, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty({ message: 'NISN tidak boleh kosong' })
  @Length(10, 10, { message: 'NISN harus 10 digit' })
  @Matches(/^\d+$/, { message: 'NISN harus berupa angka' })
  @Transform(({ value }) => String(value).trim())
  nisn: string;

  @IsString()
  @IsOptional()
  @Length(0, 50)
  @Transform(({ value }) => value ? String(value).trim() : '')
  nomorIndukMaarif?: string;

  @IsString()
  @IsNotEmpty({ message: 'Nama tidak boleh kosong' })
  @Length(3, 100, { message: 'Nama harus 3-100 karakter' })
  @Transform(({ value }) => sanitizeHtml(String(value).trim()))
  nama: string;

  @IsEnum(['L', 'P'], { message: 'Jenis kelamin harus L atau P' })
  @IsNotEmpty({ message: 'Jenis kelamin tidak boleh kosong' })
  jenisKelamin: 'L' | 'P';

  @IsOptional()
  @IsString()
  @Length(0, 100)
  @Transform(({ value }) => value ? sanitizeHtml(String(value).trim()) : '')
  tempatLahir?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal harus YYYY-MM-DD' })
  tanggalLahir?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  @Transform(({ value }) => value ? sanitizeHtml(String(value).trim()) : '')
  alamat?: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  @Transform(({ value }) => value ? sanitizeHtml(String(value).trim()) : '')
  kecamatan?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  @Transform(({ value }) => value ? sanitizeHtml(String(value).trim()) : '')
  namaSekolah?: string;

  @IsOptional()
  @IsString()
  @Length(0, 10)
  kelas?: string;

  @IsOptional()
  @IsString()
  @Length(0, 15)
  @Matches(/^[\d\s\+\-\(\)]*$/, { message: 'Nomor telepon tidak valid' })
  nomorTelepon?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  @Transform(({ value }) => value ? sanitizeHtml(String(value).trim()) : '')
  namaWali?: string;
}

/**
 * Sanitize HTML/JS to prevent XSS
 */
function sanitizeHtml(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
