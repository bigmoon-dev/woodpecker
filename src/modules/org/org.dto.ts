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

  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class CreateClassDto {
  @IsUUID()
  gradeId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class CreateStudentDto {
  @IsUUID()
  classId: string;

  @IsOptional()
  @IsString()
  gender?: string;
}
