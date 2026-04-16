import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScaleValidation } from '../../entities/scale/scale-validation.entity';
import { Scale } from '../../entities/scale/scale.entity';

export interface CreateValidationDto {
  reliabilityType: string;
  reliabilityValue: number;
  validityType: string;
  validityDetail?: string;
  sampleSize?: number;
  population?: string;
  referenceSource?: string;
  validatedAt: string;
}

export interface UpdateValidationDto {
  reliabilityType?: string;
  reliabilityValue?: number;
  validityType?: string;
  validityDetail?: string;
  sampleSize?: number;
  population?: string;
  referenceSource?: string;
  validatedAt?: string;
}

export interface ValidationSummaryDto {
  scaleId: string;
  totalStudies: number;
  avgReliability: number;
  reliabilityTypes: string[];
  validityTypes: string[];
  latestValidation: ScaleValidation | null;
}

@Injectable()
export class ScaleValidationService {
  constructor(
    @InjectRepository(ScaleValidation)
    private validationRepo: Repository<ScaleValidation>,
    @InjectRepository(Scale)
    private scaleRepo: Repository<Scale>,
  ) {}

  async addValidation(
    scaleId: string,
    dto: CreateValidationDto,
  ): Promise<ScaleValidation> {
    const scale = await this.scaleRepo.findOne({ where: { id: scaleId } });
    if (!scale) throw new NotFoundException(`Scale ${scaleId} not found`);

    if (dto.reliabilityValue < 0 || dto.reliabilityValue > 1) {
      throw new Error('reliabilityValue must be between 0 and 1');
    }

    const validation = new ScaleValidation();
    validation.scaleId = scaleId;
    validation.reliabilityType = dto.reliabilityType;
    validation.reliabilityValue = dto.reliabilityValue;
    validation.validityType = dto.validityType;
    validation.validityDetail = dto.validityDetail ?? null;
    validation.sampleSize = dto.sampleSize ?? null;
    validation.population = dto.population ?? null;
    validation.referenceSource = dto.referenceSource ?? null;
    validation.validatedAt = new Date(dto.validatedAt);
    return this.validationRepo.save(validation);
  }

  async updateValidation(
    validationId: string,
    dto: UpdateValidationDto,
  ): Promise<ScaleValidation> {
    const validation = await this.validationRepo.findOne({
      where: { id: validationId },
    });
    if (!validation)
      throw new NotFoundException(`Validation ${validationId} not found`);

    if (dto.reliabilityValue !== undefined) {
      if (dto.reliabilityValue < 0 || dto.reliabilityValue > 1) {
        throw new Error('reliabilityValue must be between 0 and 1');
      }
      validation.reliabilityValue = dto.reliabilityValue;
    }
    if (dto.reliabilityType !== undefined)
      validation.reliabilityType = dto.reliabilityType;
    if (dto.validityType !== undefined)
      validation.validityType = dto.validityType;
    if (dto.validityDetail !== undefined)
      validation.validityDetail = dto.validityDetail;
    if (dto.sampleSize !== undefined) validation.sampleSize = dto.sampleSize;
    if (dto.population !== undefined) validation.population = dto.population;
    if (dto.referenceSource !== undefined)
      validation.referenceSource = dto.referenceSource;
    if (dto.validatedAt !== undefined)
      validation.validatedAt = new Date(dto.validatedAt);

    return this.validationRepo.save(validation);
  }

  async deleteValidation(validationId: string): Promise<void> {
    const result = await this.validationRepo.delete(validationId);
    if (!result.affected) {
      throw new NotFoundException(`Validation ${validationId} not found`);
    }
  }

  async getValidations(scaleId: string): Promise<ScaleValidation[]> {
    const scale = await this.scaleRepo.findOne({ where: { id: scaleId } });
    if (!scale) throw new NotFoundException(`Scale ${scaleId} not found`);

    return this.validationRepo.find({
      where: { scaleId },
      order: { validatedAt: 'DESC' },
    });
  }

  async getValidationSummary(scaleId: string): Promise<ValidationSummaryDto> {
    const validations = await this.getValidations(scaleId);

    const avgReliability =
      validations.length > 0
        ? validations.reduce((sum, v) => sum + v.reliabilityValue, 0) /
          validations.length
        : 0;

    const reliabilityTypes = [
      ...new Set(validations.map((v) => v.reliabilityType)),
    ];
    const validityTypes = [...new Set(validations.map((v) => v.validityType))];
    const latestValidation = validations.length > 0 ? validations[0] : null;

    return {
      scaleId,
      totalStudies: validations.length,
      avgReliability: Math.round(avgReliability * 10000) / 10000,
      reliabilityTypes,
      validityTypes,
      latestValidation,
    };
  }
}
