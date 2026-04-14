import { ScoreRangeMatcher } from './score-range.matcher';

describe('ScoreRangeMatcher', () => {
  const ranges = [
    {
      minScore: 0,
      maxScore: 4,
      level: 'normal',
      color: 'green',
      suggestion: 'ok',
    },
    {
      minScore: 5,
      maxScore: 9,
      level: 'mild',
      color: 'yellow',
      suggestion: 'mild concern',
    },
    {
      minScore: 10,
      maxScore: 14,
      level: 'moderate',
      color: 'orange',
      suggestion: 'moderate concern',
    },
    {
      minScore: 15,
      maxScore: 19,
      level: 'severe',
      color: 'red',
      suggestion: 'severe concern',
    },
  ];

  describe('match', () => {
    it('matches score within a range', () => {
      const result = ScoreRangeMatcher.match(7, ranges);
      expect(result.level).toBe('mild');
      expect(result.color).toBe('yellow');
      expect(result.suggestion).toBe('mild concern');
    });

    it('matches minScore boundary', () => {
      const result = ScoreRangeMatcher.match(5, ranges);
      expect(result.level).toBe('mild');
    });

    it('matches maxScore boundary', () => {
      const result = ScoreRangeMatcher.match(9, ranges);
      expect(result.level).toBe('mild');
    });

    it('returns unknown/gray when no range matches', () => {
      const result = ScoreRangeMatcher.match(99, ranges);
      expect(result.level).toBe('unknown');
      expect(result.color).toBe('gray');
      expect(result.suggestion).toBe('');
    });

    it('returns unknown for empty ranges', () => {
      const result = ScoreRangeMatcher.match(5, []);
      expect(result.level).toBe('unknown');
      expect(result.color).toBe('gray');
    });

    it('matches score at zero boundary', () => {
      const result = ScoreRangeMatcher.match(0, ranges);
      expect(result.level).toBe('normal');
    });
  });

  describe('matchDimension', () => {
    const dimRanges = [
      {
        dimension: 'A',
        minScore: 0,
        maxScore: 5,
        level: 'low',
        color: 'green',
        suggestion: 'a-low',
      },
      {
        dimension: 'A',
        minScore: 6,
        maxScore: 10,
        level: 'high',
        color: 'red',
        suggestion: 'a-high',
      },
      {
        dimension: 'B',
        minScore: 0,
        maxScore: 3,
        level: 'low',
        color: 'green',
        suggestion: 'b-low',
      },
      {
        dimension: 'B',
        minScore: 4,
        maxScore: 8,
        level: 'high',
        color: 'red',
        suggestion: 'b-high',
      },
    ];

    it('matches each dimension independently', () => {
      const scores = { A: 3, B: 6 };
      const result = ScoreRangeMatcher.matchDimension(scores, dimRanges);
      expect(result['A'].level).toBe('low');
      expect(result['B'].level).toBe('high');
    });

    it('returns unknown for dimension with no matching ranges', () => {
      const scores = { C: 5 };
      const result = ScoreRangeMatcher.matchDimension(scores, dimRanges);
      expect(result['C'].level).toBe('unknown');
      expect(result['C'].color).toBe('gray');
    });

    it('returns empty object for empty scores', () => {
      const result = ScoreRangeMatcher.matchDimension({}, dimRanges);
      expect(result).toEqual({});
    });

    it('handles multiple dimensions at boundaries', () => {
      const scores = { A: 5, B: 4 };
      const result = ScoreRangeMatcher.matchDimension(scores, dimRanges);
      expect(result['A'].level).toBe('low');
      expect(result['B'].level).toBe('high');
    });
  });
});
