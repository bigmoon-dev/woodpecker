/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
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
});
