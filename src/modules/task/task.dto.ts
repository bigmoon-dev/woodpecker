import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @IsUUID()
  scaleId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsArray()
  @IsUUID('4', { each: true })
  targetIds: string[];

  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  deadline?: Date;

  @IsUUID()
  createdById: string;
}

export class TaskItemAnswerDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  optionId: string;
}

export class SubmitAnswersDto {
  @IsUUID()
  studentId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskItemAnswerDto)
  items: TaskItemAnswerDto[];
}
