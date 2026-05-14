// src/types/help.ts

import type { IssueCategory } from './analyzer';

export interface HelpEntry {
  issueCategory: IssueCategory;
  issueType: string; // Specific issue identifier
  whyItMatters: string; // 1-3 sentences
  howToFix: string[]; // Step-by-step, max 5 steps
  codeExample?: {
    before: string; // Max 15 lines
    after: string; // Max 15 lines
  };
  expectedImprovement: 'latency-reduction' | 'memory-reduction' | 'render-efficiency';
  documentationUrl: string; // angular.dev link
}
