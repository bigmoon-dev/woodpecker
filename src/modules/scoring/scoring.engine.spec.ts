import { Test } from '@nestjs/testing';
import { ScoringEngine } from './scoring.engine';
import { ScaleDefinition } from './scoring.types';

describe('ScoringEngine', () => {
  let engine: ScoringEngine;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ScoringEngine],
    }).compile();
    engine = module.get(ScoringEngine);
  });

  const phq9Def: ScaleDefinition = {
    id: 'phq9',
    items: Array.from({ length: 9 }, (_, i) => ({
      id: `item-${i}`,
      dimension: null,
      reverseScore: false,
      options: [
        { id: `opt-${i}-0`, scoreValue: 0 },
        { id: `opt-${i}-1`, scoreValue: 1 },
        { id: `opt-${i}-2`, scoreValue: 2 },
        { id: `opt-${i}-3`, scoreValue: 3 },
      ],
    })),
    scoringRules: [{ dimension: null, formulaType: 'sum', weight: 1 }],
    scoreRanges: [
      {
        dimension: null,
        minScore: 0,
        maxScore: 4,
        level: 'normal',
        color: 'green',
        suggestion: '无抑郁',
      },
      {
        dimension: null,
        minScore: 5,
        maxScore: 9,
        level: 'mild',
        color: 'yellow',
        suggestion: '轻度抑郁',
      },
      {
        dimension: null,
        minScore: 10,
        maxScore: 14,
        level: 'moderate',
        color: 'orange',
        suggestion: '中度抑郁',
      },
      {
        dimension: null,
        minScore: 15,
        maxScore: 19,
        level: 'severe',
        color: 'red',
        suggestion: '中重度抑郁',
      },
      {
        dimension: null,
        minScore: 20,
        maxScore: 27,
        level: 'extreme',
        color: 'red',
        suggestion: '重度抑郁',
      },
    ],
  };

  describe('PHQ-9 simple sum', () => {
    it('all zeros = 0, normal', () => {
      const answers = phq9Def.items.map((item) => ({
        itemId: item.id,
        optionId: item.options[0].id,
      }));
      const result = engine.calculate(answers, phq9Def);
      expect(result.totalScore).toBe(0);
      expect(result.level).toBe('normal');
      expect(result.color).toBe('green');
    });

    it('all threes = 27, extreme', () => {
      const answers = phq9Def.items.map((item) => ({
        itemId: item.id,
        optionId: item.options[3].id,
      }));
      const result = engine.calculate(answers, phq9Def);
      expect(result.totalScore).toBe(27);
      expect(result.level).toBe('extreme');
    });

    it('mixed = 9, mild', () => {
      const answers = phq9Def.items.map((item, i) => ({
        itemId: item.id,
        optionId: item.options[i % 4].id,
      }));
      const result = engine.calculate(answers, phq9Def);
      expect(result.totalScore).toBe(
        [0, 1, 2, 3, 0, 1, 2, 3, 0].reduce((a, b) => a + b, 0),
      );
      expect(result.level).toBe('moderate');
    });
  });

  describe('reverse scoring', () => {
    const reverseDef: ScaleDefinition = {
      id: 'reverse-test',
      items: [
        {
          id: 'r1',
          dimension: null,
          reverseScore: true,
          options: [
            { id: 'r1-0', scoreValue: 1 },
            { id: 'r1-1', scoreValue: 2 },
            { id: 'r1-2', scoreValue: 3 },
            { id: 'r1-3', scoreValue: 4 },
            { id: 'r1-4', scoreValue: 5 },
          ],
        },
      ],
      scoringRules: [{ dimension: null, formulaType: 'sum', weight: 1 }],
      scoreRanges: [
        {
          dimension: null,
          minScore: 0,
          maxScore: 10,
          level: 'ok',
          color: 'green',
          suggestion: '',
        },
      ],
    };

    it('reverses score: 1 becomes 5, 5 becomes 1', () => {
      const r = engine.calculate(
        [{ itemId: 'r1', optionId: 'r1-0' }],
        reverseDef,
      );
      expect(r.totalScore).toBe(5); // 1+5-1=5
    });

    it('reverses score: 3 stays 3 (midpoint)', () => {
      const r = engine.calculate(
        [{ itemId: 'r1', optionId: 'r1-2' }],
        reverseDef,
      );
      expect(r.totalScore).toBe(3); // 1+5-3=3
    });
  });

  describe('dimension scoring', () => {
    const dimDef: ScaleDefinition = {
      id: 'dim-test',
      items: [
        {
          id: 'd1-1',
          dimension: 'A',
          reverseScore: false,
          options: [{ id: 'd1-1-o', scoreValue: 2 }],
        },
        {
          id: 'd1-2',
          dimension: 'A',
          reverseScore: false,
          options: [{ id: 'd1-2-o', scoreValue: 3 }],
        },
        {
          id: 'd2-1',
          dimension: 'B',
          reverseScore: false,
          options: [{ id: 'd2-1-o', scoreValue: 4 }],
        },
        {
          id: 'd2-2',
          dimension: 'B',
          reverseScore: false,
          options: [{ id: 'd2-2-o', scoreValue: 1 }],
        },
      ],
      scoringRules: [
        { dimension: 'A', formulaType: 'sum', weight: 1 },
        { dimension: 'B', formulaType: 'sum', weight: 1 },
      ],
      scoreRanges: [
        {
          dimension: null,
          minScore: 0,
          maxScore: 20,
          level: 'ok',
          color: 'green',
          suggestion: '',
        },
      ],
    };

    it('calculates per-dimension scores', () => {
      const r = engine.calculate(
        [
          { itemId: 'd1-1', optionId: 'd1-1-o' },
          { itemId: 'd1-2', optionId: 'd1-2-o' },
          { itemId: 'd2-1', optionId: 'd2-1-o' },
          { itemId: 'd2-2', optionId: 'd2-2-o' },
        ],
        dimDef,
      );
      expect(r.dimensionScores['A']).toBe(5);
      expect(r.dimensionScores['B']).toBe(5);
      expect(r.totalScore).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('empty answers returns 0', () => {
      const r = engine.calculate([], phq9Def);
      expect(r.totalScore).toBe(0);
    });

    it('unknown item is scored 0', () => {
      const r = engine.calculate(
        [{ itemId: 'unknown', optionId: 'unknown' }],
        phq9Def,
      );
      expect(r.totalScore).toBe(0);
    });

    it('non-dimension weighted scoring applies weight', () => {
      const weightedDef: ScaleDefinition = {
        id: 'w1',
        items: [
          {
            id: 'w-1',
            dimension: null,
            reverseScore: false,
            options: [{ id: 'w-1-o', scoreValue: 3 }],
          },
          {
            id: 'w-2',
            dimension: null,
            reverseScore: false,
            options: [{ id: 'w-2-o', scoreValue: 2 }],
          },
        ],
        scoringRules: [{ dimension: null, formulaType: 'weighted', weight: 2 }],
        scoreRanges: [
          {
            dimension: null,
            minScore: 0,
            maxScore: 100,
            level: 'ok',
            color: 'green',
            suggestion: '',
          },
        ],
      };
      const r = engine.calculate(
        [
          { itemId: 'w-1', optionId: 'w-1-o' },
          { itemId: 'w-2', optionId: 'w-2-o' },
        ],
        weightedDef,
      );
      expect(r.totalScore).toBe(10);
    });
  });
});
