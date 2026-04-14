import { Injectable } from '@nestjs/common';
import { ScoringResult, ScoredAnswer, ScaleDefinition } from './scoring.types';
import { SumStrategy } from './strategies/sum.strategy';
import { DimensionStrategy } from './strategies/dimension.strategy';
import { WeightedStrategy } from './strategies/weighted.strategy';
import { ReverseScoreHandler } from './reverse-score.handler';
import { ScoreRangeMatcher } from './score-range.matcher';

@Injectable()
export class ScoringEngine {
  calculate(
    rawAnswers: { itemId: string; optionId: string }[],
    scaleDef: ScaleDefinition,
  ): ScoringResult {
    const optionsRangeMap = this.buildOptionsRangeMap(scaleDef);
    const scoredAnswers = this.scoreAnswers(rawAnswers, scaleDef);
    const processedAnswers = ReverseScoreHandler.processAnswers(
      scoredAnswers,
      optionsRangeMap,
    );

    const scoringRules = scaleDef.scoringRules || [];
    const weightedRules = scoringRules.filter(
      (r) => r.formulaType === 'weighted' && r.weight !== 1,
    );
    const hasDimensions = scaleDef.items.some((i) => i.dimension !== null);
    let totalScore: number;
    let dimensionScores: Record<string, number> = {};

    if (hasDimensions) {
      dimensionScores = DimensionStrategy.calculateAll(processedAnswers);

      if (weightedRules.length > 0) {
        const newDimScores: Record<string, number> = {};
        for (const [dim, score] of Object.entries(dimensionScores)) {
          const rule = weightedRules.find((r) => r.dimension === dim);
          if (rule) {
            const dimAnswers = processedAnswers.filter(
              (a) => a.dimension === dim,
            );
            newDimScores[dim] = new WeightedStrategy(rule.weight).calculate(
              dimAnswers,
            );
          } else {
            newDimScores[dim] = score;
          }
        }
        dimensionScores = newDimScores;
      }

      totalScore = Object.values(dimensionScores).reduce((s, v) => s + v, 0);
    } else {
      if (weightedRules.length > 0) {
        const strategy = new WeightedStrategy(weightedRules[0].weight);
        totalScore = strategy.calculate(processedAnswers);
      } else {
        const strategy = new SumStrategy();
        totalScore = strategy.calculate(processedAnswers);
      }
    }

    const totalRanges = scaleDef.scoreRanges.filter((r) => !r.dimension);
    const matched = ScoreRangeMatcher.match(totalScore, totalRanges);

    const dimensionRanges = scaleDef.scoreRanges.filter(
      (r): r is typeof r & { dimension: string } => !!r.dimension,
    );
    const dimensionLevels =
      Object.keys(dimensionScores).length > 0
        ? ScoreRangeMatcher.matchDimension(dimensionScores, dimensionRanges)
        : undefined;

    return {
      totalScore,
      dimensionScores,
      dimensionLevels,
      level: matched.level,
      color: matched.color,
      suggestion: matched.suggestion,
    };
  }

  private scoreAnswers(
    rawAnswers: { itemId: string; optionId: string }[],
    scaleDef: ScaleDefinition,
  ): ScoredAnswer[] {
    const itemMap = new Map(scaleDef.items.map((i) => [i.id, i]));

    return rawAnswers.map((a) => {
      const item = itemMap.get(a.itemId);
      if (!item)
        return { ...a, score: 0, dimension: null, reverseScore: false };

      const option = item.options.find((o) => o.id === a.optionId);
      return {
        itemId: a.itemId,
        optionId: a.optionId,
        score: option?.scoreValue ?? 0,
        dimension: item.dimension,
        reverseScore: item.reverseScore,
      };
    });
  }

  private buildOptionsRangeMap(
    scaleDef: ScaleDefinition,
  ): Record<string, { min: number; max: number }> {
    const map: Record<string, { min: number; max: number }> = {};
    for (const item of scaleDef.items) {
      if (item.options.length === 0) continue;
      const scores = item.options.map((o) => o.scoreValue);
      map[item.id] = {
        min: Math.min(...scores),
        max: Math.max(...scores),
      };
    }
    return map;
  }
}
