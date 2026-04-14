import { ScoringStrategy } from '../scoring.strategy';
import { ScoredAnswer } from '../scoring.types';

export class SumStrategy implements ScoringStrategy {
  calculate(answers: ScoredAnswer[]): number {
    return answers.reduce((sum, a) => sum + a.score, 0);
  }
}
