import { IsNotEmpty, IsOptional, IsDateString, IsString } from 'class-validator';

export class CreateCompetitionDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  category: string;

  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  location?: string;
}
