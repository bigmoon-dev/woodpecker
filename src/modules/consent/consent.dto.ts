import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConsentDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsString()
  @IsNotEmpty()
  consentType: string;

  @IsOptional()
  @IsString()
  contentHash?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsDate()
  @Type(() => Date)
  signedAt: Date;

  @IsOptional()
  @IsString()
  ip?: string;
}
