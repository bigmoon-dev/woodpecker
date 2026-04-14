import { SumStrategy } from './sum.strategy';
import { ScoredAnswer } from '../scoring.types';

describe('SumStrategy', () => {
  let strategy: SumStrategy;

  beforeEach(() => {
    strategy = new SumStrategy();
  });

  const makeAnswer = (score: number): ScoredAnswer => ({
    itemId: `item-${score}`,
    optionId: `opt-${score}`,
    score,
    dimension: null,
    reverseScore: false,
  });

  it('returns 0 for empty array', () => {
    expect(strategy.calculate([])).toBe(0);
  });

  it('returns the score for a single answer', () => {
    expect(strategy.calculate([makeAnswer(5)])).toBe(5);
  });

  it('sums multiple answers', () => {
    expect(
      strategy.calculate([makeAnswer(1), makeAnswer(2), makeAnswer(3)]),
    ).toBe(6);
  });

  it('returns 0 when all scores are zero', () => {
    expect(
      strategy.calculate([makeAnswer(0), makeAnswer(0), makeAnswer(0)]),
    ).toBe(0);
  });
});
