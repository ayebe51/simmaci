import { IsString, IsOptional, IsDateString, IsIn } from 'class-validator';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsString()
  category: string;

  @IsString()
  type: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  @IsIn(['DRAFT', 'OPEN', 'CLOSED', 'COMPLETED'])
  status?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateEventDto extends CreateEventDto {}
