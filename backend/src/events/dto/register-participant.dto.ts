import { IsString, IsOptional, IsUUID } from 'class-validator';

export class RegisterParticipantDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  institution?: string;

  @IsString()
  @IsOptional()
  contact?: string;
}
