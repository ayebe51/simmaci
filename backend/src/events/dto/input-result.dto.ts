import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class InputResultDto {
  @IsUUID()
  participantId: string;

  @IsNumber()
  @IsOptional()
  score?: number;

  @IsNumber()
  @IsOptional()
  rank?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
