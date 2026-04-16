/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import {
  ReportTemplateService,
  ReportGeneratorService,
} from './report-generator.service';
import { ReportTemplate } from '../../entities/report/report-template.entity';

describe('ReportTemplateService', () => {
  let service: ReportTemplateService;
  let templateRepo: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportTemplateService,
        {
          provide: getRepositoryToken(ReportTemplate),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReportTemplateService>(ReportTemplateService);
    templateRepo = module.get(getRepositoryToken(ReportTemplate));
  });

  describe('create()', () => {
    it('should create a new template', async () => {
      templateRepo.save.mockImplementation((t: any) =>
        Promise.resolve({ ...t, id: 'tpl-1' }),
      );

      const result = await service.create({
        name: 'Custom Report',
        schema: { sections: [] },
      });

      expect(result.id).toBe('tpl-1');
      expect(result.name).toBe('Custom Report');
      expect(result.isBuiltIn).toBe(false);
    });

    it('should set defaults for optional fields', async () => {
      templateRepo.save.mockImplementation((t: any) =>
        Promise.resolve({ ...t, id: 'tpl-2' }),
      );

      const result = await service.create({
        name: 'Test',
        schema: {},
      });

      expect(result.type).toBe('group');
      expect(result.description).toBeNull();
    });
  });

  describe('findAll()', () => {
    it('should return all templates ordered by createdAt DESC', async () => {
      templateRepo.find.mockResolvedValueOnce([{ id: 't1' }, { id: 't2' }]);

      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(templateRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne()', () => {
    it('should return template by id', async () => {
      templateRepo.findOne.mockResolvedValueOnce({ id: 't1', name: 'Test' });

      const result = await service.findOne('t1');
      expect(result.name).toBe('Test');
    });

    it('should throw NotFoundException for missing template', async () => {
      templateRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update()', () => {
    it('should update non-built-in template', async () => {
      templateRepo.findOne.mockResolvedValueOnce({
        id: 't1',
        name: 'Old',
        isBuiltIn: false,
      });
      templateRepo.save.mockImplementation((t: any) => Promise.resolve(t));

      const result = await service.update('t1', { name: 'New' });
      expect(result.name).toBe('New');
    });

    it('should reject update of built-in template', async () => {
      templateRepo.findOne.mockResolvedValueOnce({
        id: 't1',
        isBuiltIn: true,
      });

      await expect(service.update('t1', { name: 'New' })).rejects.toThrow(
        'Cannot modify built-in report template',
      );
    });
  });

  describe('remove()', () => {
    it('should delete non-built-in template', async () => {
      templateRepo.findOne.mockResolvedValueOnce({
        id: 't1',
        isBuiltIn: false,
      });
      templateRepo.delete.mockResolvedValueOnce({ affected: 1 });

      await service.remove('t1');
      expect(templateRepo.delete).toHaveBeenCalledWith('t1');
    });

    it('should reject delete of built-in template', async () => {
      templateRepo.findOne.mockResolvedValueOnce({
        id: 't1',
        isBuiltIn: true,
      });

      await expect(service.remove('t1')).rejects.toThrow(
        'Cannot delete built-in report template',
      );
    });
  });
});

describe('ReportGeneratorService', () => {
  let service: ReportGeneratorService;
  let templateRepo: any;
  let dataSource: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportGeneratorService,
        {
          provide: getRepositoryToken(ReportTemplate),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReportGeneratorService>(ReportGeneratorService);
    templateRepo = module.get(getRepositoryToken(ReportTemplate));
    dataSource = module.get(DataSource);
  });

  describe('getGroupStatistics()', () => {
    it('should compute statistics from task results', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          total_score: 10,
          level: 'normal',
          color: 'green',
          dimension_scores: JSON.stringify({ anxiety: 3, depression: 7 }),
        },
        {
          total_score: 20,
          level: 'mild',
          color: 'yellow',
          dimension_scores: JSON.stringify({ anxiety: 8, depression: 12 }),
        },
      ]);

      const result = await service.getGroupStatistics('task-1');

      expect(result.taskId).toBe('task-1');
      expect(result.totalStudents).toBe(2);
      expect(result.avgScore).toBe(15);
      expect(result.levelDistribution).toEqual({ normal: 1, mild: 1 });
      expect(result.colorDistribution).toEqual({ green: 1, yellow: 1 });
      expect(result.dimensionAverages).toEqual({
        anxiety: 5.5,
        depression: 9.5,
      });
    });

    it('should handle empty results', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      const result = await service.getGroupStatistics('task-1');
      expect(result.totalStudents).toBe(0);
      expect(result.avgScore).toBe(0);
    });

    it('should handle null dimension_scores', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          total_score: 10,
          level: 'normal',
          color: 'green',
          dimension_scores: null,
        },
      ]);

      const result = await service.getGroupStatistics('task-1');
      expect(result.dimensionAverages).toEqual({});
    });
  });

  describe('generateGroupReport()', () => {
    it('should generate report with template', async () => {
      templateRepo.findOne.mockResolvedValueOnce({
        id: 'tpl-1',
        schema: { sections: [] },
      });
      dataSource.query.mockResolvedValueOnce([
        {
          total_score: 10,
          level: 'normal',
          color: 'green',
          dimension_scores: null,
        },
      ]);

      const result = await service.generateGroupReport('tpl-1', 'task-1');
      expect(result.taskId).toBe('task-1');
      expect(result.totalStudents).toBe(1);
    });

    it('should throw NotFoundException for missing template', async () => {
      templateRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.generateGroupReport('missing', 'task-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
