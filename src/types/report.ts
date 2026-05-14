// src/types/report.ts

import type { AnalysisIssue } from './analyzer';
import type { PerformanceScore } from './scoring';
import type { ActionItem } from './actions';

export interface ReportData {
  timestamp: string; // ISO 8601
  angularVersion: string | null;
  pageUrl: string;
  componentCount: number;
  score: PerformanceScore;
  issues: AnalysisIssue[];
  actionItems: ActionItem[];
}

export type ExportFormat = 'json' | 'markdown' | 'clipboard';
