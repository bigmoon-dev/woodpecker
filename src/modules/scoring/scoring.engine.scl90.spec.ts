import { Test } from '@nestjs/testing';
import { ScoringEngine } from './scoring.engine';
import { ScaleDefinition } from './scoring.types';

describe('ScoringEngine - SCL-90 (abbreviated)', () => {
  let engine: ScoringEngine;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ScoringEngine],
    }).compile();
    engine = module.get(ScoringEngine);
  });

  const dimensions = [
    'somatization',
    'obsessive_compulsive',
    'interpersonal_sensitivity',
    'depression',
    'anxiety',
    'hostility',
    'phobic_anxiety',
    'paranoid_ideation',
    'psychoticism',
    'additional',
  ];

  const reverseItemDim = 'obsessive_compulsive';

  const makeItems = () => {
    const items: ScaleDefinition['items'] = [];
    dimensions.forEach((dim, di) => {
      for (let j = 0; j < 3; j++) {
        items.push({
          id: `scl-${di * 3 + j + 1}`,
          dimension: dim,
          reverseScore: dim === reverseItemDim && j === 0,
          options: [
            { id: `scl-${di * 3 + j + 1}-o0`, scoreValue: 0 },
            { id: `scl-${di * 3 + j + 1}-o1`, scoreValue: 1 },
            { id: `scl-${di * 3 + j + 1}-o2`, scoreValue: 2 },
            { id: `scl-${di * 3 + j + 1}-o3`, scoreValue: 3 },
            { id: `scl-${di * 3 + j + 1}-o4`, scoreValue: 4 },
          ],
        });
      }
    });
    return items;
  };

  const scl90Def: ScaleDefinition = {
    id: 'scl90',
    items: makeItems(),
    scoringRules: dimensions.map((d) => ({
      dimension: d,
      formulaType: 'sum',
      weight: 1,
    })),
    scoreRanges: [
      ...dimensions.flatMap((d) => [
        {
          dimension: d,
          minScore: 0,
          maxScore: 2,
          level: 'normal',
          color: 'green',
          suggestion: `${d}: normal`,
        },
        {
          dimension: d,
          minScore: 2.01,
          maxScore: 4,
          level: 'elevated',
          color: 'orange',
          suggestion: `${d}: elevated`,
        },
      ]),
      {
        dimension: null,
        minScore: 0,
        maxScore: 50,
        level: 'normal',
        color: 'green',
        suggestion: 'total: normal',
      },
      {
        dimension: null,
        minScore: 51,
        maxScore: 120,
        level: 'elevated',
        color: 'orange',
        suggestion: 'total: elevated',
      },
    ],
  };

  it('all zeros → total reflects reverse scoring, most dimensions 0', () => {
    const answers = scl90Def.items.map((item) => ({
      itemId: item.id,
      optionId: item.options[0].id,
    }));
    const result = engine.calculate(answers, scl90Def);

    for (const dim of dimensions) {
      if (dim === reverseItemDim) {
        expect(result.dimensionScores[dim]).toBe(4);
      } else {
        expect(result.dimensionScores[dim]).toBe(0);
      }
    }
    expect(result.totalScore).toBe(4);
    expect(result.level).toBe('normal');
  });

  it('specific known scores → correct dimension sums and total', () => {
    const answers = scl90Def.items.map((item, idx) => {
      const score = (idx % 5) as 0 | 1 | 2 | 3 | 4;
      return {
        itemId: item.id,
        optionId: item.options[score].id,
      };
    });
    const result = engine.calculate(answers, scl90Def);

    const allDimSum = Object.values(result.dimensionScores).reduce(
      (s, v) => s + v,
      0,
    );
    expect(result.totalScore).toBe(allDimSum);
  });

  it('reverse-scored items are inverted correctly', () => {
    const reverseItem = scl90Def.items.find(
      (i) => i.reverseScore && i.dimension === reverseItemDim,
    )!;
    const normalItems = scl90Def.items.filter(
      (i) => i.id !== reverseItem.id && i.dimension === reverseItemDim,
    );

    const answers = [
      { itemId: reverseItem.id, optionId: reverseItem.options[4].id },
      ...normalItems.map((item) => ({
        itemId: item.id,
        optionId: item.options[0].id,
      })),
      ...scl90Def.items
        .filter((i) => i.dimension !== reverseItemDim)
        .map((item) => ({
          itemId: item.id,
          optionId: item.options[0].id,
        })),
    ];

    const result = engine.calculate(answers, scl90Def);
    expect(result.dimensionScores[reverseItemDim]).toBe(0);
  });

  it('dimensionLevels are populated for each dimension', () => {
    const answers = scl90Def.items.map((item) => ({
      itemId: item.id,
      optionId: item.options[0].id,
    }));
    const result = engine.calculate(answers, scl90Def);

    expect(result.dimensionLevels).toBeDefined();
    for (const dim of dimensions) {
      expect(result.dimensionLevels![dim]).toBeDefined();
      expect(result.dimensionLevels![dim].level).toBe('normal');
      expect(result.dimensionLevels![dim].color).toBe('green');
    }
  });

  it('dimensionLevels show elevated for high scores', () => {
    const answers = scl90Def.items.map((item) => ({
      itemId: item.id,
      optionId: item.options[4].id,
    }));
    const result = engine.calculate(answers, scl90Def);

    for (const dim of dimensions) {
      if (dim === reverseItemDim) {
        expect(result.dimensionScores[dim]).toBe(8);
      } else {
        expect(result.dimensionScores[dim]).toBe(12);
      }
      expect(result.dimensionLevels![dim].level).toBe('elevated');
      expect(result.dimensionLevels![dim].color).toBe('orange');
    }
  });

  it('applies weighted scoring rules per dimension', () => {
    const weightedDef: ScaleDefinition = {
      ...scl90Def,
      scoringRules: dimensions.map((d) => ({
        dimension: d,
        formulaType: 'weighted' as const,
        weight: 2,
      })),
    };

    const answers = scl90Def.items.map((item) => ({
      itemId: item.id,
      optionId: item.options[1].id,
    }));
    const result = engine.calculate(answers, weightedDef);

    for (const dim of dimensions) {
      if (dim === reverseItemDim) {
        expect(result.dimensionScores[dim]).toBe(10);
      } else {
        expect(result.dimensionScores[dim]).toBe(6);
      }
    }
    expect(result.totalScore).toBe(10 + 6 * 9);
  });

  it('weighted rule with mixed matched/unmatched dimensions', () => {
    const def: ScaleDefinition = {
      id: 'mixed-weight',
      items: [
        {
          id: 'a1',
          dimension: 'A',
          reverseScore: false,
          options: [{ id: 'a1o', scoreValue: 4 }],
        },
        {
          id: 'b1',
          dimension: 'B',
          reverseScore: false,
          options: [{ id: 'b1o', scoreValue: 3 }],
        },
      ],
      scoringRules: [{ dimension: 'A', formulaType: 'weighted', weight: 2 }],
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
    const result = engine.calculate(
      [
        { itemId: 'a1', optionId: 'a1o' },
        { itemId: 'b1', optionId: 'b1o' },
      ],
      def,
    );
    expect(result.dimensionScores['A']).toBe(8);
    expect(result.dimensionScores['B']).toBe(3);
    expect(result.totalScore).toBe(11);
  });
});
