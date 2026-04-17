import {
  IsUUID,
  IsDateString,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsArray,
  IsIn,
} from 'class-validator';
import { InterviewStatus } from './interview.types';

export class CreateInterviewDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  psychologistId: string;

  @IsDateString()
  interviewDate: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class UpdateInterviewDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  psychologistId?: string;

  @IsOptional()
  @IsDateString()
  interviewDate?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  fields: any[];
}

export class CreateFollowUpDto {
  @IsUUID()
  interviewId: string;

  @IsUUID()
  studentId: string;

  @IsDateString()
  reminderDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateStatusDto {
  @IsIn(Object.values(InterviewStatus))
  status: string;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  fields?: any[];
}
