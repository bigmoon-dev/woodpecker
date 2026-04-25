import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';

export class CreateGradeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  year?: string;
}

export class CreateClassDto {
  @IsUUID()
  gradeId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateStudentDto {
  @IsUUID()
  classId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  studentNumber?: string;

  @IsOptional()
  @IsString()
  studentNo?: string;

  @IsOptional()
  @IsString()
  gender?: string;
}

export class ImportResultDto {
  total: number;
  created: number;
  skipped: number;
  errors: { row: number; field: string; message: string }[];
}
