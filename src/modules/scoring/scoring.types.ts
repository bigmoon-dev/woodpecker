export interface ScoringResult {
  totalScore: number;
  dimensionScores: Record<string, number>;
  dimensionLevels?: Record<
    string,
    { level: string; color: string; suggestion: string }
  >;
  level: string;
  color: string;
  suggestion: string;
}

export interface ScoredAnswer {
  itemId: string;
  optionId: string;
  score: number;
  dimension: string | null;
  reverseScore: boolean;
}

export interface ScaleDefinition {
  id: string;
  items: {
    id: string;
    dimension: string | null;
    reverseScore: boolean;
    options: { id: string; scoreValue: number }[];
  }[];
  scoringRules: {
    dimension: string | null;
    formulaType: string;
    weight: number;
  }[];
  scoreRanges: {
    dimension: string | null;
    minScore: number;
    maxScore: number;
    level: string;
    color: string;
    suggestion: string;
  }[];
}
