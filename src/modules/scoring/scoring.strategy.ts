import { ScoredAnswer } from './scoring.types';

export interface ScoringStrategy {
  calculate(answers: ScoredAnswer[]): number;
}
