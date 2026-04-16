/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ScaleValidationService } from './scale-validation.service';
import { ScaleValidation } from '../../entities/scale/scale-validation.entity';
import { Scale } from '../../entities/scale/scale.entity';

describe('ScaleValidationService', () => {
  let service: ScaleValidationService;
  let validationRepo: any;
  let scaleRepo: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScaleValidationService,
        {
          provide: getRepositoryToken(ScaleValidation),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Scale),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ScaleValidationService>(ScaleValidationService);
    validationRepo = module.get(getRepositoryToken(ScaleValidation));
    scaleRepo = module.get(getRepositoryToken(Scale));
  });

  describe('addValidation()', () => {
    const dto = {
      reliabilityType: 'CronbachsAlpha',
      reliabilityValue: 0.89,
      validityType: 'Construct',
      validityDetail: 'Factor analysis confirmed',
      sampleSize: 500,
      population: 'Chinese university students',
      referenceSource: 'Zhang et al. 2020',
      validatedAt: '2020-06-15',
    };

    it('should create a validation record for a scale', async () => {
      scaleRepo.findOne.mockResolvedValue({ id: 's1' });
      validationRepo.save.mockResolvedValue({
        id: 'v1',
        scaleId: 's1',
        reliabilityType: 'CronbachsAlpha',
        reliabilityValue: 0.89,
        validityType: 'Construct',
      });

      const result = await service.addValidation('s1', dto);

      expect(validationRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('v1');
      expect(result.scaleId).toBe('s1');
    });

    it('should throw NotFoundException for missing scale', async () => {
      scaleRepo.findOne.mockResolvedValue(null);

      await expect(service.addValidation('missing', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject reliabilityValue > 1', async () => {
      scaleRepo.findOne.mockResolvedValue({ id: 's1' });

      await expect(
        service.addValidation('s1', { ...dto, reliabilityValue: 1.5 }),
      ).rejects.toThrow('reliabilityValue must be between 0 and 1');
    });

    it('should reject reliabilityValue < 0', async () => {
      scaleRepo.findOne.mockResolvedValue({ id: 's1' });

      await expect(
        service.addValidation('s1', { ...dto, reliabilityValue: -0.1 }),
      ).rejects.toThrow('reliabilityValue must be between 0 and 1');
    });

    it('should accept reliabilityValue at boundaries (0 and 1)', async () => {
      scaleRepo.findOne.mockResolvedValue({ id: 's1' });
      validationRepo.create.mockReturnValue({});
      validationRepo.save.mockResolvedValue({ id: 'v1' });

      await service.addValidation('s1', { ...dto, reliabilityValue: 0 });
      await service.addValidation('s1', { ...dto, reliabilityValue: 1 });

      expect(validationRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should handle optional fields as null', async () => {
      scaleRepo.findOne.mockResolvedValue({ id: 's1' });
      validationRepo.save.mockImplementation((v: any) => Promise.resolve(v));

      const minimalDto = {
        reliabilityType: 'SplitHalf',
        reliabilityValue: 0.75,
        validityType: 'Content',
        validatedAt: '2021-01-01',
      };

      const result = await service.addValidation('s1', minimalDto);

      expect(result.validityDetail).toBeNull();
      expect(result.sampleSize).toBeNull();
      expect(result.population).toBeNull();
      expect(result.referenceSource).toBeNull();
    });
  });

  describe('updateValidation()', () => {
    it('should update fields on existing validation', async () => {
      validationRepo.findOne.mockResolvedValue({
        id: 'v1',
        reliabilityValue: 0.8,
        reliabilityType: 'CronbachsAlpha',
      });
      validationRepo.save.mockImplementation((v: any) => Promise.resolve(v));

      const result = await service.updateValidation('v1', {
        reliabilityValue: 0.92,
      });

      expect(result.reliabilityValue).toBe(0.92);
    });

    it('should throw NotFoundException for missing validation', async () => {
      validationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateValidation('missing', { reliabilityValue: 0.9 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject invalid reliabilityValue on update', async () => {
      validationRepo.findOne.mockResolvedValue({ id: 'v1' });

      await expect(
        service.updateValidation('v1', { reliabilityValue: 2.0 }),
      ).rejects.toThrow('reliabilityValue must be between 0 and 1');
    });

    it('should update validatedAt date', async () => {
      validationRepo.findOne.mockResolvedValue({
        id: 'v1',
        validatedAt: new Date('2020-01-01'),
      });
      validationRepo.save.mockImplementation((v: any) => Promise.resolve(v));

      const result = await service.updateValidation('v1', {
        validatedAt: '2023-05-10',
      });

      expect(result.validatedAt).toEqual(new Date('2023-05-10'));
    });
  });

  describe('deleteValidation()', () => {
    it('should delete existing validation', async () => {
      validationRepo.delete.mockResolvedValue({ affected: 1 });

      await service.deleteValidation('v1');

      expect(validationRepo.delete).toHaveBeenCalledWith('v1');
    });

    it('should throw NotFoundException if nothing deleted', async () => {
      validationRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.deleteValidation('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getValidations()', () => {
    it('should return validations for a scale', async () => {
      scaleRepo.findOne.mockResolvedValue({ id: 's1' });
      validationRepo.find.mockResolvedValue([
        { id: 'v1', reliabilityType: 'CronbachsAlpha' },
        { id: 'v2', reliabilityType: 'SplitHalf' },
      ]);

      const result = await service.getValidations('s1');

      expect(result).toHaveLength(2);
      expect(validationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { scaleId: 's1' },
          order: { validatedAt: 'DESC' },
        }),
      );
    });

    it('should throw NotFoundException for missing scale', async () => {
      scaleRepo.findOne.mockResolvedValue(null);

      await expect(service.getValidations('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return empty array when no validations', async () => {
      scaleRepo.findOne.mockResolvedValue({ id: 's1' });
      validationRepo.find.mockResolvedValue([]);

      const result = await service.getValidations('s1');

      expect(result).toEqual([]);
    });
  });

  describe('getValidationSummary()', () => {
    it('should return summary with computed values', async () => {
      scaleRepo.findOne.mockResolvedValue({ id: 's1' });
      validationRepo.find.mockResolvedValue([
        {
          id: 'v1',
          reliabilityType: 'CronbachsAlpha',
          reliabilityValue: 0.9,
          validityType: 'Construct',
        },
        {
          id: 'v2',
          reliabilityType: 'SplitHalf',
          reliabilityValue: 0.8,
          validityType: 'Content',
        },
      ]);

      const result = await service.getValidationSummary('s1');

      expect(result.scaleId).toBe('s1');
      expect(result.totalStudies).toBe(2);
      expect(result.avgReliability).toBe(0.85);
      expect(result.reliabilityTypes).toEqual(['CronbachsAlpha', 'SplitHalf']);
      expect(result.validityTypes).toEqual(['Construct', 'Content']);
      expect(result.latestValidation!.id).toBe('v1');
    });

    it('should return zero summary for scale with no validations', async () => {
      scaleRepo.findOne.mockResolvedValue({ id: 's1' });
      validationRepo.find.mockResolvedValue([]);

      const result = await service.getValidationSummary('s1');

      expect(result.totalStudies).toBe(0);
      expect(result.avgReliability).toBe(0);
      expect(result.reliabilityTypes).toEqual([]);
      expect(result.validityTypes).toEqual([]);
      expect(result.latestValidation).toBeNull();
    });
  });
});
