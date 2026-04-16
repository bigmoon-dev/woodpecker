/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ScaleVersionService } from './scale-version.service';
import { Scale } from '../../entities/scale/scale.entity';
import { ScoringRule } from '../../entities/scale/scoring-rule.entity';
import { ScoreRange } from '../../entities/scale/score-range.entity';
import { ScaleCacheService } from '../scoring/scale-cache.service';

describe('ScaleVersionService', () => {
  let service: ScaleVersionService;
  let scaleRepo: any;
  let dataSource: any;
  let scaleCacheService: any;

  const mockEntityManager = {
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({ id: 'new-version-id' }),
    findOne: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: any) => cb(mockEntityManager)),
  };

  const mockScaleCacheService = {
    refresh: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEntityManager.create.mockReturnValue({});
    mockEntityManager.save.mockResolvedValue({ id: 'new-version-id' });
    mockEntityManager.findOne.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScaleVersionService,
        {
          provide: getRepositoryToken(Scale),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ScaleCacheService, useValue: mockScaleCacheService },
      ],
    }).compile();

    service = module.get<ScaleVersionService>(ScaleVersionService);
    scaleRepo = module.get(getRepositoryToken(Scale));
    dataSource = module.get(DataSource);
    scaleCacheService = module.get(ScaleCacheService);
  });

  describe('publishScale()', () => {
    it('should publish a draft scale', async () => {
      const draft = {
        id: 's1',
        versionStatus: 'draft',
        isLibrary: false,
      };
      scaleRepo.findOne.mockResolvedValue(draft);
      scaleRepo.save.mockResolvedValue({
        ...draft,
        versionStatus: 'published',
        publishedAt: expect.any(Date),
        status: 'active',
      });

      const result = await service.publishScale('s1');

      expect(scaleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          versionStatus: 'published',
          status: 'active',
        }),
      );
      expect(result.versionStatus).toBe('published');
    });

    it('should throw if already published', async () => {
      scaleRepo.findOne.mockResolvedValue({
        id: 's1',
        versionStatus: 'published',
        isLibrary: false,
      });

      await expect(service.publishScale('s1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw for library scales', async () => {
      scaleRepo.findOne.mockResolvedValue({
        id: 's1',
        versionStatus: 'draft',
        isLibrary: true,
      });

      await expect(service.publishScale('s1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for missing scale', async () => {
      scaleRepo.findOne.mockResolvedValue(null);

      await expect(service.publishScale('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should refresh cache after publish', async () => {
      scaleRepo.findOne.mockResolvedValue({
        id: 's1',
        versionStatus: 'draft',
        isLibrary: false,
      });
      scaleRepo.save.mockResolvedValue({
        id: 's1',
        versionStatus: 'published',
      });

      await service.publishScale('s1');

      expect(scaleCacheService.refresh).toHaveBeenCalledWith('s1');
    });
  });

  describe('createVersion()', () => {
    const makeSourceScale = () => ({
      id: 's1',
      name: 'PHQ-9',
      version: '1.0',
      description: 'desc',
      source: 'src',
      validationInfo: null,
      isLibrary: false,
      versionStatus: 'published',
      items: [
        {
          itemText: 'Q1',
          itemType: 'single_choice',
          sortOrder: 0,
          dimension: 'core',
          reverseScore: false,
          options: [{ optionText: 'A', scoreValue: 0, sortOrder: 0 }],
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
    });

    it('should create a new version from a published scale', async () => {
      scaleRepo.findOne.mockResolvedValue(makeSourceScale());

      const result = await service.createVersion('s1');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Scale,
        expect.objectContaining({
          version: '1.1',
          parentScaleId: 's1',
          versionStatus: 'draft',
        }),
      );
      expect(mockEntityManager.save).toHaveBeenCalled();
    });

    it('should archive the source if published', async () => {
      scaleRepo.findOne.mockResolvedValue({ ...makeSourceScale() });

      await service.createVersion('s1');

      const archiveSave = mockEntityManager.save.mock.calls.find(
        (call: any[]) =>
          call[0] === Scale && call[1] && call[1].versionStatus === 'archived',
      );
      expect(archiveSave).toBeDefined();
    });

    it('should not archive source if it is draft', async () => {
      const draftSource = { ...makeSourceScale(), versionStatus: 'draft' };
      scaleRepo.findOne.mockResolvedValue(draftSource);

      await service.createVersion('s1');

      const saves = mockEntityManager.save.mock.calls;
      const archiveSave = saves.find(
        (c: any) => c[1]?.versionStatus === 'archived',
      );
      expect(archiveSave).toBeUndefined();
    });

    it('should increment version correctly from 2.3 to 2.4', async () => {
      const v23 = {
        ...makeSourceScale(),
        version: '2.3',
        versionStatus: 'draft',
      };
      scaleRepo.findOne.mockResolvedValue(v23);

      await service.createVersion('s1');

      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Scale,
        expect.objectContaining({ version: '2.4' }),
      );
    });

    it('should throw for library scales', async () => {
      scaleRepo.findOne.mockResolvedValue({
        ...makeSourceScale(),
        isLibrary: true,
      });

      await expect(service.createVersion('s1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for missing scale', async () => {
      scaleRepo.findOne.mockResolvedValue(null);

      await expect(service.createVersion('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should copy items without scoring rules and ranges', async () => {
      const noRules = {
        ...makeSourceScale(),
        scoringRules: [],
        scoreRanges: [],
        versionStatus: 'draft',
      };
      scaleRepo.findOne.mockResolvedValue(noRules);

      await service.createVersion('s1');

      const saveCalls = mockEntityManager.save.mock.calls;
      const nonScaleSaves = saveCalls.filter(
        (c: any) => c[0] !== Scale && c[0] !== undefined,
      );
      expect(nonScaleSaves.length).toBe(0);
    });
  });

  describe('getVersionHistory()', () => {
    it('should return single scale if no parent', async () => {
      const v1 = {
        id: 'v1',
        parentScaleId: null,
        version: '1.0',
        createdAt: new Date('2024-01-01'),
      };
      scaleRepo.findOne.mockResolvedValue(v1);
      scaleRepo.find.mockResolvedValue([]);

      const result = await service.getVersionHistory('v1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('v1');
    });

    it('should throw NotFoundException for missing scale', async () => {
      scaleRepo.findOne.mockResolvedValue(null);

      await expect(service.getVersionHistory('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getVersion()', () => {
    it('should return a specific version with full relations', async () => {
      const versionScale = {
        id: 'v2',
        items: [],
        scoringRules: [],
        scoreRanges: [],
      };
      scaleRepo.findOne
        .mockResolvedValueOnce(versionScale)
        .mockResolvedValueOnce({ id: 'v1' });
      scaleRepo.find.mockResolvedValueOnce([{ id: 'v2' }]);

      const result = await service.getVersion('v1', 'v2');

      expect(result.id).toBe('v2');
    });

    it('should throw NotFoundException for missing version', async () => {
      scaleRepo.findOne.mockResolvedValue(null);

      await expect(service.getVersion('v1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('archiveVersion()', () => {
    it('should archive a draft scale', async () => {
      scaleRepo.findOne.mockResolvedValue({
        id: 's1',
        versionStatus: 'draft',
      });
      scaleRepo.save.mockResolvedValue({
        id: 's1',
        versionStatus: 'archived',
      });

      const result = await service.archiveVersion('s1');

      expect(result.versionStatus).toBe('archived');
      expect(scaleCacheService.invalidate).toHaveBeenCalledWith('s1');
    });

    it('should throw if already archived', async () => {
      scaleRepo.findOne.mockResolvedValue({
        id: 's1',
        versionStatus: 'archived',
      });

      await expect(service.archiveVersion('s1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if published', async () => {
      scaleRepo.findOne.mockResolvedValue({
        id: 's1',
        versionStatus: 'published',
      });

      await expect(service.archiveVersion('s1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for missing scale', async () => {
      scaleRepo.findOne.mockResolvedValue(null);

      await expect(service.archiveVersion('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
