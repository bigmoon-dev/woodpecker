/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ScaleService } from './scale.service';
import { Scale } from '../../entities/scale/scale.entity';
import { ScoringRule } from '../../entities/scale/scoring-rule.entity';
import { ScoreRange } from '../../entities/scale/score-range.entity';
import { Task } from '../../entities/task/task.entity';
import { CreateScaleDto } from './scale.dto';

import { ScaleCacheService } from '../scoring/scale-cache.service';

describe('ScaleService', () => {
  let service: ScaleService;
  let dataSource: DataSource;
  let scaleRepo: any;
  let testingModule: TestingModule;

  const mockEntityManager = {
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({ id: 'scale-1' }),
    findOne: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: (em: any) => Promise<any>) =>
      cb(mockEntityManager),
    ),
  };

  const mockScaleCacheService = {
    refresh: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEntityManager.create.mockReturnValue({});
    mockEntityManager.save.mockResolvedValue({ id: 'scale-1' });
    mockEntityManager.findOne.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScaleService,
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: getRepositoryToken(Scale),
          useValue: {
            findAndCount: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
            save: jest.fn(),
          },
        },
        { provide: getRepositoryToken(ScoringRule), useValue: {} },
        { provide: getRepositoryToken(ScoreRange), useValue: {} },
        {
          provide: getRepositoryToken(Task),
          useValue: { count: jest.fn().mockResolvedValue(0) },
        },
        { provide: ScaleCacheService, useValue: mockScaleCacheService },
      ],
    }).compile();

    testingModule = module;
    service = module.get<ScaleService>(ScaleService);
    dataSource = module.get<DataSource>(DataSource);
    scaleRepo = module.get(getRepositoryToken(Scale));
    scaleRepo.findOne.mockResolvedValue(null);
  });

  describe('create() transaction', () => {
    it('should wrap all saves in a single transaction', async () => {
      const dto: CreateScaleDto = {
        name: 'PHQ-9',
        items: [
          {
            itemText: 'Q1',
            sortOrder: 0,
            options: [{ optionText: 'A', scoreValue: 0, sortOrder: 0 }],
          },
        ],
        scoringRules: [{ formulaType: 'sum', weight: 1.0 }],
        scoreRanges: [
          {
            minScore: 0,
            maxScore: 4,
            level: 'normal',
            color: 'green',
            suggestion: '正常',
          },
        ],
      };

      await service.create(dto);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.save).toHaveBeenCalledTimes(3);
    });

    it('should only save scale when no rules or ranges', async () => {
      const dto: CreateScaleDto = {
        name: 'Simple Scale',
        items: [
          {
            itemText: 'Q1',
            sortOrder: 0,
            options: [{ optionText: 'A', scoreValue: 0, sortOrder: 0 }],
          },
        ],
      };

      await service.create(dto);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.save).toHaveBeenCalledTimes(1);
    });

    it('should rollback on failure', async () => {
      mockEntityManager.save.mockRejectedValueOnce(new Error('DB error'));

      const dto: CreateScaleDto = {
        name: 'Fail Scale',
        items: [
          {
            itemText: 'Q1',
            sortOrder: 0,
            options: [{ optionText: 'A', scoreValue: 0, sortOrder: 0 }],
          },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow('DB error');
    });
  });

  describe('findAll()', () => {
    it('returns paginated non-library scales', async () => {
      scaleRepo.findAndCount.mockResolvedValueOnce([[{ id: 's1' }], 1]);
      const result = await service.findAll(1, 20);
      expect(result).toEqual({ data: [{ id: 's1' }], total: 1 });
      expect(scaleRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isLibrary: false } }),
      );
    });
  });

  describe('findLibrary()', () => {
    it('returns only isLibrary=true', async () => {
      scaleRepo.find.mockResolvedValueOnce([{ id: 'lib1', isLibrary: true }]);
      const result = await service.findLibrary();
      expect(result).toEqual([{ id: 'lib1', isLibrary: true }]);
      expect(scaleRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isLibrary: true, status: 'active' },
        }),
      );
    });
  });

  describe('findOne()', () => {
    it('returns full scale', async () => {
      scaleRepo.findOne.mockResolvedValueOnce({
        id: 's1',
        items: [],
        scoringRules: [],
        scoreRanges: [],
      });
      const result = await service.findOne('s1');
      expect(result).toEqual({
        id: 's1',
        items: [],
        scoringRules: [],
        scoreRanges: [],
      });
    });

    it('throws NotFoundException when not found', async () => {
      scaleRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove()', () => {
    it('calls delete + cache invalidate when scale has no tasks', async () => {
      scaleRepo.findOne.mockResolvedValueOnce({
        id: 's1',
        isLibrary: false,
      });
      await service.remove('s1');
      expect(scaleRepo.delete).toHaveBeenCalledWith('s1');
      expect(mockScaleCacheService.invalidate).toHaveBeenCalledWith('s1');
    });

    it('throws if scale is library scale', async () => {
      scaleRepo.findOne.mockResolvedValueOnce({
        id: 's1',
        isLibrary: true,
      });
      await expect(service.remove('s1')).rejects.toThrow('不能删除内置量表');
    });

    it('throws if scale is referenced by tasks', async () => {
      scaleRepo.findOne.mockResolvedValueOnce({
        id: 's1',
        isLibrary: false,
      });
      const taskRepo = testingModule.get(getRepositoryToken(Task));
      taskRepo.count.mockResolvedValueOnce(3);
      await expect(service.remove('s1')).rejects.toThrow(
        '该量表已被 3 个任务引用',
      );
    });

    it('throws if scale not found', async () => {
      scaleRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.remove('s1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cloneFromLibrary()', () => {
    const libraryScale = {
      id: 'lib-1',
      name: 'PHQ-9',
      version: '1.0',
      description: 'Depression scale',
      items: [
        {
          itemText: 'Q1',
          itemType: 'single_choice',
          sortOrder: 0,
          dimension: 'core',
          reverseScore: false,
          options: [{ optionText: 'Not at all', scoreValue: 0, sortOrder: 0 }],
        },
      ],
      scoringRules: [
        { dimension: 'total', formulaType: 'sum', weight: 1, config: {} },
      ],
      scoreRanges: [
        {
          dimension: 'total',
          minScore: 0,
          maxScore: 4,
          level: 'normal',
          color: 'green',
          suggestion: 'OK',
        },
      ],
    };

    it('should clone a library scale into a draft', async () => {
      scaleRepo.findOne.mockResolvedValueOnce(libraryScale);
      mockEntityManager.save.mockResolvedValueOnce({
        id: 'clone-1',
        name: 'PHQ-9 (副本)',
      });

      const result = await service.cloneFromLibrary('lib-1');

      expect(scaleRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lib-1', isLibrary: true },
        }),
      );
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Scale,
        expect.objectContaining({
          status: 'draft',
          isLibrary: false,
        }),
      );
      expect(mockEntityManager.save).toHaveBeenCalledTimes(3);
    });

    it('should throw NotFoundException when library scale not found', async () => {
      scaleRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.cloneFromLibrary('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should clone without scoring rules and score ranges', async () => {
      const noRules = {
        ...libraryScale,
        scoringRules: [],
        scoreRanges: [],
      };
      scaleRepo.findOne.mockResolvedValueOnce(noRules);
      mockEntityManager.save.mockResolvedValueOnce({ id: 'clone-2' });

      await service.cloneFromLibrary('lib-1');
      expect(mockEntityManager.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('update()', () => {
    const existingScale = {
      id: 'scale-1',
      name: 'Old',
      version: '1.0',
      description: 'desc',
      source: 'src',
      validationInfo: null,
      versionStatus: 'draft',
      isLibrary: false,
      items: [],
      scoringRules: [],
      scoreRanges: [],
    };

    it('should update name only', async () => {
      mockEntityManager.findOne.mockResolvedValueOnce(existingScale);
      mockEntityManager.save.mockResolvedValueOnce({
        ...existingScale,
        name: 'New',
      });

      const result = await service.update('scale-1', { name: 'New' });

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        Scale,
        expect.objectContaining({ name: 'New' }),
      );
    });

    it('should throw NotFoundException when scale not found', async () => {
      mockEntityManager.findOne.mockResolvedValueOnce(null);

      await expect(service.update('missing', { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update with items, scoringRules and scoreRanges', async () => {
      mockEntityManager.findOne.mockResolvedValueOnce(existingScale);
      mockEntityManager.save.mockResolvedValueOnce({
        ...existingScale,
        name: 'Updated',
      });

      const dto = {
        name: 'Updated',
        items: [
          {
            itemText: 'Q1',
            sortOrder: 0,
            options: [{ optionText: 'A', scoreValue: 0, sortOrder: 0 }],
          },
        ],
        scoringRules: [{ dimension: 'total', formulaType: 'sum', weight: 1 }],
        scoreRanges: [
          {
            dimension: 'total',
            minScore: 0,
            maxScore: 10,
            level: 'normal',
            color: 'green',
            suggestion: 'OK',
          },
        ],
      };

      await service.update('scale-1', dto);

      expect(mockEntityManager.save).toHaveBeenCalled();
      expect(mockScaleCacheService.refresh).toHaveBeenCalledWith('scale-1');
    });

    it('should handle cache refresh failure gracefully', async () => {
      mockEntityManager.findOne.mockResolvedValueOnce(existingScale);
      mockEntityManager.save.mockResolvedValueOnce(existingScale);
      mockScaleCacheService.refresh.mockRejectedValueOnce(new Error('cache'));

      const result = await service.update('scale-1', { name: 'X' });
      expect(result).toBeDefined();
    });

    it('should update with items having no options', async () => {
      mockEntityManager.findOne.mockResolvedValueOnce(existingScale);
      mockEntityManager.save.mockResolvedValueOnce(existingScale);

      await service.update('scale-1', {
        items: [{ itemText: 'Q2', sortOrder: 1, options: [] }],
      });

      expect(mockEntityManager.save).toHaveBeenCalled();
    });

    it('should reject update on published scale', async () => {
      const publishedScale = {
        ...existingScale,
        versionStatus: 'published',
      };
      mockEntityManager.findOne.mockResolvedValueOnce(publishedScale);

      await expect(service.update('scale-1', { name: 'New' })).rejects.toThrow(
        'Cannot modify a published or library scale',
      );
    });

    it('should reject update on library scale', async () => {
      const libraryScale = {
        ...existingScale,
        isLibrary: true,
      };
      mockEntityManager.findOne.mockResolvedValueOnce(libraryScale);

      await expect(service.update('scale-1', { name: 'New' })).rejects.toThrow(
        'Cannot modify a published or library scale',
      );
    });
  });

  describe('dimensions validation', () => {
    it('should create with valid dimensions', async () => {
      const dto: CreateScaleDto = {
        name: 'SCL-90',
        items: [
          {
            itemText: 'Q1',
            sortOrder: 0,
            dimension: '躯体化',
            options: [{ optionText: 'A', scoreValue: 1, sortOrder: 0 }],
          },
        ],
        dimensions: ['躯体化', '强迫', '焦虑'],
      };

      await service.create(dto);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Scale,
        expect.objectContaining({ dimensions: ['躯体化', '强迫', '焦虑'] }),
      );
    });

    it('should deduplicate and trim dimensions on create', async () => {
      const dto: CreateScaleDto = {
        name: 'Test',
        items: [],
        dimensions: ['A', ' A', 'B'],
      };

      await service.create(dto);

      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Scale,
        expect.objectContaining({ dimensions: ['A', 'B'] }),
      );
    });

    it('should filter empty strings from dimensions on create', async () => {
      const dto: CreateScaleDto = {
        name: 'Test',
        items: [],
        dimensions: ['A', '', 'B', '  '],
      };

      await service.create(dto);

      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Scale,
        expect.objectContaining({ dimensions: ['A', 'B'] }),
      );
    });

    it('should reject create when item dimension not in list', async () => {
      const dto: CreateScaleDto = {
        name: 'Test',
        items: [
          {
            itemText: 'Q1',
            sortOrder: 0,
            dimension: 'X',
            options: [{ optionText: 'A', scoreValue: 0, sortOrder: 0 }],
          },
        ],
        dimensions: ['A', 'B'],
      };

      await expect(service.create(dto)).rejects.toThrow('不在预定义维度列表中');
    });

    it('should allow create with no dimensions (backward compat)', async () => {
      const dto: CreateScaleDto = {
        name: 'Old Scale',
        items: [
          {
            itemText: 'Q1',
            sortOrder: 0,
            dimension: 'anything',
            options: [{ optionText: 'A', scoreValue: 0, sortOrder: 0 }],
          },
        ],
      };

      await service.create(dto);

      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Scale,
        expect.objectContaining({ dimensions: [] }),
      );
    });

    it('should allow create with dimensions but items having no dimension', async () => {
      const dto: CreateScaleDto = {
        name: 'Test',
        items: [
          {
            itemText: 'Q1',
            sortOrder: 0,
            options: [{ optionText: 'A', scoreValue: 0, sortOrder: 0 }],
          },
        ],
        dimensions: ['A', 'B'],
      };

      await service.create(dto);

      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Scale,
        expect.objectContaining({ dimensions: ['A', 'B'] }),
      );
    });

    it('should update dimensions', async () => {
      const existingScale = {
        id: 'scale-1',
        name: 'Old',
        version: '1.0',
        description: '',
        source: '',
        validationInfo: null,
        versionStatus: 'draft',
        isLibrary: false,
        items: [],
        scoringRules: [],
        scoreRanges: [],
      };
      mockEntityManager.findOne.mockResolvedValueOnce(existingScale);
      mockEntityManager.save.mockResolvedValueOnce({
        ...existingScale,
        dimensions: ['X'],
      });

      await service.update('scale-1', { dimensions: ['X'] });

      expect(mockEntityManager.save).toHaveBeenCalledWith(
        Scale,
        expect.objectContaining({ dimensions: ['X'] }),
      );
    });

    it('should clear dimensions on update', async () => {
      const existingScale = {
        id: 'scale-1',
        name: 'Old',
        version: '1.0',
        description: '',
        source: '',
        validationInfo: null,
        versionStatus: 'draft',
        isLibrary: false,
        items: [],
        scoringRules: [],
        scoreRanges: [],
        dimensions: ['A'],
      };
      mockEntityManager.findOne.mockResolvedValueOnce(existingScale);
      mockEntityManager.save.mockResolvedValueOnce({
        ...existingScale,
        dimensions: [],
      });

      await service.update('scale-1', { dimensions: [] });

      expect(mockEntityManager.save).toHaveBeenCalledWith(
        Scale,
        expect.objectContaining({ dimensions: [] }),
      );
    });

    it('should reject update when item dimension not in list', async () => {
      const existingScale = {
        id: 'scale-1',
        name: 'Old',
        version: '1.0',
        description: '',
        source: '',
        validationInfo: null,
        versionStatus: 'draft',
        isLibrary: false,
        items: [],
        scoringRules: [],
        scoreRanges: [],
      };
      mockEntityManager.findOne.mockResolvedValueOnce(existingScale);

      await expect(
        service.update('scale-1', {
          dimensions: ['A'],
          items: [
            {
              itemText: 'Q1',
              sortOrder: 0,
              dimension: 'Z',
              options: [{ optionText: 'X', scoreValue: 0, sortOrder: 0 }],
            },
          ],
        }),
      ).rejects.toThrow('不在预定义维度列表中');
    });

    it('should clone dimensions from library scale', async () => {
      const libraryScale = {
        id: 'lib-1',
        name: 'PHQ-9',
        version: '1.0',
        description: '',
        items: [],
        scoringRules: [],
        scoreRanges: [],
        dimensions: ['躯体化', '焦虑'],
      };
      scaleRepo.findOne.mockResolvedValueOnce(libraryScale);
      mockEntityManager.save.mockResolvedValueOnce({ id: 'clone-1' });

      await service.cloneFromLibrary('lib-1');

      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Scale,
        expect.objectContaining({ dimensions: ['躯体化', '焦虑'] }),
      );
    });

    it('should clone with empty dimensions (backward compat)', async () => {
      const libraryScale = {
        id: 'lib-1',
        name: 'PHQ-9',
        version: '1.0',
        description: '',
        items: [],
        scoringRules: [],
        scoreRanges: [],
      };
      scaleRepo.findOne.mockResolvedValueOnce(libraryScale);
      mockEntityManager.save.mockResolvedValueOnce({ id: 'clone-2' });

      await service.cloneFromLibrary('lib-1');

      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Scale,
        expect.objectContaining({ dimensions: [] }),
      );
    });

    it('should reject scoringRule dimension not in list', async () => {
      const dto: CreateScaleDto = {
        name: 'Test',
        items: [],
        dimensions: ['A'],
        scoringRules: [{ dimension: 'Z', formulaType: 'sum', weight: 1 }],
      };

      await expect(service.create(dto)).rejects.toThrow(
        '评分规则的维度"Z"不在预定义维度列表中',
      );
    });

    it('should reject scoreRange dimension not in list', async () => {
      const dto: CreateScaleDto = {
        name: 'Test',
        items: [],
        dimensions: ['A'],
        scoreRanges: [
          {
            dimension: 'Z',
            minScore: 0,
            maxScore: 10,
            level: 'low',
            color: 'green',
            suggestion: 'OK',
          },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(
        '分数范围的维度"Z"不在预定义维度列表中',
      );
    });
  });
});
