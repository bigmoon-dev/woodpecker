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
import { CreateScaleDto } from './scale.dto';

import { ScaleCacheService } from '../scoring/scale-cache.service';

describe('ScaleService', () => {
  let service: ScaleService;
  let dataSource: DataSource;
  let scaleRepo: any;

  const mockEntityManager = {
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({ id: 'scale-1' }),
    findOne: jest.fn(),
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
        { provide: ScaleCacheService, useValue: mockScaleCacheService },
      ],
    }).compile();

    service = module.get<ScaleService>(ScaleService);
    dataSource = module.get<DataSource>(DataSource);
    scaleRepo = module.get(getRepositoryToken(Scale));
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
    it('calls delete + cache invalidate', async () => {
      scaleRepo.delete.mockResolvedValueOnce(undefined);
      await service.remove('s1');
      expect(scaleRepo.delete).toHaveBeenCalledWith('s1');
      expect(mockScaleCacheService.invalidate).toHaveBeenCalledWith('s1');
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
  });
});
