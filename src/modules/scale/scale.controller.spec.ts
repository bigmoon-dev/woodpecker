/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ScaleController } from './scale.controller';
import { ScaleService } from './scale.service';
import { ExcelImportService } from './excel-import.service';
import { ScaleVersionService } from './scale-version.service';
import { ScaleValidationService } from './scale-validation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';

describe('ScaleController', () => {
  let controller: ScaleController;
  let scaleService: any;
  let excelImportService: any;

  const mockScaleService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findLibrary: jest.fn(),
    cloneFromLibrary: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockExcelImportService = {
    parseScaleFromBuffer: jest.fn(),
  };

  const mockVersionService = {
    getVersionHistory: jest.fn(),
    publishScale: jest.fn(),
    createVersion: jest.fn(),
    getVersion: jest.fn(),
  };

  const mockValidationService = {
    getValidations: jest.fn(),
    addValidation: jest.fn(),
    updateValidation: jest.fn(),
    deleteValidation: jest.fn(),
    getValidationSummary: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScaleController],
      providers: [
        { provide: ScaleService, useValue: mockScaleService },
        { provide: ExcelImportService, useValue: mockExcelImportService },
        { provide: ScaleVersionService, useValue: mockVersionService },
        { provide: ScaleValidationService, useValue: mockValidationService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ScaleController>(ScaleController);
    scaleService = module.get(ScaleService);
    excelImportService = module.get(ExcelImportService);
  });

  it('create delegates to service', async () => {
    scaleService.create.mockResolvedValueOnce({ id: 's1' });
    const dto = { name: 'PHQ-9', items: [] } as any;
    const result = await controller.create(dto);
    expect(scaleService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 's1' });
  });

  it('findAll passes pagination', async () => {
    scaleService.findAll.mockResolvedValueOnce({ data: [], total: 0 });
    await controller.findAll({ page: 2, pageSize: 5 } as any);
    expect(scaleService.findAll).toHaveBeenCalledWith(2, 5);
  });

  it('findLibrary delegates', async () => {
    scaleService.findLibrary.mockResolvedValueOnce([]);
    const result = await controller.findLibrary();
    expect(scaleService.findLibrary).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('cloneFromLibrary delegates', async () => {
    scaleService.cloneFromLibrary.mockResolvedValueOnce({ id: 's2' });
    const result = await controller.cloneFromLibrary('lib1');
    expect(scaleService.cloneFromLibrary).toHaveBeenCalledWith('lib1');
    expect(result).toEqual({ id: 's2' });
  });

  it('findOne delegates', async () => {
    scaleService.findOne.mockResolvedValueOnce({ id: 's1' });
    const result = await controller.findOne('s1');
    expect(scaleService.findOne).toHaveBeenCalledWith('s1');
    expect(result).toEqual({ id: 's1' });
  });

  it('importScale parses file and creates scale', async () => {
    const parsed = {
      name: 'Imported',
      version: '1.0',
      description: 'desc',
      items: [],
      scoringRules: [],
      scoreRanges: [],
    };
    excelImportService.parseScaleFromBuffer.mockResolvedValueOnce(parsed);
    scaleService.create.mockResolvedValueOnce({ id: 's3', name: 'Imported' });

    const file = { buffer: Buffer.from('data') } as Express.Multer.File;
    const result = await controller.importScale(file);

    expect(excelImportService.parseScaleFromBuffer).toHaveBeenCalledWith(
      file.buffer,
    );
    expect(scaleService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Imported' }),
    );
    expect(result).toEqual({ id: 's3', name: 'Imported' });
  });

  describe('version endpoints', () => {
    it('getVersionHistory delegates to versionService', async () => {
      mockVersionService.getVersionHistory.mockResolvedValueOnce([]);
      const result = await controller.getVersionHistory('s1');
      expect(mockVersionService.getVersionHistory).toHaveBeenCalledWith('s1');
      expect(result).toEqual([]);
    });

    it('publishScale delegates to versionService', async () => {
      mockVersionService.publishScale.mockResolvedValueOnce({
        id: 's1',
        versionStatus: 'published',
      });
      const result = await controller.publishScale('s1');
      expect(mockVersionService.publishScale).toHaveBeenCalledWith('s1');
      expect(result.versionStatus).toBe('published');
    });

    it('createVersion delegates to versionService', async () => {
      mockVersionService.createVersion.mockResolvedValueOnce({
        id: 's2',
        version: '1.1',
      });
      const result = await controller.createVersion('s1');
      expect(mockVersionService.createVersion).toHaveBeenCalledWith('s1');
      expect(result.version).toBe('1.1');
    });

    it('getVersion delegates to versionService', async () => {
      mockVersionService.getVersion.mockResolvedValueOnce({
        id: 'v1',
        version: '1.0',
      });
      const result = await controller.getVersion('s1', 'v1');
      expect(mockVersionService.getVersion).toHaveBeenCalledWith('s1', 'v1');
      expect(result.version).toBe('1.0');
    });
  });

  describe('validation endpoints', () => {
    it('getValidations delegates to validationService', async () => {
      mockValidationService.getValidations.mockResolvedValueOnce([]);
      const result = await controller.getValidations('s1');
      expect(mockValidationService.getValidations).toHaveBeenCalledWith('s1');
      expect(result).toEqual([]);
    });

    it('addValidation delegates to validationService', async () => {
      const dto = {
        reliabilityType: 'CronbachsAlpha',
        reliabilityValue: 0.9,
        validityType: 'Construct',
        validatedAt: '2020-01-01',
      };
      mockValidationService.addValidation.mockResolvedValueOnce({
        id: 'v1',
        ...dto,
      });
      await controller.addValidation('s1', dto as any);
      expect(mockValidationService.addValidation).toHaveBeenCalledWith(
        's1',
        dto,
      );
    });

    it('updateValidation delegates to validationService', async () => {
      const dto = { reliabilityValue: 0.95 };
      mockValidationService.updateValidation.mockResolvedValueOnce({
        id: 'v1',
        reliabilityValue: 0.95,
      });
      await controller.updateValidation('v1', dto as any);
      expect(mockValidationService.updateValidation).toHaveBeenCalledWith(
        'v1',
        dto,
      );
    });

    it('deleteValidation delegates to validationService', async () => {
      mockValidationService.deleteValidation.mockResolvedValueOnce(undefined);
      const result = await controller.deleteValidation('v1');
      expect(mockValidationService.deleteValidation).toHaveBeenCalledWith('v1');
      expect(result).toEqual({ deleted: true });
    });

    it('getValidationSummary delegates to validationService', async () => {
      const summary = {
        scaleId: 's1',
        totalStudies: 2,
        avgReliability: 0.85,
      };
      mockValidationService.getValidationSummary.mockResolvedValueOnce(summary);
      const result = await controller.getValidationSummary('s1');
      expect(mockValidationService.getValidationSummary).toHaveBeenCalledWith(
        's1',
      );
      expect(result.totalStudies).toBe(2);
    });
  });
});
