import { ReverseScoreHandler } from './reverse-score.handler';
import { ScoredAnswer } from './scoring.types';

describe('ReverseScoreHandler', () => {
  describe('reverse', () => {
    it('returns midpoint unchanged when score is the midpoint', () => {
      expect(ReverseScoreHandler.reverse(3, 1, 5)).toBe(3);
    });

    it('reverses min score to max', () => {
      expect(ReverseScoreHandler.reverse(1, 1, 5)).toBe(5);
    });

    it('reverses max score to min', () => {
      expect(ReverseScoreHandler.reverse(5, 1, 5)).toBe(1);
    });

    it('reverses score 2 to 4 in 1-5 range', () => {
      expect(ReverseScoreHandler.reverse(2, 1, 5)).toBe(4);
    });

    it('handles range starting from 0', () => {
      expect(ReverseScoreHandler.reverse(0, 0, 3)).toBe(3);
      expect(ReverseScoreHandler.reverse(3, 0, 3)).toBe(0);
    });
  });

  describe('processAnswers', () => {
    const optionsMap: Record<string, { min: number; max: number }> = {
      item1: { min: 1, max: 5 },
      item2: { min: 0, max: 3 },
    };

    it('leaves items without reverseScore unchanged', () => {
      const answers: ScoredAnswer[] = [
        {
          itemId: 'item1',
          optionId: 'o1',
          score: 2,
          dimension: null,
          reverseScore: false,
        },
      ];
      const result = ReverseScoreHandler.processAnswers(answers, optionsMap);
      expect(result[0].score).toBe(2);
    });

    it('transforms items with reverseScore', () => {
      const answers: ScoredAnswer[] = [
        {
          itemId: 'item1',
          optionId: 'o1',
          score: 1,
          dimension: null,
          reverseScore: true,
        },
      ];
      const result = ReverseScoreHandler.processAnswers(answers, optionsMap);
      expect(result[0].score).toBe(5);
    });

    it('returns item unchanged when itemId is not in optionsMap', () => {
      const answers: ScoredAnswer[] = [
        {
          itemId: 'missing',
          optionId: 'o1',
          score: 3,
          dimension: null,
          reverseScore: true,
        },
      ];
      const result = ReverseScoreHandler.processAnswers(answers, optionsMap);
      expect(result[0].score).toBe(3);
    });

    it('handles mixed answers with and without reverseScore', () => {
      const answers: ScoredAnswer[] = [
        {
          itemId: 'item1',
          optionId: 'o1',
          score: 1,
          dimension: null,
          reverseScore: false,
        },
        {
          itemId: 'item2',
          optionId: 'o2',
          score: 0,
          dimension: null,
          reverseScore: true,
        },
      ];
      const result = ReverseScoreHandler.processAnswers(answers, optionsMap);
      expect(result[0].score).toBe(1);
      expect(result[1].score).toBe(3);
    });

    it('returns empty array for empty input', () => {
      expect(ReverseScoreHandler.processAnswers([], optionsMap)).toEqual([]);
    });
  });
});
