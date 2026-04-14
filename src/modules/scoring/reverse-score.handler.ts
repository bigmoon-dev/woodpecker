import { ScoredAnswer } from './scoring.types';

export class ReverseScoreHandler {
  static reverse(
    score: number,
    minOptionScore: number,
    maxOptionScore: number,
  ): number {
    return minOptionScore + maxOptionScore - score;
  }

  static processAnswers(
    answers: ScoredAnswer[],
    optionsMap: Record<string, { min: number; max: number }>,
  ): ScoredAnswer[] {
    return answers.map((a) => {
      if (!a.reverseScore) return a;
      const range = optionsMap[a.itemId];
      if (!range) return a;
      return {
        ...a,
        score: this.reverse(a.score, range.min, range.max),
      };
    });
  }
}
