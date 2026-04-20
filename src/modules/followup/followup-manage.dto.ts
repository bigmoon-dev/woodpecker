import { IsIn, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FollowupStudentQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 20;
}

export class UpdateThresholdDto {
  @IsIn(['yellow', 'red'])
  threshold: string;
}
