export enum RiskLevel {
  Normal = 'normal',
  Attention = 'attention',
  Warning = 'warning',
  Crisis = 'crisis',
}

export enum InterviewStatus {
  Draft = 'draft',
  Reviewed = 'reviewed',
  Completed = 'completed',
}

export const VALID_TRANSITIONS: Record<string, string[]> = {
  [InterviewStatus.Draft]: [InterviewStatus.Reviewed],
  [InterviewStatus.Reviewed]: [InterviewStatus.Completed],
  [InterviewStatus.Completed]: [],
};

export const RISK_LEVELS = Object.values(RiskLevel);
export const INTERVIEW_STATUSES = Object.values(InterviewStatus);

export interface TemplateFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'paragraph' | 'select' | 'date' | 'number';
  extractionRule?: {
    pattern?: string;
    section?: string;
  };
  required?: boolean;
  options?: string[];
}
