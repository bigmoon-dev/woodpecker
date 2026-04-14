/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ScaleService } from './scale.service';
import { Scale } from '../../entities/scale/scale.entity';
import { ScoringRule } from '../../entities/scale/scoring-rule.entity';
import { ScoreRange } from '../../entities/scale/score-range.entity';
import { CreateScaleDto } from './scale.dto';

import { ScaleCacheService } from '../scoring/scale-cache.service';

describe('ScaleService', () => {
  let service: ScaleService;
  let dataSource: DataSource;

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
});
