import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsBoolean,
  IsNumber,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateScoringRuleDto {
  @IsOptional()
  @IsString()
  dimension?: string;

  @IsString()
  formulaType: string;

  @IsNumber()
  weight: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class CreateScoreRangeDto {
  @IsOptional()
  @IsString()
  dimension?: string;

  @IsNumber()
  minScore: number;

  @IsNumber()
  maxScore: number;

  @IsString()
  level: string;

  @IsString()
  color: string;

  @IsString()
  suggestion: string;
}

export class CreateScaleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  validationInfo?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateScaleItemDto)
  items: CreateScaleItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateScoringRuleDto)
  scoringRules?: CreateScoringRuleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateScoreRangeDto)
  scoreRanges?: CreateScoreRangeDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dimensions?: string[];
}

export class CreateScaleItemDto {
  @IsString()
  itemText: string;

  @IsOptional()
  @IsString()
  itemType?: string;

  @IsInt()
  @Min(0)
  sortOrder: number;

  @IsOptional()
  @IsString()
  dimension?: string;

  @IsOptional()
  @IsBoolean()
  reverseScore?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateScaleOptionDto)
  options: CreateScaleOptionDto[];
}

export class CreateScaleOptionDto {
  @IsString()
  optionText: string;

  @IsInt()
  scoreValue: number;

  @IsInt()
  @Min(0)
  sortOrder: number;
}
