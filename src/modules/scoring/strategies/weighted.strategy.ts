import { ScoringStrategy } from '../scoring.strategy';
import { ScoredAnswer } from '../scoring.types';

export class WeightedStrategy implements ScoringStrategy {
  private weight: number;

  constructor(weight = 1) {
    this.weight = weight;
  }

  calculate(answers: ScoredAnswer[]): number {
    const sum = answers.reduce((s, a) => s + a.score, 0);
    return sum * this.weight;
  }
}
