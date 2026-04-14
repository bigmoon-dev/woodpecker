import { DimensionStrategy } from './dimension.strategy';
import { ScoredAnswer } from '../scoring.types';

describe('DimensionStrategy', () => {
  const makeAnswer = (
    score: number,
    dimension: string | null,
  ): ScoredAnswer => ({
    itemId: `item-${score}`,
    optionId: `opt-${score}`,
    score,
    dimension,
    reverseScore: false,
  });

  describe('calculate', () => {
    it('filters by dimension', () => {
      const strategy = new DimensionStrategy('A');
      const answers = [
        makeAnswer(2, 'A'),
        makeAnswer(3, 'A'),
        makeAnswer(5, 'B'),
      ];
      expect(strategy.calculate(answers)).toBe(5);
    });

    it('returns sum of all answers when dimension is null', () => {
      const strategy = new DimensionStrategy(null);
      const answers = [makeAnswer(2, 'A'), makeAnswer(3, 'B')];
      expect(strategy.calculate(answers)).toBe(5);
    });

    it('returns 0 when no answers match dimension', () => {
      const strategy = new DimensionStrategy('C');
      const answers = [makeAnswer(2, 'A'), makeAnswer(3, 'B')];
      expect(strategy.calculate(answers)).toBe(0);
    });

    it('returns 0 for empty answers', () => {
      const strategy = new DimensionStrategy('A');
      expect(strategy.calculate([])).toBe(0);
    });
  });

  describe('calculateAll', () => {
    it('groups scores by dimension', () => {
      const answers = [
        makeAnswer(2, 'A'),
        makeAnswer(3, 'A'),
        makeAnswer(4, 'B'),
        makeAnswer(1, 'B'),
      ];
      const result = DimensionStrategy.calculateAll(answers);
      expect(result['A']).toBe(5);
      expect(result['B']).toBe(5);
    });

    it('puts items without dimension into _total', () => {
      const answers = [makeAnswer(2, null), makeAnswer(3, 'A')];
      const result = DimensionStrategy.calculateAll(answers);
      expect(result['_total']).toBe(2);
      expect(result['A']).toBe(3);
    });

    it('returns empty object for empty answers', () => {
      expect(DimensionStrategy.calculateAll([])).toEqual({});
    });

    it('handles single dimension', () => {
      const answers = [
        makeAnswer(1, 'X'),
        makeAnswer(2, 'X'),
        makeAnswer(3, 'X'),
      ];
      const result = DimensionStrategy.calculateAll(answers);
      expect(Object.keys(result)).toEqual(['X']);
      expect(result['X']).toBe(6);
    });
  });
});
