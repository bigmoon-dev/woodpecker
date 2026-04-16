import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @IsUUID()
  scaleId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsArray()
  @IsUUID('4', { each: true })
  targetIds: string[];

  @IsOptional()
  @IsString()
  @IsIn(['class', 'grade'])
  targetType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  deadline?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetIds?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['class', 'grade'])
  targetType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  deadline?: string;
}

export class TaskItemAnswerDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  optionId: string;
}

export class SubmitAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskItemAnswerDto)
  items: TaskItemAnswerDto[];
}
