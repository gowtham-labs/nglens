// src/types/actions.ts

import type { AnalysisIssue, IssueCategory, Severity } from './analyzer';

export type ImpactLevel = 'high' | 'medium' | 'low';

export interface ActionItem {
  id: string;
  rank: number;
  issue: AnalysisIssue;
  impactLevel: ImpactLevel;
  estimatedGain: string; // Human-readable gain description
  resolved: boolean; // Compared against previous scan
}

export interface ActionListState {
  items: ActionItem[];
  filters: {
    severity: Severity[];
    category: IssueCategory[];
  };
  maxDisplay: number; // 50
  previousScanItems?: ActionItem[];
}
