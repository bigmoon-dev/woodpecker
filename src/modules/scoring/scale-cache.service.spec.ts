import { ScaleCacheService } from './scale-cache.service';
import { ScaleDefinition } from './scoring.types';
import { Repository } from 'typeorm';
import { Scale } from '../../entities/scale/scale.entity';

describe('ScaleCacheService', () => {
  let service: ScaleCacheService;
  let mockFind: jest.Mock;
  let mockFindOne: jest.Mock;
  let mockScaleRepo: Repository<Scale>;

  beforeEach(() => {
    mockFind = jest.fn().mockResolvedValue([]);
    mockFindOne = jest.fn().mockResolvedValue(null);
    mockScaleRepo = {
      find: mockFind,
      findOne: mockFindOne,
    } as unknown as Repository<Scale>;
    jest.clearAllMocks();
    service = new ScaleCacheService(mockScaleRepo);
  });

  it('should return undefined for missing key', () => {
    expect(service.get('nonexistent')).toBeUndefined();
  });

  it('should set and get a scale definition', () => {
    const def: ScaleDefinition = {
      id: 'scale-1',
      items: [],
      scoringRules: [],
      scoreRanges: [],
    };
    service.set('scale-1', def);
    expect(service.get('scale-1')).toBe(def);
  });

  it('should invalidate a cached scale', () => {
    const def: ScaleDefinition = {
      id: 'scale-1',
      items: [],
      scoringRules: [],
      scoreRanges: [],
    };
    service.set('scale-1', def);
    service.invalidate('scale-1');
    expect(service.get('scale-1')).toBeUndefined();
  });

  it('should clear all cached scales', () => {
    service.set('a', { id: 'a', items: [], scoringRules: [], scoreRanges: [] });
    service.set('b', { id: 'b', items: [], scoringRules: [], scoreRanges: [] });
    service.clear();
    expect(service.get('a')).toBeUndefined();
    expect(service.get('b')).toBeUndefined();
  });

  it('should overwrite existing key on set', () => {
    const def1: ScaleDefinition = {
      id: 's',
      items: [],
      scoringRules: [],
      scoreRanges: [],
    };
    const def2: ScaleDefinition = {
      id: 's',
      items: [],
      scoringRules: [{ dimension: null, formulaType: 'sum', weight: 1 }],
      scoreRanges: [],
    };
    service.set('s', def1);
    service.set('s', def2);
    expect(service.get('s')).toBe(def2);
  });

  it('should load scales from DB on onModuleInit', async () => {
    const mockScales = [
      {
        id: 'scale-1',
        status: 'active',
        items: [
          {
            id: 'item-1',
            dimension: null,
            reverseScore: false,
            options: [{ id: 'opt-1', scoreValue: 1 }],
          },
        ],
        scoringRules: [{ dimension: null, formulaType: 'sum', weight: 1 }],
        scoreRanges: [
          {
            dimension: null,
            minScore: 0,
            maxScore: 10,
            level: 'normal',
            color: 'green',
            suggestion: 'OK',
          },
        ],
      },
    ];
    mockFind.mockResolvedValueOnce(mockScales);
    await service.onModuleInit();
    expect(service.get('scale-1')).toBeDefined();
    expect(service.get('scale-1')!.items).toHaveLength(1);
  });
});
