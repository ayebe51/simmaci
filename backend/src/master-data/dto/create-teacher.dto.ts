import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Length,
  IsBoolean,
} from 'class-validator';

export class CreateTeacherDto {
  @IsNotEmpty({ message: 'Nomor Induk tidak boleh kosong' })
  @IsString()
  nuptk: string; // Bisa NUPTK atau Nomor Induk Ma'arif

  @IsNotEmpty({ message: 'Nama tidak boleh kosong' })
  @IsString()
  @Length(3, 100, { message: 'Nama harus antara 3-100 karakter' })
  nama: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+62|62|0)[0-9]{9,12}$/, {
    message: 'Nomor telepon harus format Indonesia yang valid (contoh: 081234567890)',
  })
  phoneNumber?: string;

  @IsNotEmpty({ message: 'Status tidak boleh kosong' })
  @IsString()
  status: string;

  @IsNotEmpty({ message: 'Satminkal tidak boleh kosong' })
  @IsString()
  satminkal: string;

  @IsOptional()
  @IsString()
  kecamatan?: string;

  @IsOptional()
  @IsString()
  pdpkpnu?: string;

  @IsOptional()
  @IsBoolean()
  isCertified?: boolean;

  @IsOptional()
  @IsString()
  birthPlace?: string;

  @IsOptional()
  @IsString()
  birthDate?: string;
}
