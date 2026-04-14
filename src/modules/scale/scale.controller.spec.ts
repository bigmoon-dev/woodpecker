/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ScaleController } from './scale.controller';
import { ScaleService } from './scale.service';
import { ExcelImportService } from './excel-import.service';
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
  };

  const mockExcelImportService = {
    parseScaleFromBuffer: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScaleController],
      providers: [
        { provide: ScaleService, useValue: mockScaleService },
        { provide: ExcelImportService, useValue: mockExcelImportService },
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
});
