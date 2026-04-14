import { ScoringStrategy } from '../scoring.strategy';
import { ScoredAnswer } from '../scoring.types';

export class DimensionStrategy implements ScoringStrategy {
  private dimension: string | null;

  constructor(dimension: string | null) {
    this.dimension = dimension;
  }

  calculate(answers: ScoredAnswer[]): number {
    const filtered = this.dimension
      ? answers.filter((a) => a.dimension === this.dimension)
      : answers;
    return filtered.reduce((sum, a) => sum + a.score, 0);
  }

  static calculateAll(answers: ScoredAnswer[]): Record<string, number> {
    const dimensions: Record<string, number[]> = {};
    for (const a of answers) {
      const dim = a.dimension || '_total';
      if (!dimensions[dim]) dimensions[dim] = [];
      dimensions[dim].push(a.score);
    }
    const result: Record<string, number> = {};
    for (const [dim, scores] of Object.entries(dimensions)) {
      result[dim] = scores.reduce((s, v) => s + v, 0);
    }
    return result;
  }
}
