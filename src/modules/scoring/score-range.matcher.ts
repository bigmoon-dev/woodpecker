import { ScoreRange } from '../../entities/scale/score-range.entity';

export class ScoreRangeMatcher {
  static match(
    score: number,
    ranges: Pick<
      ScoreRange,
      'minScore' | 'maxScore' | 'level' | 'color' | 'suggestion'
    >[],
  ): { level: string; color: string; suggestion: string } {
    for (const r of ranges) {
      if (score >= r.minScore && score <= r.maxScore) {
        return { level: r.level, color: r.color, suggestion: r.suggestion };
      }
    }
    return { level: 'unknown', color: 'gray', suggestion: '' };
  }

  static matchDimension(
    dimensionScores: Record<string, number>,
    ranges: Pick<
      ScoreRange,
      'dimension' | 'minScore' | 'maxScore' | 'level' | 'color' | 'suggestion'
    >[],
  ): Record<string, { level: string; color: string; suggestion: string }> {
    const result: Record<
      string,
      { level: string; color: string; suggestion: string }
    > = {};
    for (const [dim, score] of Object.entries(dimensionScores)) {
      const dimRanges = ranges.filter((r) => r.dimension === dim);
      result[dim] = this.match(score, dimRanges);
    }
    return result;
  }
}
