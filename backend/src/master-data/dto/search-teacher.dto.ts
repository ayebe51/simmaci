import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class SearchTeacherDto {
  @IsOptional()
  @IsString()
  search?: string; // Search by name or NUPTK

  @IsOptional()
  @IsString()
  status?: string; // Filter by status (PNS, Sertifikasi, Honorer)

  @IsOptional()
  @IsString()
  satminkal?: string; // Filter by school/unit

  @IsOptional()
  @IsString()
  kecamatan?: string; // Filter by district

  @IsOptional()
  @IsString()
  isCertified?: string; // 'true' or 'false'

  @IsOptional()
  @IsString()
  pdpkpnu?: string; // Sudah or Belum
}
