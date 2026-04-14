import { WeightedStrategy } from './weighted.strategy';
import { ScoredAnswer } from '../scoring.types';

describe('WeightedStrategy', () => {
  const makeAnswer = (score: number): ScoredAnswer => ({
    itemId: `item-${score}`,
    optionId: `opt-${score}`,
    score,
    dimension: null,
    reverseScore: false,
  });

  it('applies default weight of 1', () => {
    const strategy = new WeightedStrategy();
    expect(strategy.calculate([makeAnswer(3), makeAnswer(4)])).toBe(7);
  });

  it('applies custom weight of 2', () => {
    const strategy = new WeightedStrategy(2);
    expect(strategy.calculate([makeAnswer(3), makeAnswer(4)])).toBe(14);
  });

  it('returns 0 when weight is 0', () => {
    const strategy = new WeightedStrategy(0);
    expect(strategy.calculate([makeAnswer(5), makeAnswer(10)])).toBe(0);
  });

  it('handles negative scores', () => {
    const strategy = new WeightedStrategy(1);
    expect(strategy.calculate([makeAnswer(-3), makeAnswer(5)])).toBe(2);
  });

  it('returns 0 for empty array with default weight', () => {
    const strategy = new WeightedStrategy();
    expect(strategy.calculate([])).toBe(0);
  });

  it('applies negative weight to invert scores', () => {
    const strategy = new WeightedStrategy(-1);
    expect(strategy.calculate([makeAnswer(5)])).toBe(-5);
  });
});
